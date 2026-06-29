import { Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

/**
 * Catálogo de HERRAMIENTAS DE DIAGNÓSTICO del agente de soporte (Fase 1).
 *
 * Idea (ver `base-conocimiento/modulos/soporte-ia.md` §10): el agente, ante un
 * problema del usuario ("no me aparece X", "no me deja Y"), llama —vía
 * function-calling— a una de estas herramientas **enlatadas y deterministas**; el
 * backend ejecuta una consulta **parametrizada de SOLO LECTURA** y devuelve un
 * resultado **saneado** (causa + acción, SIN PII). El modelo solo recibe ese
 * resultado, no datos crudos de la BD.
 *
 * ⛔ Reglas que cumplen TODAS las herramientas:
 *  - **Solo lectura.** Nunca mutan datos (son `SELECT`).
 *  - **RBAC del que pregunta.** Cada herramienta exige el permiso del módulo que
 *    toca; si el usuario no lo tiene (y no es soporte), devuelve `sin_permiso` y
 *    NO consulta nada.
 *  - **PII mínima.** El resultado no incluye CURP/correo/teléfono/RFC completo de
 *    terceros; solo lo justo para identificar el caso y explicar la causa.
 *  - **Consultas enlatadas.** El modelo elige la herramienta y sus parámetros, pero
 *    el SQL lo escribimos nosotros (sin text-to-SQL → sin inyección).
 */

/** Especificación de una herramienta en el formato de tools de OpenRouter/OpenAI. */
export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Lo mínimo del perfil del usuario que pregunta para validar RBAC. */
export interface PerfilDiag {
  esSoporte: boolean;
  claves: { clave: number }[];
}

@Injectable()
export class DiagnosticoService {
  private readonly logger = new Logger(DiagnosticoService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // Lecturas deterministas de diagnóstico. Se usan consultas FIJAS y parametrizadas
  // (no SQL del modelo); el cliente admin permite leer las tablas de negocio sin
  // ampliar grants. Endurecimiento futuro (con autorización de BD): mover estas
  // lecturas a un rol de solo lectura ampliado (p. ej. `v2_soporte_ro`).
  private get db(): SupabaseClient {
    return this.supabase.admin as unknown as SupabaseClient;
  }

  /** ¿El usuario tiene alguno de los permisos requeridos (o es soporte)? */
  private tieneAcceso(perfil: PerfilDiag, claves: number[]): boolean {
    if (perfil.esSoporte) return true;
    return perfil.claves.some((c) => claves.includes(c.clave));
  }

  /** Catálogo de herramientas que se ofrecen al modelo. */
  toolSpecs(): ToolSpec[] {
    return [
      {
        type: 'function',
        function: {
          name: 'buscar_cliente',
          description:
            'Busca clientes/inversionistas por nombre, razón social o RFC para identificar de cuál habla el usuario. Úsala primero cuando el usuario menciona a un cliente por su nombre. Devuelve coincidencias con su id interno y sus tipos; no expone datos personales sensibles.',
          parameters: {
            type: 'object',
            properties: {
              texto: {
                type: 'string',
                description: 'Nombre, razón social o RFC (o parte) del cliente a buscar.',
              },
            },
            required: ['texto'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'por_que_no_aparece_en_planes',
          description:
            'Diagnostica por qué un inversionista NO aparece en el selector de Ventas → Planes (donde se le crea o consulta su plan de pagos). Primero obtén el idInversionista con buscar_cliente. Devuelve la causa concreta y la acción recomendada.',
          parameters: {
            type: 'object',
            properties: {
              idInversionista: {
                type: 'string',
                description: 'Id interno del inversionista (de buscar_cliente).',
              },
            },
            required: ['idInversionista'],
          },
        },
      },
    ];
  }

  /**
   * Ejecuta una herramienta por nombre con los argumentos del modelo. Devuelve un
   * objeto saneado (serializable) que se le pasa de vuelta al modelo como resultado.
   */
  async ejecutar(
    nombre: string,
    args: Record<string, unknown>,
    perfil: PerfilDiag,
  ): Promise<unknown> {
    try {
      switch (nombre) {
        case 'buscar_cliente':
          return await this.buscarCliente(args, perfil);
        case 'por_que_no_aparece_en_planes':
          return await this.porQueNoApareceEnPlanes(args, perfil);
        default:
          return { error: `Herramienta desconocida: ${nombre}` };
      }
    } catch (e) {
      this.logger.error(`diagnostico.${nombre}: ${(e as Error).message}`);
      return { error: 'No se pudo ejecutar el diagnóstico. Ofrece escalar a un ticket.' };
    }
  }

  // --- Herramientas ---------------------------------------------------------

  private async buscarCliente(
    args: Record<string, unknown>,
    perfil: PerfilDiag,
  ): Promise<unknown> {
    if (!this.tieneAcceso(perfil, [300, 610])) {
      return { error: 'sin_permiso', mensaje: 'El usuario no tiene permiso para consultar clientes.' };
    }
    const texto = typeof args.texto === 'string' ? args.texto : '';
    // ALLOWLIST (no blocklist): solo letras, números, espacio, guion y &. Elimina
    // TODO metacarácter de PostgREST (`. , ( ) % * :`) para que el texto del modelo
    // no pueda alterar la sintaxis del filtro `.or()`. Robusto ante cambios futuros.
    const q = texto
      .replace(/[^\p{L}\p{N} \-&]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (q.length < 2) {
      return { coincidencias: [], nota: 'Texto de búsqueda demasiado corto.' };
    }

    const { data, error } = await this.db
      .from('inversionista')
      .select(
        'idInversionista, nombre, apellido1, apellido2, razonsocial, inversionista, arrendatario, ticket, usuarioFinal, pruebas, status',
      )
      .or(`razonsocial.ilike.%${q}%,nombre.ilike.%${q}%,RFC.ilike.%${q}%`)
      .limit(10);
    if (error) throw new Error(error.message);

    const coincidencias = (data ?? []).map((r) => {
      const tipos: string[] = [];
      if (r.inversionista) tipos.push('Inversionista');
      if (r.arrendatario) tipos.push('Arrendatario');
      if (r.ticket) tipos.push('Ticket');
      if (r.usuarioFinal) tipos.push('Usuario final');
      return {
        idInversionista: r.idInversionista,
        nombre:
          (r.razonsocial?.trim() ||
            [r.nombre, r.apellido1, r.apellido2].filter(Boolean).join(' ')) ??
          '(sin nombre)',
        tipos: tipos.length ? tipos : ['(sin tipo asignado)'],
        esPrueba: r.pruebas === true,
        activo: r.status === true,
      };
    });
    return { total: coincidencias.length, coincidencias };
  }

  private async porQueNoApareceEnPlanes(
    args: Record<string, unknown>,
    perfil: PerfilDiag,
  ): Promise<unknown> {
    if (!this.tieneAcceso(perfil, [300, 610])) {
      return { error: 'sin_permiso', mensaje: 'El usuario no tiene permiso para consultar Planes/Clientes.' };
    }
    const id = typeof args.idInversionista === 'string' ? args.idInversionista : '';
    if (!id) return { error: 'Falta el idInversionista. Usa buscar_cliente primero.' };

    const { data: inv, error } = await this.db
      .from('inversionista')
      .select('idInversionista, inversionista, pruebas, status')
      .eq('idInversionista', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) return { existe: false, mensaje: 'No existe un cliente con ese id.' };

    // Propiedades del inversionista (para enriquecer el diagnóstico).
    const { data: props, error: pErr } = await this.db
      .from('propiedades')
      .select('idPropiedad, pdpActivo, esTicket')
      .eq('idInversionista', id);
    if (pErr) throw new Error(pErr.message);
    const propiedades = props ?? [];
    const tienePlanActivo = propiedades.some((p) => p.pdpActivo === true && p.esTicket === false);

    // Condiciones REALES del selector de Planes (planes.service.ts:inversionistas,
    // desde v2.44.1): inversionista=true, pruebas=false, status=true.
    const causas: string[] = [];
    if (inv.status !== true) causas.push('El cliente está inactivo (status = false).');
    if (inv.inversionista !== true)
      causas.push('El cliente NO está marcado como "Inversionista" en su ficha de Clientes.');
    if (inv.pruebas === true)
      causas.push('El cliente está marcado como registro de PRUEBA (pruebas = true).');

    const apareceEnSelector = causas.length === 0;
    let accionSugerida: string;
    if (!apareceEnSelector) {
      accionSugerida =
        'Corrige la(s) causa(s) en el módulo Clientes (marcar como Inversionista, reactivar, o quitar la marca de prueba). Tras eso aparecerá en el selector de Planes.';
    } else if (propiedades.length === 0) {
      accionSugerida =
        'El cliente sí aparece en el selector de Planes, pero aún no tiene ninguna nave/propiedad vinculada. Para crearle su plan: selecciónalo en Planes → ⚙ Configuración → pestaña Propiedades y vincúlale una nave; luego crea y activa su plan.';
    } else if (!tienePlanActivo) {
      accionSugerida =
        'El cliente aparece en el selector y ya tiene propiedad(es) vinculada(s), pero ninguna con plan ACTIVO. Entra a ⚙ Configuración → Plan de Pagos para crear/activar el plan.';
    } else {
      accionSugerida = 'El cliente debería aparecer y tener al menos un plan activo.';
    }

    return {
      existe: true,
      apareceEnSelector,
      causas,
      detalle: {
        esInversionista: inv.inversionista === true,
        esPrueba: inv.pruebas === true,
        activo: inv.status === true,
        propiedadesVinculadas: propiedades.length,
        tienePlanActivo,
      },
      accionSugerida,
    };
  }
}
