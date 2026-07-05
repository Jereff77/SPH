import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import type { ClienteDto, TipoCliente } from './clientes.schemas.js';
import {
  baseRfc,
  esRfcGenerico,
  letrasBaseRfc,
  normalizarRfc,
} from './rfc.util.js';

/**
 * Una coincidencia de RFC en la verificación de duplicados: lo mínimo para el aviso
 * (sin PII innecesaria de terceros). Para editar el existente se recarga con `obtener`.
 */
export interface RfcCoincidencia {
  idInversionista: string;
  razonsocial: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  RFC: string | null;
  inversionista: boolean;
  arrendatario: boolean;
  ticket: boolean;
  usuarioFinal: boolean;
  pruebas: boolean;
  /** 'exacto' = RFC completo igual; 'base' = misma base, homoclave distinta/faltante. */
  tipoCoincidencia: 'exacto' | 'base';
}

/** Una propiedad/nave ligada al cliente (sin montos: solo "qué tiene + estado"). */
export interface VinculoNave {
  /** Para navegar a Ventas → Planes (`?inversionista=&propiedad=`). */
  idPropiedad: string;
  nave: string;
  parque: string;
  situacion: string;
  estadoPlan: string;
}

/** Una nave que el cliente renta (arrendatario), con la vigencia de su plan de renta. */
export interface VinculoRenta {
  /** Para navegar a Arrendatarios → Planes (`?arrendador=&nave=`). */
  idNavArrend: string;
  nave: string;
  parque: string;
  situacion: string;
  estadoPlan: string;
  vigencia: string | null;
}

/** Un documento del cliente (tabla `inversionista_docs`). */
export interface VinculoDoc {
  titulo: string;
  descripcion: string;
  fecha: string | null;
}

/** Panorama de todo lo que el cliente tiene ligado (para el panel del sheet de edición). */
export interface ClienteVinculos {
  propiedades: VinculoNave[];
  tickets: VinculoNave[];
  rentas: VinculoRenta[];
  documentos: VinculoDoc[];
  otros: { recurso: string; cantidad: number }[];
}

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const COLS =
  'idInversionista, personalidad, idContpac, razonsocial, nombre, apellido1, apellido2, fecNacimiento, telefono, correo, RFC, CURP, inversionista, arrendatario, ticket, usuarioFinal, pruebas';

/**
 * Columnas mínimas para la verificación de RFC: lo justo para el aviso de duplicado
 * (identificar a la persona y sus tipos). NO expone PII innecesaria de terceros
 * (CURP/correo/teléfono/fecha de nacimiento); para editar el existente se recarga
 * por `obtener(id)`.
 */
const COLS_VERIF =
  'idInversionista, razonsocial, nombre, apellido1, apellido2, RFC, inversionista, arrendatario, ticket, usuarioFinal, pruebas';

/**
 * Clientes (clave 300). Migra la pantalla "Clientes" del CRM de v1 a una sección
 * directa. Opera sobre la tabla `inversionista` (un mismo registro puede ser
 * inversionista, arrendatario, ticket y/o usuario final). Escrituras auditadas.
 */
