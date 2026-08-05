import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { PerfilDiag, ToolSpec } from './soporte.types.js';

/**
 * Motor de CONSULTA DE DATOS del Agente (text-to-SQL acotado por claves).
 *
 * El agente responde preguntas analíticas ("cuántos clientes nuevos…") sobre los
 * **módulos cuya CLAVE de permiso tiene el usuario**. Doble barrera de seguridad:
 *  1) **Backend (esta clase):** el SQL solo puede tocar tablas del UNIVERSO permitido
 *     por las claves del usuario; se valida que sea SELECT y sin tablas fuera de él.
 *  2) **BD:** se ejecuta vía `agente_consulta_sql` con el rol `v2_agente_ro`
 *     (SELECT solo de negocio, nunca sistema). Aunque (1) fallara, Postgres lo impide.
 *
 * Para no inflar el prompt (un usuario soporte ve TODAS las tablas), el modelo recibe
 * solo la **lista de tablas** por módulo y pide las **columnas bajo demanda** con
 * `describir_tablas` antes de armar el SELECT con `consultar_datos`.
 */

/** Tablas de referencia (catálogos) consultables por cualquiera con acceso a datos. */
const COMUNES = [
  'catParametros', 'catTipoMovimientos', 'catTipoOperacion', 'catBancos',
  'catRegimenFiscal', 'catUsoCFDI', 'catClavesProdServ', 'catGirosComerciales',
  'catEstadosRG', 'inpc',
];

/** Mapa MÓDULO → claves de permiso → tablas/vistas de negocio que habilita. */
const MODULOS_DATOS: { modulo: string; claves: number[]; tablas: string[] }[] = [
  {
    modulo: 'Inversionistas/Ventas',
    claves: [600, 610, 620, 630],
    tablas: [
      'inversionista', 'inversionista_docs', 'propiedades', 'naves', 'parques',
      'pdp', 'pdpDetalle', 'pagos', 'kvasAsignados',
      'rgPdp', 'rgPdpDetalle', 'rgConceptos', 'raPdp', 'raPdpDetalle', 'raConceptos',
      'v_pdpdetalle', 'v_pagos', 'v_propiedades', 'v_naves', 'v_detClientes',
      'v_disponibilidad', 'v_totales', 'v_montoTotalAnual', 'v_pagosTotalAnual',
      'v_sumMontosTotalesPagos', 'v_sumMontosTotalesPdpDet', 'v_box_cumpl_pdp',
      'v_configPdpDet', 'v_rentasAdministradas', 'v_rentasGarantizadas', 'v_rentasCombinadas',
    ],
  },
  {
    modulo: 'Arrendatarios',
    claves: [10, 20, 21, 22, 23, 24, 25, 30],
    tablas: [
      'arrePdp', 'arrePdpDetalle', 'arrenPropiedades', 'arre_pagos', 'arre_ordenante',
      'arreConceptos', 'naves', 'parques',
      'v_arrendadasNaves', 'v_arreNavConPdp', 'v_arrenPdpMes', 'v_arrenPdpMesTotales',
      'v_arrepdpdet_totales', 'v_arreContratosUnMes', 'v_ContratosTresMeses',
      'v_arrecontratosproximos',
    ],
  },
  {
    modulo: 'Cuentas por Pagar',
    claves: [400, 401, 402, 403, 410, 420, 430, 431, 440, 441, 450, 460, 470],
    tablas: [
      'cxp', 'cxp_ppd', 'cxp_fechas_habilitadas', 'catFacturas', 'catFacturasDocs',
      'catProveedores', 'catProveedores_docs', 'proveedoresDocsCFDI', 'facturasProveedor',
      'comprobantesPago', 'movbancarios', 'conciliacion', 'autorizaciones',
      'Presupuestos', 'PresCategorias', 'PresDetalle',
      'v_autorizaciones', 'v_ResumenPagos', 'v_resumenPresupuesto',
    ],
  },
  {
    modulo: 'Fideicomiso',
    claves: [500, 510, 511, 520, 530, 540],
    tablas: [
      'fideicomiso', 'fideCondiciones', 'fideContabilidad', 'fideContaConceptos',
      'fideContaHistorial', 'fideDispersiones', 'fideMesDispersion', 'fidePdpDispersion',
      'fideSaldosBanco', 'fide_periodos_dispersion', 'v_fideicomiso', 'v_propiedadesfide',
    ],
  },
  {
    modulo: 'Parques',
    claves: [700, 701, 702, 710],
    tablas: ['parques', 'naves', 'v_naves', 'v_disponibilidad'],
  },
  {
    modulo: 'Clientes (padrón)',
    claves: [300, 301, 310],
    tablas: ['inversionista', 'inversionista_docs', 'catEmpresas', 'catInmobiliarias', 'catAsesoresInm'],
  },
  {
    modulo: 'CRM/Leads',
    claves: [320, 321, 322, 323, 324, 325, 326, 327, 328, 350],
    tablas: [
      'leads', 'leads_porAprobar', 'crm_lead_naves', 'actividad', 'agenda', 'tareas',
      'tareas_Notas', 'clasificaciones', 'crm_Etapas', 'crm_Origen', 'crm_campania',
      'crm_tipoCliente', 'crm_tipoOperaciones', 'crm_tipoVenta', 'crm_historial_etapas',
    ],
  },
];

