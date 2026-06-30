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
            'ÚSALA SOLO para el selector de INVERSIONISTAS de Ventas → Planes (crear/consultar el plan de pagos de un inversionista). NO la uses para naves ni para Arrendatarios. Primero obtén el idInversionista con buscar_cliente. Devuelve la causa y la acción.',
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
      {
        type: 'function',
        function: {
          name: 'diagnosticar_nave',
          description:
            'Diagnostica por qué una NAVE no aparece como disponible para vincular/rentar/vender, o su estado actual. Úsala cuando el usuario diga que una nave "no le aparece", "no la ve", "no se puede vincular/rentar" o pregunte si está libre. La disponibilidad depende del contexto: en ARRENDATARIOS una nave está disponible si Arrendada=false; en VENTAS si su situación es "Disponible".',
          parameters: {
            type: 'object',
            properties: {
              parque: {
                type: 'string',
                description: 'Nombre (o parte) del parque, p. ej. "Acupark II".',
              },
              numNave: {
                type: 'string',
                description: 'Número o nombre de la nave, p. ej. "4".',
              },
              contexto: {
                type: 'string',
                enum: ['arrendatarios', 'ventas'],
                description:
                  'Para qué se quiere la nave: "arrendatarios" (rentar) o "ventas" (vender). Si no estás seguro, omítelo.',
              },
            },
            required: ['parque', 'numNave'],
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
        case 'diagnosticar_nave':
          return await this.diagnosticarNave(args, perfil);
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

    // Todas las causas posibles aquí son de ESTADO de datos (corregibles en la app),
    // no fallas de sistema.
    const tipoFalla =
      apareceEnSelector && (propiedades.length === 0 || !tienePlanActivo)
        ? 'datos'
        : !apareceEnSelector
          ? 'datos'
          : 'ninguna';

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
      tipoFalla,
      corregibleEnApp: tipoFalla === 'datos',
      accionSugerida,
    };
  }

  private async diagnosticarNave(
    args: Record<string, unknown>,
    perfil: PerfilDiag,
  ): Promise<unknown> {
    // Arrendatarios (claves 20/25) o Ventas (300/610) o soporte.
    if (!this.tieneAcceso(perfil, [20, 25, 300, 610])) {
      return { error: 'sin_permiso', mensaje: 'El usuario no tiene permiso para consultar naves.' };
    }
    const parque = typeof args.parque === 'string' ? args.parque : '';
    const numNave = args.numNave != null ? String(args.numNave) : '';
    const contexto = args.contexto === 'ventas' ? 'ventas' : args.contexto === 'arrendatarios' ? 'arrendatarios' : null;

    // Parte alfabética del parque (allowlist), p. ej. "Acupark" — evita el problema
    // "2" vs "II" trayendo todos los parques que coincidan y dejando desambiguar.
    const qParque = parque.replace(/[^\p{L} ]/gu, ' ').replace(/\s+/g, ' ').trim();
    const nName = numNave.replace(/[^\p{L}\p{N}]/gu, '');
    const nNum = parseInt(numNave.replace(/\D/g, ''), 10);
    if (!qParque || !nName) {
      return { error: 'Indica el parque y el número de nave.' };
    }

    const filtroNum = Number.isFinite(nNum)
      ? `numNaveNAME.eq.${nName},numNave.eq.${nNum}`
      : `numNaveNAME.eq.${nName}`;

    const { data, error } = await this.db
      .from('naves')
      .select('idNave, numNave, numNaveNAME, situacion, Arrendada, status, esTicket, parques!inner(nomParque)')
      .ilike('parques.nomParque', `%${qParque}%`)
      .or(filtroNum)
      .limit(10);
    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      return {
        encontrada: false,
        mensaje: `No encontré la nave "${numNave}" en un parque que coincida con "${parque}". Puede que no esté dada de alta, o que el nombre del parque/nave no sea exacto.`,
      };
    }

    const coincidencias = data.map((n) => {
      const parqueRel = n.parques as unknown as { nomParque: string | null } | { nomParque: string | null }[];
      const nomParque = Array.isArray(parqueRel) ? parqueRel[0]?.nomParque : parqueRel?.nomParque;
      const activa = n.status === true;
      const arrendada = n.Arrendada === true;
      const disponibleArrendar = activa && !arrendada && n.esTicket === false;
      const disponibleVender = activa && n.situacion === 'Disponible' && n.esTicket === false;

      let causaArrendatarios: string;
      if (!activa) causaArrendatarios = 'La nave está inactiva (status = false).';
      else if (arrendada)
        causaArrendatarios =
          'La nave ya está marcada como RENTADA (Arrendada = true): no aparece en el selector de Arrendatarios, que solo muestra naves libres. Si ese arrendamiento ya no aplica, hay que LIBERARLA (ponerla como no arrendada) para poder vincularla a otro arrendatario.';
      else causaArrendatarios = 'La nave está LIBRE (Arrendada = false): debería aparecer para rentar en ese parque.';

      let causaVentas: string;
      if (!activa) causaVentas = 'La nave está inactiva (status = false).';
      else if (n.situacion !== 'Disponible')
        causaVentas = `La nave no está disponible para venta (situación = "${n.situacion}"): el selector de Ventas solo muestra naves con situación "Disponible".`;
      else causaVentas = 'La nave está Disponible para venta.';

      // El estado de la nave (rentada/inactiva) es una falla de DATOS corregible
      // operativamente (liberar / activar), no una falla de sistema.
      const tipoFalla =
        contexto === 'ventas'
          ? activa && n.situacion === 'Disponible'
            ? 'ninguna'
            : 'datos'
          : activa && !arrendada
            ? 'ninguna'
            : 'datos';

      return {
        parque: nomParque,
        nave: n.numNaveNAME ?? n.numNave,
        situacion: n.situacion,
        arrendada,
        activa,
        esTicket: n.esTicket === true,
        disponibleParaRentar: disponibleArrendar,
        disponibleParaVender: disponibleVender,
        tipoFalla,
        corregibleEnApp: tipoFalla === 'datos',
        ...(contexto === 'arrendatarios'
          ? { diagnostico: causaArrendatarios }
          : contexto === 'ventas'
            ? { diagnostico: causaVentas }
            : { diagnosticoArrendatarios: causaArrendatarios, diagnosticoVentas: causaVentas }),
      };
    });

    return { encontrada: true, total: coincidencias.length, coincidencias };
  }
}