@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private generarId(n = 15): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  /** Listado por tipo (chip), ordenado por razón social. */
  async listar(tipo: TipoCliente) {
    let q = this.supabase.admin.from('inversionista').select(COLS);
    switch (tipo) {
      case 'todos':
        // Padrón completo (sin filtro): la vista unificada resuelve tipo por columna.
        break;
      case 'inversionistas':
        q = q.eq('inversionista', true);
        break;
      case 'arrendatarios':
        q = q.eq('arrendatario', true);
        break;
      case 'ticket':
        q = q.eq('ticket', true);
        break;
      case 'usuarioFinal':
        q = q.eq('usuarioFinal', true);
        break;
      case 'papelera':
        // Papelera = de prueba, o sin ningún tipo asignado (como v1).
        q = q.or(
          'pruebas.eq.true,and(inversionista.eq.false,arrendatario.eq.false,ticket.eq.false)',
        );
        break;
    }
    const { data, error } = await q.order('razonsocial', {
      ascending: true,
      nullsFirst: false,
    });
    if (error) fallaBd(this.logger, 'clientes.listar', error);
    return data ?? [];
  }

  /**
   * Ids de clientes con al menos una **nave ligada VIVA** — propiedad como dueño
   * (`propiedades`) o nave rentada (`arrenPropiedades`), ambas `status=true`. Se usa
   * para resaltar en la Papelera los que aún tienen recursos atrapados (no eliminables).
   */
  async idsConVinculos(): Promise<string[]> {
    const admin = this.supabase.admin;
    const [props, rentas] = await Promise.all([
      admin.from('propiedades').select('idInversionista').eq('status', true),
      admin.from('arrenPropiedades').select('idArrendador').eq('status', true),
    ]);
    if (props.error) fallaBd(this.logger, 'clientes.idsConVinculos (propiedades)', props.error);
    if (rentas.error) fallaBd(this.logger, 'clientes.idsConVinculos (rentas)', rentas.error);
    const set = new Set<string>();
    for (const p of props.data ?? []) if (p.idInversionista) set.add(p.idInversionista);
    for (const r of rentas.data ?? []) if (r.idArrendador) set.add(r.idArrendador);
    return [...set];
  }

  /** Carga un cliente completo por id (para abrir/editar el existente desde un aviso). */
  async obtener(id: string) {
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select(COLS)
      .eq('idInversionista', id)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'clientes.obtener', error);
    if (!data) throw new NotFoundException('Cliente no encontrado.');
    return data;
  }

  /** Campos editables del cliente (sin las llaves ni auditoría). */
  private camposDe(dto: ClienteDto) {
    return {
      nombre: dto.nombre,
      apellido1: dto.apellido1,
      apellido2: dto.apellido2,
      telefono: dto.telefono,
      correo: dto.correo || null,
      RFC: dto.RFC,
      CURP: dto.CURP,
      idContpac: dto.idContpac,
      razonsocial: dto.razonsocial || null,
      personalidad: dto.personalidad || null,
      fecNacimiento: dto.fecNacimiento || null,
      inversionista: dto.inversionista,
      arrendatario: dto.arrendatario,
      ticket: dto.ticket,
      usuarioFinal: dto.usuarioFinal,
    };
  }

  /**
   * Busca clientes con el MISMO RFC (por base) en TODA la tabla `inversionista`,
   * sin filtrar por tipo ni por `pruebas`. Soporta homoclave faltante/distinta.
   */
  async verificarRfc(
    rfc: string,
    excluirId?: string,
  ): Promise<{ generico: boolean; coincidencias: RfcCoincidencia[] }> {
    const base = baseRfc(rfc);
    const generico = esRfcGenerico(rfc);
    if (!base) return { generico, coincidencias: [] };

    // Acotamos por la parte alfabética de la base (3-4 letras) y afinamos por base.
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select(COLS_VERIF)
      .ilike('RFC', `${letrasBaseRfc(rfc)}%`);
    if (error) fallaBd(this.logger, 'clientes.verificarRfc', error);

    const rfcNorm = normalizarRfc(rfc);
    const coincidencias: RfcCoincidencia[] = [];
    for (const r of data ?? []) {
      if (excluirId && r.idInversionista === excluirId) continue;
      if (baseRfc(r.RFC) !== base) continue;
      coincidencias.push({
        ...(r as Omit<RfcCoincidencia, 'tipoCoincidencia'>),
        tipoCoincidencia:
          normalizarRfc(r.RFC) === rfcNorm ? 'exacto' : 'base',
      });
    }
    return { generico, coincidencias };
  }

  /**
   * Red de seguridad server-side: rechaza RFC genérico y duplicados. El match
   * EXACTO siempre se bloquea (es el mismo cliente → editarlo, no recrearlo). El
   * match de solo BASE (homoclave distinta) se permite si el usuario lo confirmó.
   */
  private async asegurarRfcUnico(
    rfc: string,
    permitirSimilar: boolean,
    excluirId?: string,
  ): Promise<void> {
    if (esRfcGenerico(rfc)) {
      throw new BadRequestException(
        'El RFC genérico no está permitido. Captura el RFC real del cliente.',
      );
    }
    const { coincidencias } = await this.verificarRfc(rfc, excluirId);
    const nombreDe = (c: RfcCoincidencia) =>
      c.razonsocial?.trim() ||
      [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(' ') ||
      'otro cliente';

    const exacta = coincidencias.find((c) => c.tipoCoincidencia === 'exacto');
    if (exacta) {
      throw new ConflictException(
        `Ya existe un cliente con este RFC: ${nombreDe(exacta)}. Abre su registro y edítalo en lugar de crear uno nuevo.`,
      );
    }
    const similar = coincidencias.find((c) => c.tipoCoincidencia === 'base');
    if (similar && !permitirSimilar) {
      throw new ConflictException(
        `Hay un cliente con un RFC muy parecido: ${nombreDe(similar)} (difiere la homoclave). Verifica si es la misma persona.`,
      );
    }
  }

  async crear(dto: ClienteDto, actorUid: string): Promise<{ idInversionista: string }> {
    await this.asegurarRfcUnico(dto.RFC, dto.permitirSimilar);
    const idInversionista = this.generarId(15);
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista')
      .insert({
        idInversionista,
        idUser: actorUid,
        status: true,
        pruebas: false,
        ...this.camposDe(dto),
      });
    if (error) fallaBd(this.logger, 'clientes.crear', error);
    return { idInversionista };
  }

  async actualizar(id: string, dto: ClienteDto, actorUid: string): Promise<void> {
    await this.asegurarRfcUnico(dto.RFC, dto.permitirSimilar, id);
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista')
      .update(this.camposDe(dto))
      .eq('idInversionista', id);
    if (error) fallaBd(this.logger, 'clientes.actualizar', error);
  }

  /**
   * Ataduras VIVAS que impedirían archivar (mandar a la papelera) al cliente:
   * naves/propiedades/planes que quedarían huérfanos. Solo lectura (conteos por
   * tabla, en paralelo). El HISTORIAL (pagos, facturas, incidentes, documentos,
   * comentarios) NO bloquea archivar. Diseñado para reutilizarse a futuro por el
   * borrado físico (que exigirá cero ataduras de CUALQUIER tabla).
   */
  async dependenciasBloqueantes(
    id: string,
  ): Promise<{ recurso: string; cantidad: number; modulo: string }[]> {
    const admin = this.supabase.admin;
    const defs: {
      recurso: string;
      modulo: string;
      q: PromiseLike<{ count: number | null; error: unknown }>;
    }[] = [
      {
        recurso: 'Propiedades',
        modulo: 'Ventas',
        q: admin
          .from('propiedades')
          .select('*', { count: 'exact', head: true })
          .eq('idInversionista', id)
          .eq('status', true),
      },
      {
        recurso: 'Plan de pagos',
        modulo: 'Ventas → Planes',
        q: admin
          .from('pdpDetalle')
          .select('*', { count: 'exact', head: true })
          .eq('idInversionista', id)
          .eq('status', true),
      },
      {
        recurso: 'Naves rentadas',
        modulo: 'Arrendatarios',
        q: admin
          .from('arrenPropiedades')
          .select('*', { count: 'exact', head: true })
          .eq('idArrendador', id)
          .eq('status', true),
      },
      {
        recurso: 'Plan de renta',
        modulo: 'Arrendatarios',
        q: admin
          .from('arrePdp')
          .select('*', { count: 'exact', head: true })
          .eq('idArrendador', id)
          .eq('status', true)
          // Un plan ya terminado (arrePdpVigente='No') no es un recurso vivo:
          // no debe bloquear el archivado del cliente.
          .neq('arrePdpVigente', 'No'),
      },
    ];
    const res = await Promise.all(
      defs.map(async (d) => {
        const { count, error } = await d.q;
        if (error) fallaBd(this.logger, 'clientes.dependenciasBloqueantes', error);
        return { recurso: d.recurso, cantidad: count ?? 0, modulo: d.modulo };
      }),
    );
    return res.filter((r) => r.cantidad > 0);
  }

  /**
   * Detalle de TODO lo que el cliente tiene ligado (para el panel del sheet de
   * edición): propiedades que posee, naves que renta, tickets, y otros vínculos
   * (solo conteos). **SOLO LECTURA y SIN MONTOS** — las cifras financieras viven en
   * Ventas (clave 610); aquí solo el "qué tiene + estado". Se reúne con consultas
   * separadas + unión en memoria (patrón de la casa; no depende de FKs).
   */
  async vinculosDe(id: string): Promise<ClienteVinculos> {
    const admin = this.supabase.admin;

    const [propsRes, rentasRes, docsRes] = await Promise.all([
      admin
        .from('propiedades')
        .select('idPropiedad, idNave, idParque, esTicket, pdpActivo, idPdp')
        .eq('idInversionista', id)
        .eq('status', true),
      admin
        .from('arrenPropiedades')
        .select('idNavArrend, idNave, idParque, pdpActivo, idArrePdp, tienePdp')
        .eq('idArrendador', id)
        .eq('status', true),
      admin
        .from('inversionista_docs')
        .select('titulo, descripcion, fc')
        .eq('idInversionista', id)
        .eq('status', true)
        .order('fc', { ascending: false }),
    ]);
    if (propsRes.error) fallaBd(this.logger, 'clientes.vinculosDe (propiedades)', propsRes.error);
    if (rentasRes.error) fallaBd(this.logger, 'clientes.vinculosDe (rentas)', rentasRes.error);
    if (docsRes.error) fallaBd(this.logger, 'clientes.vinculosDe (documentos)', docsRes.error);
    const propsList = propsRes.data ?? [];
    const rentasList = rentasRes.data ?? [];

    const documentos: VinculoDoc[] = (docsRes.data ?? []).map((d) => ({
      titulo: d.titulo || 'Documento sin título',
      descripcion: d.descripcion ?? '',
      fecha: d.fc ? String(d.fc).slice(0, 10) : null,
    }));

    // Resolver nombres de nave/parque y la vigencia de las rentas.
    const idsNave = [
      ...new Set([...propsList, ...rentasList].map((x) => x.idNave).filter((v): v is string => !!v)),
    ];
    const idsParque = [
      ...new Set([...propsList, ...rentasList].map((x) => x.idParque).filter((v): v is string => !!v)),
    ];
    const idsArrePdp = [
      ...new Set(rentasList.map((r) => r.idArrePdp).filter((v): v is string => !!v)),
    ];

    const [navesRes, parquesRes, arrePdpRes] = await Promise.all([
      idsNave.length
        ? admin.from('naves').select('idNave, numNave, numNaveNAME, situacion').in('idNave', idsNave)
        : null,
      idsParque.length
        ? admin.from('parques').select('idParque, nomParque').in('idParque', idsParque)
        : null,
      idsArrePdp.length
        ? admin.from('arrePdp').select('idArrePdp, arrePdpVigente').in('idArrePdp', idsArrePdp)
        : null,
    ]);
    if (navesRes?.error) fallaBd(this.logger, 'clientes.vinculosDe (naves)', navesRes.error);
    if (parquesRes?.error) fallaBd(this.logger, 'clientes.vinculosDe (parques)', parquesRes.error);
    if (arrePdpRes?.error) fallaBd(this.logger, 'clientes.vinculosDe (arrePdp)', arrePdpRes.error);

    const naveMap = new Map((navesRes?.data ?? []).map((n) => [n.idNave, n] as const));
    const parqueMap = new Map((parquesRes?.data ?? []).map((p) => [p.idParque, p.nomParque] as const));
    const arrePdpMap = new Map((arrePdpRes?.data ?? []).map((a) => [a.idArrePdp, a] as const));

    const nombreNave = (idNave: string | null): string => {
      const n = idNave ? naveMap.get(idNave) : undefined;
      return n?.numNaveNAME || (n?.numNave != null ? `Nave ${n.numNave}` : '—');
    };
    const situacionDe = (idNave: string | null): string =>
      (idNave ? naveMap.get(idNave)?.situacion : null) ?? '—';
    const parqueDe = (idParque: string | null): string =>
      (idParque ? parqueMap.get(idParque) : null) ?? '—';

    const propiedades: VinculoNave[] = [];
    const tickets: VinculoNave[] = [];
    for (const p of propsList) {
      const item: VinculoNave = {
        idPropiedad: p.idPropiedad,
        nave: nombreNave(p.idNave),
        parque: parqueDe(p.idParque),
        situacion: situacionDe(p.idNave),
        estadoPlan: p.idPdp ? (p.pdpActivo ? 'Plan activo' : 'Con plan (inactivo)') : 'Sin plan',
      };
      (p.esTicket ? tickets : propiedades).push(item);
    }

    const rentas: VinculoRenta[] = rentasList.map((r) => ({
      idNavArrend: r.idNavArrend,
      nave: nombreNave(r.idNave),
      parque: parqueDe(r.idParque),
      situacion: situacionDe(r.idNave),
      estadoPlan: r.tienePdp
        ? r.pdpActivo
          ? 'Renta activa'
          : 'Con plan de renta'
        : 'Sin plan de renta',
      vigencia: (r.idArrePdp ? arrePdpMap.get(r.idArrePdp)?.arrePdpVigente : null) ?? null,
    }));

    // Otros vínculos (panorama; solo conteos de historial).
    const otrosDefs: {
      recurso: string;
      q: PromiseLike<{ count: number | null; error: unknown }>;
    }[] = [
      {
        recurso: 'Facturas',
        q: admin.from('catFacturas').select('*', { count: 'exact', head: true }).eq('idInversionista', id),
      },
      {
        recurso: 'Incidentes de soporte',
        q: admin.from('incidentes').select('*', { count: 'exact', head: true }).eq('idArrendador', id),
      },
    ];
    const otros = (
      await Promise.all(
        otrosDefs.map(async (d) => {
          const { count, error } = await d.q;
          if (error) fallaBd(this.logger, 'clientes.vinculosDe (otros)', error);
          return { recurso: d.recurso, cantidad: count ?? 0 };
        }),
      )
    ).filter((o) => o.cantidad > 0);

    return { propiedades, tickets, rentas, documentos, otros };
  }

  /** Saca al cliente de la papelera (restaura): `pruebas=false`. Queda "Sin
   *  clasificar" (sin tipo) hasta que se le asigne uno. Auditado. */
  async restaurar(id: string, actorUid: string): Promise<void> {
    const { data, error: selErr } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista')
      .eq('idInversionista', id)
      .maybeSingle();
    if (selErr) fallaBd(this.logger, 'clientes.restaurar (select)', selErr);
    if (!data) throw new NotFoundException('Cliente no encontrado.');

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista')
      .update({ pruebas: false })
      .eq('idInversionista', id);
    if (error) fallaBd(this.logger, 'clientes.restaurar', error);
  }

  /** Mueve el cliente a la papelera (replica v1: limpia tipos y marca prueba). */
  async moverPapelera(id: string, actorUid: string): Promise<void> {
    const { data, error: selErr } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista')
      .eq('idInversionista', id)
      .maybeSingle();
    if (selErr) fallaBd(this.logger, 'clientes.moverPapelera (select)', selErr);
    if (!data) throw new NotFoundException('Cliente no encontrado.');

    // Guardia anti-huérfanos: no archivar si tiene recursos vivos ligados.
    const bloqueos = await this.dependenciasBloqueantes(id);
    if (bloqueos.length > 0) {
      const detalle = bloqueos.map((b) => `${b.recurso} (${b.cantidad})`).join(', ');
      throw new ConflictException(
        `No se puede mandar a la papelera: el cliente todavía tiene ${detalle}. ` +
          'Desvincúlalo primero en el módulo correspondiente y vuelve a intentarlo.',
      );
    }

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista')
      .update({
        pruebas: true,
        tipoCliente: '0001',
        inversionista: false,
        arrendatario: false,
        ticket: false,
        usuarioFinal: false,
      })
      .eq('idInversionista', id);
    if (error) fallaBd(this.logger, 'clientes.moverPapelera', error);
  }
}