const NO_TABLAS = new Set(['lateral', 'unnest', 'generate_series', 'json_to_recordset', 'jsonb_to_recordset']);

@Injectable()
export class ConsultasService {
  private readonly logger = new Logger(ConsultasService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Conjunto de tablas que el usuario puede consultar según sus claves (+ comunes). */
  universo(perfil: PerfilDiag): Set<string> {
    const set = new Set<string>(COMUNES);
    const claves = new Set(perfil.claves.map((c) => c.clave));
    for (const m of MODULOS_DATOS) {
      if (perfil.esSoporte || m.claves.some((k) => claves.has(k))) {
        for (const t of m.tablas) set.add(t);
      }
    }
    return set;
  }

  /** Módulos (con sus tablas) a los que el usuario tiene acceso. */
  private gruposDe(perfil: PerfilDiag): { modulo: string; tablas: string[] }[] {
    const claves = new Set(perfil.claves.map((c) => c.clave));
    return MODULOS_DATOS.filter(
      (m) => perfil.esSoporte || m.claves.some((k) => claves.has(k)),
    ).map((m) => ({ modulo: m.modulo, tablas: m.tablas }));
  }

  /** ¿La herramienta enrutada pertenece a este servicio? */
  maneja(nombre: string): boolean {
    return nombre === 'consultar_datos' || nombre === 'describir_tablas';
  }

  toolSpecs(perfil: PerfilDiag): ToolSpec[] {
    if (this.gruposDe(perfil).length === 0) return [];
    return [
      {
        type: 'function',
        function: {
          name: 'describir_tablas',
          description:
            'Devuelve las columnas de las tablas indicadas. ÚSALA ANTES de consultar_datos para conocer las columnas exactas de las tablas que vas a usar (no adivines nombres de columnas).',
          parameters: {
            type: 'object',
            properties: {
              tablas: {
                type: 'array',
                items: { type: 'string' },
                description: 'Nombres de tablas a describir (de la lista de tablas disponibles).',
              },
            },
            required: ['tablas'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'consultar_datos',
          description:
            'Ejecuta un SELECT de SOLO LECTURA para responder preguntas de datos del negocio (conteos, listados, totales). Úsala siempre que la pregunta requiera datos reales; nunca inventes cifras. Primero usa describir_tablas para conocer las columnas. El SQL va aquí, jamás como texto.',
          parameters: {
            type: 'object',
            properties: {
              consulta: {
                type: 'string',
                description:
                  'Consulta SQL SELECT válida (solo SELECT, sin comentarios). Identificadores camelCase entre comillas dobles, p. ej. "idInversionista".',
              },
            },
            required: ['consulta'],
          },
        },
      },
    ];
  }

  /**
   * Bloque COMPACTO para el prompt: solo la LISTA de tablas por módulo + reglas. Las
   * columnas se piden con describir_tablas (evita un prompt enorme cuando el usuario
   * tiene acceso a muchos módulos).
   */
  esquemaPrompt(perfil: PerfilDiag): string {
    const grupos = this.gruposDe(perfil);
    if (grupos.length === 0) return '';
    const lineas = grupos.map((g) => `  [${g.modulo}] ${g.tablas.join(', ')}`);
    lineas.push(`  [Catálogos comunes] ${COMUNES.join(', ')}`);
    return [
      'CONSULTA DE DATOS (herramientas describir_tablas + consultar_datos):',
      'Para responder preguntas de DATOS del negocio, consulta SOLO estas tablas (de los módulos del usuario):',
      lineas.join('\n'),
      'FLUJO OBLIGATORIO: 1) elige las tablas necesarias; 2) llama describir_tablas con ellas para ver sus columnas; 3) llama consultar_datos con un SELECT. NO adivines columnas.',
      'SÉ EFICIENTE: tienes un LÍMITE de rondas de herramientas. AGRUPA: pide describir_tablas con TODAS las tablas que vas a usar en UNA sola llamada, y puedes invocar VARIAS herramientas en el mismo turno. Prefiere UN SELECT con JOINs a varios SELECT sueltos. Cuando ya tengas lo suficiente para responder, RESPONDE — no sigas consultando por completitud.',
      'RELACIONES CLAVE (para JOINs correctos):',
      '- "inversionista"("idInversionista") = clientes/propietarios Y arrendatarios (un MISMO registro; arrendatario=true si renta, inversionista=true si compra). Nombre legible: COALESCE(NULLIF(razonsocial,\'\'), concat(nombre,\' \',apellido1)).',
      '- "naves"("idNave","idParque","numNave","numNaveNAME","Arrendada",situacion) → "parques"("idParque","nomParque").',
      '- ⚠️⚠️ NÚMERO DE NAVE — TRAMPA REAL: el número que el usuario VE en pantalla es "numNaveNAME" (texto, la etiqueta OFICIAL de la nave). "numNave" es un CONSECUTIVO INTERNO del parque y puede ser DISTINTO (verificado en prod: la nave visible "112" de Spartek II es numNave=51; la de Acupark III es numNave=36). Para buscar la nave que el usuario menciona o que aparece en una captura, filtra SIEMPRE por "numNaveNAME" = \'<número>\' (comillas: es texto) + el parque; NUNCA por "numNave", o diagnosticarás sobre la nave equivocada.',
      '- "propiedades"("idPropiedad","idInversionista","idNave","idParque","pdpActivo","esTicket"): liga inversionista↔nave en VENTAS.',
      '- ARRENDAMIENTO de una nave: "arrenPropiedades"("idNave","idArrendador",status) — el arrendatario es "inversionista" con "idInversionista" = "idArrendador"; status=true = vínculo vigente. (Vista equivalente: "v_arrendadasNaves" con "idNave","idArrendatario","numNave","nomParque".)',
      '- Plan de pagos (ventas): "pdp" ← "pdpDetalle"("idPdpDet","idPdp","idInversionista","idPropiedad","idNave") ← "pagos"("idPdpDet") [pagos reales].',
      '- Plan de renta (arrendatarios): "arrePdp"("idArrendador") ← "arrePdpDetalle".',
      'REGLAS SQL:',
      '- Solo SELECT. Identificadores camelCase SIEMPRE entre comillas dobles: "idInversionista", "nomParque", "pdpDetalle", "esTicket".',
      '- No uses tablas que no estén en la lista de arriba (el usuario no tiene acceso a otros módulos).',
      "- Fechas: (NOW() AT TIME ZONE 'America/Mexico_City')::date. Redondea: ROUND(valor::numeric, 2).",
      '- Pagos reales = tabla "pagos" (no campos cacheados de "pdpDetalle").',
      '- ⚠️ Nombres de parque: ILIKE \'%Acupark I%\' coincide con "Acupark I", "II" y "III". Para un parque concreto filtra por el nombre EXACTO ("nomParque" = \'Acupark II\') y NUNCA uses una subconsulta escalar que pueda devolver varias filas: usa JOIN.',
      '- Si una consulta devuelve error, LÉELO y corrige el SQL (no repitas el mismo). NO inventes cifras: consulta el dato. Muestra los resultados con claridad (tablas markdown si son varios).',
    ].join('\n');
  }

  /** Enruta la ejecución de las herramientas de datos. */
  async ejecutar(
    nombre: string,
    args: Record<string, unknown>,
    perfil: PerfilDiag,
    uid: string,
  ): Promise<unknown> {
    if (nombre === 'describir_tablas') return this.describirTablas(args, perfil);
    if (nombre === 'consultar_datos') return this.consultarDatos(args, perfil, uid);
    return { error: `Herramienta desconocida: ${nombre}` };
  }

  private async describirTablas(args: Record<string, unknown>, perfil: PerfilDiag): Promise<unknown> {
    const universo = this.universo(perfil);
    const pedidas = Array.isArray(args.tablas)
      ? (args.tablas as unknown[]).map(String).filter((t) => universo.has(t))
      : [];
    if (pedidas.length === 0) {
      return { error: 'Indica tablas válidas de la lista disponible (a las que el usuario tiene acceso).' };
    }
    const { data, error } = await this.supabase.admin.rpc(
      'agente_esquema' as never,
      { p_tablas: pedidas } as never,
    );
    if (error) {
      this.logger.error(`describir_tablas: ${error.message}`);
      return { error: 'No se pudo obtener el esquema.' };
    }
    return { tablas: data ?? {} };
  }

  private async consultarDatos(
    args: Record<string, unknown>,
    perfil: PerfilDiag,
    uid: string,
  ): Promise<unknown> {
    const consulta = typeof args.consulta === 'string' ? args.consulta : '';
    const universo = this.universo(perfil);
    if (universo.size === 0) {
      return { error: 'sin_permiso', mensaje: 'El usuario no tiene acceso a módulos de datos.' };
    }
    const val = this.validarSelect(consulta);
    if (!val.ok) return { error: val.motivo };

    const fuera = this.tablasFueraDeUniverso(consulta, universo);
    if (fuera.length > 0) {
      return {
        error: 'fuera_de_alcance',
        mensaje: `La consulta usa tablas a las que el usuario no tiene acceso: ${fuera.join(', ')}.`,
      };
    }

    const { data, error } = await this.supabase
      .agenteRo(uid)
      .rpc('agente_consulta_sql' as never, { query: consulta } as never);
    if (error) {
      this.logger.warn(`consultar_datos: ${error.message}`);
      // Se devuelve el error REAL de Postgres al MODELO (no al usuario final) para que
      // pueda CORREGIR el SQL y reintentar. El usuario solo ve la respuesta redactada.
      let pista = '';
      if (/more than one row/i.test(error.message)) {
        pista =
          ' PISTA: una subconsulta escalar devolvió varias filas (p. ej. buscar un parque por ILIKE coincide con "Acupark I/II/III"). Usa un JOIN en lugar de la subconsulta, o filtra por el nombre EXACTO.';
      } else if (/column .* does not exist/i.test(error.message)) {
        pista =
          ' PISTA: revisa los nombres camelCase (deben ir entre comillas dobles) usando describir_tablas.';
      }
      return { error: `La consulta falló: ${error.message}.${pista} Corrige el SQL y reintenta.` };
    }
    const filas = Array.isArray(data) ? data : data ? [data] : [];
    return { total_filas: filas.length, filas };
  }

  /** Validación de SOLO SELECT (defensa temprana; la RPC también valida). */
  private validarSelect(raw: string): { ok: boolean; motivo: string } {
    const sql = (raw || '').trim().replace(/;\s*$/, '').trim();
    const up = sql.replace(/\s+/g, ' ').toUpperCase();
    if (!sql) return { ok: false, motivo: 'Consulta vacía.' };
    if (!(up.startsWith('SELECT ') || up.startsWith('WITH '))) {
      return { ok: false, motivo: 'Solo se permiten consultas SELECT.' };
    }
    if (/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|COPY|VACUUM|CALL|MERGE|REFRESH|SET|RESET)\b/.test(up)) {
      return { ok: false, motivo: 'Operación no permitida (solo lectura).' };
    }
    if (sql.includes('--') || sql.includes('/*') || sql.includes(';')) {
      return { ok: false, motivo: 'Sintaxis no permitida (comentarios o múltiples sentencias).' };
    }
    return { ok: true, motivo: '' };
  }

  /**
   * Extrae TODAS las relaciones referenciadas (FROM/JOIN, incluidas las separadas por
   * COMA, subconsultas y CTEs) y devuelve las que NO están en el universo permitido por
   * las claves del usuario. Excluye los nombres de CTE.
   *
   * ⚠️ Barreras de seguridad (defensa en profundidad), de mayor a menor robustez:
   *  1) El rol `v2_agente_ro` solo tiene SELECT sobre tablas/vistas de NEGOCIO
   *     (lista BLANCA) y nunca sistema/secretos → barrera DURA en la BD.
   *  2) La RPC bloquea funciones que ejecutan SQL/IO desde texto (query_to_xml, etc.).
   *  3) Este parser acota POR MÓDULO (clave del usuario). Es best-effort textual.
   * 📌 DEUDA: migrar este parser a uno SQL real (o validación por plan EXPLAIN con
   *    expansión de vistas) para blindar al 100% el aislamiento entre módulos.
   */
  private tablasFueraDeUniverso(sql: string, universo: Set<string>): string[] {
    // Quitar literales de texto para no confundir comas/paréntesis internos, y
    // NORMALIZAR: garantizar un espacio tras FROM/JOIN aunque el identificador venga
    // pegado (p. ej. `FROM"cxp"`, sintaxis válida en Postgres) — así el parser no se lo
    // salta y no se evade el acotamiento por módulo (mitiga el bypass del validador).
    const limpio = sql
      .replace(/'[^']*'/g, "''")
      .replace(/\b(from|join)\b(?=[^\s(,])/gi, '$1 ');

    const ctes = new Set<string>();
    for (const m of limpio.matchAll(/\bwith\s+("?[\w]+"?)\s+as\b|,\s*("?[\w]+"?)\s+as\s*\(/gi)) {
      const n = (m[1] ?? m[2] ?? '').replace(/"/g, '').toLowerCase();
      if (n) ctes.add(n);
    }

    const refs = new Set<string>();
    const tomarId = (txt: string) => {
      const t = txt.trim();
      if (!t || t.startsWith('(')) return; // subconsulta: su FROM interno se captura aparte
      // tabla, opcionalmente esquema.tabla; ignora alias posterior
      const m = /^("?[A-Za-z_][\w]*"?)(?:\.("?[A-Za-z_][\w]*"?))?/.exec(t);
      if (m) {
        const id = (m[2] ?? m[1] ?? '').replace(/"/g, '');
        if (id) refs.add(id);
      }
    };
    // JOIN <tabla>
    for (const m of limpio.matchAll(/\bjoin\s+([^\s(]+)/gi)) tomarId(m[1] ?? '');
    // FROM <lista separada por comas> (hasta la siguiente cláusula)
    for (const m of limpio.matchAll(
      /\bfrom\s+([\s\S]+?)(?=\b(?:where|group|order|having|limit|offset|union|intersect|except|join|on)\b|\)|$)/gi,
    )) {
      for (const item of (m[1] ?? '').split(',')) tomarId(item);
    }

    const fuera = new Set<string>();
    for (const cruda of refs) {
      const lower = cruda.toLowerCase();
      if (!cruda || ctes.has(lower) || NO_TABLAS.has(lower)) continue;
      if (!universo.has(cruda)) fuera.add(cruda);
    }
    return [...fuera];
  }
}
