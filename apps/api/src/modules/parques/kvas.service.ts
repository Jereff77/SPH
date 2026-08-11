import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { fallaBd } from '../../common/utils/db-error.js';
import { rutaSegura, type ArchivoValidado } from '../../common/utils/archivo-seguro.js';
import { DIAS_COMPROMISO } from './kvas.schemas.js';
import type {
  AcometidaDto,
  CrearAsignacionDto,
  DevolucionDto,
  DocumentoNaveDto,
  EditarAsignacionDto,
} from './kvas.schemas.js';

/** Bucket PRIVADO de los documentos de devolución (se sirve con URL firmada). */
const BUCKET_KVA = 'kvaDocs';
/** Vigencia de la URL firmada del documento (1 hora). */
const FIRMA_SEGUNDOS = 3600;

/** Quién ocupa la nave: el inquilino manda; si no hay, el dueño. */
export type OcupanteTipo = 'ARRENDATARIO' | 'INVERSIONISTA';

/** Documento del expediente de KVA de una nave. */
export interface DocumentoNave {
  idDoc: string;
  idNave: string;
  titulo: string;
  descripcion: string | null;
  /** URL FIRMADA temporal (el bucket es privado). */
  urldoc: string | null;
  status: boolean;
  motivoBaja: string | null;
  fc: string;
}

export interface AsignacionKva {
  idKvas: string;
  idParque: string;
  idNave: string;
  /** Etiqueta visible de la nave (`numNaveNAME`), resuelta aparte. */
  nave: string | null;
  numNave: number | null;
  /** Empresa arrendataria o, si no está arrendada, razón social del dueño. */
  ocupante: string | null;
  ocupanteTipo: OcupanteTipo | null;
  /** Documentos vivos del expediente de la nave (contador + tooltip). */
  docsTotal: number;
  docsTitulos: string[];
  nivel: string;
  figura: string;
  etapa: string;
  cantKvas: number;
  cantDevuelta: number;
  /** Lo que sigue consumiendo del parque (ver `kva_consumo` en BD). */
  pendiente: number;
  contratoCfe: string | null;
  fechaContratoCfe: string | null;
  status: boolean;
  fc: string;
}

/**
 * Desglose de UNA bolsa (media o baja) de un parque, con la misma lectura que
 * el control operativo en Excel: cuánto se repartió, en qué etapa del trámite
 * con CFE va y bajo qué figura (vendido / rentado).
 */
export interface DesgloseNivelKva {
  /** Capacidad del parque en esta bolsa. */
  total: number;
  /** Σ dotación de sus naves: lo reservado por disposición del parque. */
  dotado: number;
  /** Capacidad que no está dotada a ninguna nave (`total − dotado`). */
  sinDotar: number;
  /** Repartido a naves, por etapa del trámite. */
  asignado: number;
  comprometido: number;
  /** `dotado − asignado − comprometido`: dotación todavía sin dueño. */
  porAsignar: number;
  /** Repartido a naves, por figura. */
  venta: number;
  renta: number;
  /** Ya regresado al parque con documento (solo aplica a VENTA). */
  devuelto: number;
  /** Lo que hoy consume del parque (`kva_consumo` en BD). */
  consumido: number;
  /** Puede ser NEGATIVO: sobregiro real. */
  disponible: number;
  /** Naves con al menos una asignación viva en esta bolsa. */
  naves: number;
}

export interface ResumenParqueKva {
  idParque: string;
  nomParque: string | null;
  idAcometida: string | null;
  kvasMt: number;
  kvasBt: number;
  kvasMtDisponibles: number;
  kvasBtDisponibles: number;
  kvasMtUtilizados: number;
  kvasBtUtilizados: number;
  /** Desglose estilo control operativo. MT = media, BT = baja. */
  mt: DesgloseNivelKva;
  bt: DesgloseNivelKva;
}

export interface Acometida {
  idAcometida: string;
  nombre: string;
  tensionKv: number | null;
  capacidadMt: number;
  capacidadBt: number;
  folioCfe: string | null;
  notas: string | null;
  /** Suma de lo repartido a sus parques (para detectar reparto excedido). */
  repartidoMt: number;
  repartidoBt: number;
  parques: ResumenParqueKva[];
}

type NivelBolsa = 'MT' | 'BT';
type BolsasKva = Record<NivelBolsa, DesgloseNivelKva>;

/**
 * Momento exacto de caducidad de un COMPROMETIDO: ahora + {@link DIAS_COMPROMISO}.
 * `null` para cualquier otra etapa — un CHECK de la BD exige justamente eso.
 *
 * ⚠️ Lleva HORA, no solo fecha: uno de los avisos sale **4 horas antes** del
 * borrado, y con granularidad de día no se le puede acertar a esa ventana.
 */
function vencimientoDe(etapa: string): string | null {
  if (etapa !== 'COMPROMETIDO') return null;
  const f = new Date();
  f.setDate(f.getDate() + DIAS_COMPROMISO);
  return f.toISOString();
}

const desgloseVacio = (): DesgloseNivelKva => ({
  total: 0,
  dotado: 0,
  sinDotar: 0,
  asignado: 0,
  comprometido: 0,
  porAsignar: 0,
  venta: 0,
  renta: 0,
  devuelto: 0,
  consumido: 0,
  disponible: 0,
  naves: 0,
});

/**
 * Administración de KVA's (capacidad eléctrica).
 *
 * Modelo (ver `base-conocimiento/PLAN-administracion-kvas.md`):
 * la ACOMETIDA es lo contratado con CFE y alimenta a uno o varios PARQUES;
 * cada parque reparte su capacidad entre sus NAVES en dos bolsas independientes
 * (MT = media, BT = baja).
 *
 * ⛔ El saldo (`kvas*Disponibles`) NO se toca desde aquí: lo recalcula la BD
 * (`kva_recalcular_disponibles`) en cada cambio de `kvasAsignados` o
 * `kvaDevoluciones`. Escribir el saldo a mano lo desincronizaría.
 *
 * Los disponibles pueden ser NEGATIVOS: es un sobregiro real y debe verse.
 */
@Injectable()
export class KvasService {
  private readonly logger = new Logger(KvasService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private readonly ASIG_COLS =
    'idKvas, idParque, idNave, nivel, figura, etapa, cantKvas, cantDevuelta, contratoCfe, fechaContratoCfe, status, fc';

  // ===================== Resumen =====================

  /**
   * Acometidas con sus parques, y los parques sin acometida asignada.
   *
   * Devuelve **todos** los parques activos, incluidos los que aún no tienen
   * capacidad ni asignaciones capturadas: en el tablero deben verse en ceros,
   * no desaparecer (así se ve qué falta por capturar).
   */
  async resumen(): Promise<{ acometidas: Acometida[]; sinAcometida: ResumenParqueKva[] }> {
    const [{ data: acom, error: errA }, { data: parques, error: errP }, { data: asig, error: errS }] =
      await Promise.all([
        this.supabase.admin
          .from('kvaAcometidas')
          .select('idAcometida, nombre, tensionKv, capacidadMt, capacidadBt, folioCfe, notas')
          .eq('status', true)
          .order('nombre')
          .range(0, 999),
        this.supabase.admin
          .from('parques')
          .select(
            'idParque, nomParque, idAcometida, kvasMt, kvasBt, kvasMtDisponibles, kvasBtDisponibles, kvasMtUtilizados, kvasBtUtilizados',
          )
          .eq('status', true)
          .eq('esTicket', false)
          .order('nomParque')
          .range(0, 999),
        // Se agrega en memoria (no en SQL) porque el universo es acotado: una
        // fila por nave × bolsa. Si algún día crece, pasar a RPC (ver DEUDA.md).
        this.supabase.admin
          .from('kvasAsignados')
          .select('idParque, idNave, nivel, figura, etapa, cantKvas, cantDevuelta, status')
          .range(0, 9999),
      ]);
    if (errA) fallaBd(this.logger, 'kvas.resumen.acometidas', errA);
    if (errP) fallaBd(this.logger, 'kvas.resumen.parques', errP);
    if (errS) fallaBd(this.logger, 'kvas.resumen.asignaciones', errS);

    const desgloses = this.desglosarPorParque(asig ?? []);
    const dotaciones = await this.dotacionPorParque();

    const porAcometida = new Map<string, ResumenParqueKva[]>();
    const sinAcometida: ResumenParqueKva[] = [];
    for (const p of parques ?? []) {
      const d = desgloses.get(p.idParque);
      const fila: ResumenParqueKva = {
        idParque: p.idParque,
        nomParque: p.nomParque,
        idAcometida: p.idAcometida,
        kvasMt: Number(p.kvasMt ?? 0),
        kvasBt: Number(p.kvasBt ?? 0),
        kvasMtDisponibles: Number(p.kvasMtDisponibles ?? 0),
        kvasBtDisponibles: Number(p.kvasBtDisponibles ?? 0),
        kvasMtUtilizados: Number(p.kvasMtUtilizados ?? 0),
        kvasBtUtilizados: Number(p.kvasBtUtilizados ?? 0),
        mt: this.armarBolsa(
          d?.MT,
          Number(p.kvasMt ?? 0),
          Number(p.kvasMtDisponibles ?? 0),
          dotaciones.get(p.idParque)?.mt ?? 0,
        ),
        bt: this.armarBolsa(
          d?.BT,
          Number(p.kvasBt ?? 0),
          Number(p.kvasBtDisponibles ?? 0),
          dotaciones.get(p.idParque)?.bt ?? 0,
        ),
      };
      if (!p.idAcometida) sinAcometida.push(fila);
      else porAcometida.set(p.idAcometida, [...(porAcometida.get(p.idAcometida) ?? []), fila]);
    }

    const acometidas: Acometida[] = (acom ?? []).map((a) => {
      const suyos = porAcometida.get(a.idAcometida) ?? [];
      return {
        idAcometida: a.idAcometida,
        nombre: a.nombre,
        tensionKv: a.tensionKv === null ? null : Number(a.tensionKv),
        capacidadMt: Number(a.capacidadMt ?? 0),
        capacidadBt: Number(a.capacidadBt ?? 0),
        folioCfe: a.folioCfe,
        notas: a.notas,
        repartidoMt: suyos.reduce((s, p) => s + p.kvasMt, 0),
        repartidoBt: suyos.reduce((s, p) => s + p.kvasBt, 0),
        parques: suyos,
      };
    });

    return { acometidas, sinAcometida };
  }

  /**
   * Σ dotación de las naves de cada parque. La dotación es lo reservado por
   * disposición del parque; lo entregado vive en `kvasAsignados`.
   */
  private async dotacionPorParque(): Promise<Map<string, { mt: number; bt: number }>> {
    const { data, error } = await this.supabase.admin
      .from('naves')
      .select('idParque, dotacionMt, dotacionBt')
      .eq('status', true)
      .range(0, 9999);
    if (error) fallaBd(this.logger, 'kvas.dotacionPorParque', error);

    const salida = new Map<string, { mt: number; bt: number }>();
    for (const n of data ?? []) {
      if (!n.idParque) continue;
      const acc = salida.get(n.idParque) ?? { mt: 0, bt: 0 };
      acc.mt += Number(n.dotacionMt ?? 0);
      acc.bt += Number(n.dotacionBt ?? 0);
      salida.set(n.idParque, acc);
    }
    return salida;
  }

  /**
   * Completa una bolsa con los datos que no salen de las asignaciones:
   * la capacidad, el saldo que calcula la BD, y lo dotado.
   *
   * `porAsignar` = dotado − asignado − comprometido: dotación que todavía no
   * tiene dueño. NO es lo mismo que `disponible`, que mide contra la capacidad
   * del parque e incluye lo que ni siquiera está dotado.
   */
  private armarBolsa(
    base: DesgloseNivelKva | undefined,
    capacidad: number,
    disponible: number,
    dotado: number,
  ): DesgloseNivelKva {
    const b = { ...(base ?? desgloseVacio()) };
    b.total = capacidad;
    b.disponible = disponible;
    b.dotado = dotado;
    b.sinDotar = capacidad - dotado;
    b.porAsignar = dotado - b.asignado - b.comprometido;
    return b;
  }

  /**
   * Agrupa las asignaciones por parque y bolsa.
   *
   * ⚠️ El CONSUMO replica `kva_consumo` de la BD, y debe seguir replicándolo:
   *   - Una VENTA sigue consumiendo aunque esté cancelada (solo la devolución
   *     acreditada la regresa al pool).
   *   - Una RENTA deja de consumir al cancelarse.
   * Los desgloses por etapa/figura, en cambio, solo cuentan asignaciones VIVAS.
   *
   * 📌 Ya no hay caso especial para `POR_ASIGNAR`: esa etapa desapareció en la
   * migración F5c. Lo que antes vivía ahí ahora es `naves.dotacion*`, y
   * `porAsignar` se calcula en `armarBolsa` — no se acumula aquí.
   */
  private desglosarPorParque(
    filas: {
      idParque: string;
      idNave: string;
      nivel: string;
      figura: string;
      etapa: string;
      cantKvas: number;
      cantDevuelta: number;
      status: boolean;
    }[],
  ): Map<string, BolsasKva> {
    const mapa = new Map<string, BolsasKva>();
    const naves = new Map<string, Set<string>>();

    for (const f of filas) {
      const nivel: NivelBolsa = f.nivel === 'MT' ? 'MT' : 'BT';
      let bolsas = mapa.get(f.idParque);
      if (!bolsas) {
        bolsas = { MT: desgloseVacio(), BT: desgloseVacio() };
        mapa.set(f.idParque, bolsas);
      }
      const d = bolsas[nivel];
      const cant = Number(f.cantKvas ?? 0);
      const devuelta = Number(f.cantDevuelta ?? 0);

      d.consumido +=
        f.figura === 'VENTA'
          ? Math.max(cant - devuelta, 0)
          : f.status
            ? cant
            : 0;
      if (f.figura === 'VENTA') d.devuelto += devuelta;

      if (f.status) {
        if (f.figura === 'VENTA') d.venta += cant;
        else d.renta += cant;
        if (f.etapa === 'ASIGNADO') d.asignado += cant;
        else if (f.etapa === 'COMPROMETIDO') d.comprometido += cant;

        const clave = `${f.idParque}|${nivel}`;
        let set = naves.get(clave);
        if (!set) {
          set = new Set<string>();
          naves.set(clave, set);
        }
        set.add(f.idNave);
      }
    }

    for (const [idParque, bolsas] of mapa) {
      bolsas.MT.naves = naves.get(`${idParque}|MT`)?.size ?? 0;
      bolsas.BT.naves = naves.get(`${idParque}|BT`)?.size ?? 0;
    }
    return mapa;
  }

  // ===================== Asignaciones =====================

  /** Asignaciones de un parque (incluye las canceladas, para el histórico). */
  async porParque(idParque: string): Promise<AsignacionKva[]> {
    const { data, error } = await this.supabase.admin
      .from('kvasAsignados')
      .select(this.ASIG_COLS)
      .eq('idParque', idParque)
      .order('fc', { ascending: false })
      .range(0, 4999);
    if (error) fallaBd(this.logger, 'kvas.porParque', error);
    return this.enriquecerConNaves(data ?? []);
  }

  /** Asignaciones de una nave concreta. */
  async porNave(idNave: string): Promise<AsignacionKva[]> {
    const { data, error } = await this.supabase.admin
      .from('kvasAsignados')
      .select(this.ASIG_COLS)
      .eq('idNave', idNave)
      .order('fc', { ascending: false })
      .range(0, 999);
    if (error) fallaBd(this.logger, 'kvas.porNave', error);
    return this.enriquecerConNaves(data ?? []);
  }

  /** Añade la etiqueta, el número y el ocupante de la nave a cada asignación. */
  private async enriquecerConNaves(
    filas: {
      idKvas: string;
      idParque: string;
      idNave: string;
      nivel: string;
      figura: string;
      etapa: string;
      cantKvas: number;
      cantDevuelta: number;
      contratoCfe: string | null;
      fechaContratoCfe: string | null;
      status: boolean;
      fc: string;
    }[],
  ): Promise<AsignacionKva[]> {
    const ids = [...new Set(filas.map((f) => f.idNave))];
    const naves = new Map<string, { nombre: string | null; num: number | null }>();
    if (ids.length > 0) {
      const { data, error } = await this.supabase.admin
        .from('naves')
        .select('idNave, numNaveNAME, numNave')
        .in('idNave', ids);
      if (error) fallaBd(this.logger, 'kvas.enriquecerConNaves', error);
      for (const n of data ?? [])
        naves.set(n.idNave, { nombre: n.numNaveNAME, num: n.numNave });
    }
    const [ocupantes, docs] = await Promise.all([
      this.ocupantesDeNaves(ids),
      this.conteoDocumentosPorNave(ids),
    ]);

    return filas.map((f) => ({
      ...f,
      cantKvas: Number(f.cantKvas ?? 0),
      cantDevuelta: Number(f.cantDevuelta ?? 0),
      pendiente: Number(f.cantKvas ?? 0) - Number(f.cantDevuelta ?? 0),
      nave: naves.get(f.idNave)?.nombre ?? null,
      numNave: naves.get(f.idNave)?.num ?? null,
      ocupante: ocupantes.get(f.idNave)?.nombre ?? null,
      ocupanteTipo: ocupantes.get(f.idNave)?.tipo ?? null,
      docsTotal: docs.get(f.idNave)?.total ?? 0,
      docsTitulos: docs.get(f.idNave)?.titulos ?? [],
    }));
  }

  /**
   * Quién está detrás de cada nave: la empresa que la tiene ARRENDADA y, si no
   * está arrendada, el INVERSIONISTA dueño.
   *
   * ⚠️ Gotcha del esquema: `arrenPropiedades.idArrendador` apunta a la MISMA
   * tabla `inversionista` (es un catálogo único de terceros con banderas
   * `inversionista` / `arrendatario` / `usuarioFinal`), no a una tabla aparte.
   */
  private async ocupantesDeNaves(
    idsNave: string[],
  ): Promise<Map<string, { nombre: string; tipo: OcupanteTipo }>> {
    const salida = new Map<string, { nombre: string; tipo: OcupanteTipo }>();
    if (idsNave.length === 0) return salida;

    const [{ data: arren, error: errA }, { data: props, error: errP }] = await Promise.all([
      this.supabase.admin
        .from('arrenPropiedades')
        .select('idNave, idArrendador')
        .in('idNave', idsNave)
        .eq('status', true)
        .range(0, 4999),
      this.supabase.admin
        .from('propiedades')
        .select('idNave, idInversionista')
        .in('idNave', idsNave)
        .eq('status', true)
        .range(0, 4999),
    ]);
    if (errA) fallaBd(this.logger, 'kvas.ocupantes.arrendatarios', errA);
    if (errP) fallaBd(this.logger, 'kvas.ocupantes.propiedades', errP);

    const porNave = new Map<string, { id: string; tipo: OcupanteTipo }>();
    // El inversionista es el respaldo: primero se siembra y el arrendatario lo pisa.
    for (const p of props ?? [])
      if (p.idNave && p.idInversionista)
        porNave.set(p.idNave, { id: p.idInversionista, tipo: 'INVERSIONISTA' });
    for (const a of arren ?? [])
      if (a.idNave && a.idArrendador)
        porNave.set(a.idNave, { id: a.idArrendador, tipo: 'ARRENDATARIO' });

    const idsTercero = [...new Set([...porNave.values()].map((v) => v.id))];
    if (idsTercero.length === 0) return salida;

    const { data: terceros, error: errT } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista, razonsocial, NomComercial, nombre')
      .in('idInversionista', idsTercero)
      .range(0, 4999);
    if (errT) fallaBd(this.logger, 'kvas.ocupantes.terceros', errT);

    const nombres = new Map<string, string>();
    for (const t of terceros ?? []) {
      const nombre = t.razonsocial?.trim() || t.NomComercial?.trim() || t.nombre?.trim();
      if (nombre) nombres.set(t.idInversionista, nombre);
    }
    for (const [idNave, v] of porNave) {
      const nombre = nombres.get(v.id);
      if (nombre) salida.set(idNave, { nombre, tipo: v.tipo });
    }
    return salida;
  }

  /**
   * Crea una asignación. El parque NO se recibe del cliente: se toma de la nave,
   * para que no se pueda descontar capacidad de un parque ajeno.
   */
  async crear(dto: CrearAsignacionDto, actorUid: string): Promise<{ idKvas: string }> {
    const idParque = await this.parqueDeNave(dto.idNave);
    this.validarVinculo(dto.figura, dto.idPropiedad, dto.idNavArrend);
    await this.exigirFiguraValida(dto.idNave, dto.figura);

    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('kvasAsignados')
      .insert({
        idNave: dto.idNave,
        idParque,
        nivel: dto.nivel,
        figura: dto.figura,
        etapa: dto.etapa,
        cantKvas: dto.cantKvas,
        contratoCfe: dto.contratoCfe ?? null,
        fechaContratoCfe: dto.fechaContratoCfe ?? null,
        idPropiedad: dto.idPropiedad ?? null,
        idNavArrend: dto.idNavArrend ?? null,
        venceCompromiso: vencimientoDe(dto.etapa),
        uidr: actorUid,
      })
      .select('idKvas')
      .single();
    if (error) fallaBd(this.logger, 'kvas.crear', error);
    return { idKvas: data!.idKvas };
  }

  /**
   * ⛔ A un arrendatario no se le VENDE (regla del negocio, 2026-08-08).
   *
   * Si la nave tiene arrendamiento vivo, la única figura posible es RENTA. El
   * front ya lo fija, pero se revalida aquí: es la única capa que no se puede
   * saltar, y una VENTA indebida además activaría el candado de devolución
   * sobre una nave que nunca debió tenerlo.
   *
   * Aplica solo a altas y ediciones; lo cargado antes de la regla se respeta.
   */
  private async exigirFiguraValida(idNave: string, figura: string): Promise<void> {
    if (figura !== 'VENTA') return;
    const { data, error } = await this.supabase.admin
      .from('arrenPropiedades')
      .select('idNavArrend')
      .eq('idNave', idNave)
      .eq('status', true)
      .limit(1);
    if (error) fallaBd(this.logger, 'kvas.exigirFiguraValida', error);
    if ((data ?? []).length > 0)
      throw new BadRequestException(
        'Esta nave está arrendada: a un arrendatario solo se le renta, no se le vende. Cambia la figura a «Rentado».',
      );
  }

  /**
   * Renueva un compromiso por otros {@link DIAS_COMPROMISO} días. Es la acción
   * que pide el correo de aviso antes de que el cron lo borre.
   */
  async renovarCompromiso(idKvas: string, actorUid: string): Promise<{ vence: string }> {
    const actual = await this.obtener(idKvas);
    if (!actual.status)
      throw new ConflictException('La asignación está cancelada.');
    if (actual.etapa !== 'COMPROMETIDO')
      throw new BadRequestException(
        'Solo se renuevan los KVA comprometidos: los ya asignados con CFE no caducan.',
      );

    const vence = vencimientoDe('COMPROMETIDO')!;
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('kvasAsignados')
      // Se limpian los dos avisos: el ciclo de notificación empieza de nuevo.
      .update({ venceCompromiso: vence, avisoPrevio: null, avisoFinal: null })
      .eq('idKvas', idKvas);
    if (error) fallaBd(this.logger, 'kvas.renovarCompromiso', error);
    return { vence };
  }

  /**
   * Edita una asignación viva. Las canceladas no se editan (histórico).
   *
   * ⛔ **Dos cambios aflojan el candado de devolución** y por eso exigen un
   * motivo escrito (decisión de Jereff, 2026-08-04):
   *   1. **Bajar la cantidad de una VENTA** — lo pendiente por devolver se
   *      reduce sin que nadie haya acreditado nada.
   *   2. **Pasar una VENTA a RENTA** — una renta no exige devolución, así que
   *      el faltante desaparece de golpe.
   * El motivo se guarda EN LA FILA a propósito: `fn_auditoria` audita el UPDATE
   * completo, así que en la auditoría el porqué queda junto al cambio que lo
   * motivó, no en un registro suelto.
   */
  async editar(
    idKvas: string,
    dto: EditarAsignacionDto,
    actorUid: string,
  ): Promise<void> {
    const actual = await this.obtener(idKvas);
    if (!actual.status)
      throw new ConflictException('La asignación está cancelada y no se puede editar.');
    if (dto.cantKvas < Number(actual.cantDevuelta))
      throw new BadRequestException(
        `No puedes dejar la asignación en ${dto.cantKvas} KVA: ya hay ${actual.cantDevuelta} devueltos y acreditados.`,
      );
    this.validarVinculo(dto.figura, dto.idPropiedad, dto.idNavArrend);
    await this.exigirFiguraValida(actual.idNave, dto.figura);

    const eraVenta = actual.figura === 'VENTA';
    const bajaCantidad = eraVenta && dto.cantKvas < Number(actual.cantKvas);
    const dejaDeSerVenta = eraVenta && dto.figura !== 'VENTA';
    const aflojaElCandado = bajaCantidad || dejaDeSerVenta;

    const motivo = dto.motivoAjuste?.trim();
    if (aflojaElCandado && !motivo)
      throw new BadRequestException(
        dejaDeSerVenta
          ? 'Cambiar una venta a renta libera los KVA sin devolución acreditada. Escribe el motivo del ajuste.'
          : `Bajar una venta de ${actual.cantKvas} a ${dto.cantKvas} KVA reduce lo pendiente por devolver sin documento. Escribe el motivo del ajuste, o registra una Devolución si los KVA sí regresaron al parque.`,
      );

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('kvasAsignados')
      .update({
        nivel: dto.nivel,
        figura: dto.figura,
        etapa: dto.etapa,
        cantKvas: dto.cantKvas,
        contratoCfe: dto.contratoCfe ?? null,
        fechaContratoCfe: dto.fechaContratoCfe ?? null,
        idPropiedad: dto.idPropiedad ?? null,
        idNavArrend: dto.idNavArrend ?? null,
        // El vencimiento sigue a la etapa: si pasa a ASIGNADO se limpia (un
        // CHECK de la BD lo exige), y si sigue COMPROMETIDO se conserva el que
        // tenía — editar no es renovar.
        venceCompromiso:
          dto.etapa === 'COMPROMETIDO'
            ? (actual.venceCompromiso ?? vencimientoDe('COMPROMETIDO'))
            : null,
        // Solo se sella cuando el cambio lo amerita; una edición inocua no
        // arrastra el motivo de un ajuste anterior.
        ...(aflojaElCandado ? { motivoAjuste: motivo } : {}),
      })
      .eq('idKvas', idKvas);
    if (error) fallaBd(this.logger, 'kvas.editar', error);
  }

  /**
   * Cancela una asignación (BAJA LÓGICA con motivo, como el resto del sistema).
   *
   * ⚠️ Cancelar NO devuelve los KVA vendidos al parque: una VENTA solo regresa
   * al pool con una devolución acreditada (`kvaDevoluciones`). En RENTA sí
   * regresan, porque el vínculo terminó.
   */
  async cancelar(idKvas: string, motivo: string, actorUid: string): Promise<void> {
    const actual = await this.obtener(idKvas);
    if (!actual.status)
      throw new ConflictException('La asignación ya estaba cancelada.');

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('kvasAsignados')
      .update({ status: false, motivoBaja: motivo })
      .eq('idKvas', idKvas);
    if (error) fallaBd(this.logger, 'kvas.cancelar', error);
  }

  // ===================== Devoluciones =====================

  /**
   * Registra la devolución de KVA VENDIDOS con su documento probatorio. Es lo
   * que libera el candado de la nave.
   */
  async registrarDevolucion(
    idKvas: string,
    dto: DevolucionDto,
    archivo: ArchivoValidado,
    actorUid: string,
  ): Promise<{ idDevolucion: string }> {
    const asig = await this.obtener(idKvas);
    if (asig.figura !== 'VENTA')
      throw new BadRequestException(
        'Solo se documenta la devolución de KVA vendidos; los rentados regresan al cerrar el contrato.',
      );
    const pendiente = Number(asig.cantKvas) - Number(asig.cantDevuelta);
    if (dto.cantidad > pendiente)
      throw new BadRequestException(
        `Solo quedan ${pendiente} KVA por devolver en esta asignación.`,
      );

    const ruta = rutaSegura([asig.idParque, idKvas], archivo.ext);
    const { error: errUp } = await this.supabase.admin.storage
      .from(BUCKET_KVA)
      .upload(ruta, archivo.buffer, {
        contentType: archivo.contentType,
        upsert: false,
      });
    if (errUp) fallaBd(this.logger, 'kvas.devolucion.upload', errUp, 'No se pudo subir el documento.');

    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('kvaDevoluciones')
      .insert({
        idKvas,
        cantidad: dto.cantidad,
        fechaDevolucion: dto.fechaDevolucion,
        documento: dto.documento,
        urldoc: ruta, // se guarda la RUTA; la URL se firma al leer
        observaciones: dto.observaciones ?? null,
        uidr: actorUid,
      })
      .select('idDevolucion')
      .single();
    if (error) {
      // El archivo ya se subió: se limpia para no dejar huérfanos en el bucket.
      await this.supabase.admin.storage.from(BUCKET_KVA).remove([ruta]);
      fallaBd(this.logger, 'kvas.devolucion.insert', error);
    }
    return { idDevolucion: data!.idDevolucion };
  }

  /** Devoluciones de una asignación, con el documento en URL firmada. */
  async devolucionesDe(idKvas: string) {
    const { data, error } = await this.supabase.admin
      .from('kvaDevoluciones')
      .select('idDevolucion, cantidad, fechaDevolucion, documento, urldoc, observaciones, status, fc')
      .eq('idKvas', idKvas)
      .order('fechaDevolucion', { ascending: false })
      .range(0, 499);
    if (error) fallaBd(this.logger, 'kvas.devolucionesDe', error);

    return Promise.all(
      (data ?? []).map(async (d) => ({
        ...d,
        cantidad: Number(d.cantidad ?? 0),
        urldoc: await this.firmar(d.urldoc),
      })),
    );
  }

  // ============ Expediente de documentos de la NAVE ============

  /**
   * Documentos de KVA de una nave (contrato, carta de compra de KVA…).
   *
   * Se cuelgan de la NAVE y no de una asignación concreta porque un mismo
   * contrato suele cubrir la baja y la media a la vez.
   */
  async documentosDeNave(idNave: string, incluirBajas = false): Promise<DocumentoNave[]> {
    let q = this.supabase.admin
      .from('kvaNaveDocs')
      .select('idDoc, idNave, titulo, descripcion, urldoc, status, motivoBaja, fc')
      .eq('idNave', idNave)
      .order('fc', { ascending: false })
      .range(0, 499);
    if (!incluirBajas) q = q.eq('status', true);

    const { data, error } = await q;
    if (error) fallaBd(this.logger, 'kvas.documentosDeNave', error);

    // Las URLs se firman EN LOTE (una sola llamada a Storage), no una por
    // documento: firmar dentro del map es un N+1 de red disfrazado.
    const firmadas = await this.firmarVarias((data ?? []).map((d) => d.urldoc));

    return (data ?? []).map((d) => ({
      idDoc: d.idDoc,
      idNave: d.idNave,
      titulo: d.titulo,
      descripcion: d.descripcion,
      urldoc: firmadas.get(d.urldoc) ?? null,
      status: d.status,
      motivoBaja: d.motivoBaja,
      fc: d.fc,
    }));
  }

  /**
   * Cuántos documentos vivos tiene cada nave y sus títulos, para el contador y
   * el tooltip del tablero. Una sola consulta para todas las naves: nada de N+1.
   */
  async conteoDocumentosPorNave(
    idsNave: string[],
  ): Promise<Map<string, { total: number; titulos: string[] }>> {
    const salida = new Map<string, { total: number; titulos: string[] }>();
    if (idsNave.length === 0) return salida;

    const { data, error } = await this.supabase.admin
      .from('kvaNaveDocs')
      .select('idNave, titulo')
      .in('idNave', idsNave)
      .eq('status', true)
      .order('fc', { ascending: false })
      .range(0, 4999);
    if (error) fallaBd(this.logger, 'kvas.conteoDocumentos', error);

    for (const d of data ?? []) {
      const acc = salida.get(d.idNave) ?? { total: 0, titulos: [] };
      acc.total += 1;
      // El tooltip solo muestra los primeros; el resto se ve al abrir.
      if (acc.titulos.length < 5) acc.titulos.push(d.titulo);
      salida.set(d.idNave, acc);
    }
    return salida;
  }

  /** Sube un documento al expediente de la nave. */
  async subirDocumentoNave(
    idNave: string,
    dto: DocumentoNaveDto,
    archivo: ArchivoValidado,
    actorUid: string,
  ): Promise<{ idDoc: string }> {
    // Valida que la nave exista y toma su parque de la BD (no del cliente).
    const idParque = await this.parqueDeNave(idNave);

    const ruta = rutaSegura(['naves', idNave, randomUUID()], archivo.ext);
    const { error: errUp } = await this.supabase.admin.storage
      .from(BUCKET_KVA)
      .upload(ruta, archivo.buffer, {
        contentType: archivo.contentType,
        upsert: false,
      });
    if (errUp)
      fallaBd(this.logger, 'kvas.docNave.upload', errUp, 'No se pudo subir el documento.');

    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('kvaNaveDocs')
      .insert({
        idNave,
        idParque,
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        urldoc: ruta, // se guarda la RUTA; la URL se firma al leer
        uidr: actorUid,
      })
      .select('idDoc')
      .single();
    if (error) {
      // El archivo ya se subió: se limpia para no dejar huérfanos en el bucket.
      await this.supabase.admin.storage.from(BUCKET_KVA).remove([ruta]);
      fallaBd(this.logger, 'kvas.docNave.insert', error);
    }
    return { idDoc: data!.idDoc };
  }

  /**
   * Baja LÓGICA del documento, con motivo. No se borra el archivo: el
   * expediente debe poder auditarse después.
   */
  async bajaDocumentoNave(idDoc: string, motivo: string, actorUid: string): Promise<void> {
    const { data: existe, error: errG } = await this.supabase.admin
      .from('kvaNaveDocs')
      .select('idDoc, status')
      .eq('idDoc', idDoc)
      .maybeSingle();
    if (errG) fallaBd(this.logger, 'kvas.docNave.obtener', errG);
    if (!existe) throw new NotFoundException('El documento no existe.');
    if (!existe.status) throw new ConflictException('El documento ya está dado de baja.');

    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('kvaNaveDocs')
      .update({ status: false, motivoBaja: motivo })
      .eq('idDoc', idDoc);
    if (error) fallaBd(this.logger, 'kvas.docNave.baja', error);
  }

  /**
   * Firma VARIAS rutas de una sola llamada a Storage. Devuelve ruta → URL
   * firmada (las que fallen quedan fuera del mapa y el llamador pone `null`).
   */
  private async firmarVarias(rutas: (string | null)[]): Promise<Map<string, string>> {
    const salida = new Map<string, string>();
    const limpias = [...new Set(rutas.filter((r): r is string => !!r))];
    if (limpias.length === 0) return salida;

    const { data } = await this.supabase.admin.storage
      .from(BUCKET_KVA)
      .createSignedUrls(limpias, FIRMA_SEGUNDOS);
    for (const f of data ?? []) if (f.path && f.signedUrl) salida.set(f.path, f.signedUrl);
    return salida;
  }

  /** URL temporal del documento. El bucket es privado: nunca se expone directo. */
  private async firmar(ruta: string | null): Promise<string | null> {
    if (!ruta) return null;
    const { data } = await this.supabase.admin.storage
      .from(BUCKET_KVA)
      .createSignedUrl(ruta, FIRMA_SEGUNDOS);
    return data?.signedUrl ?? null;
  }

  // ===================== Candado de liberación de nave =====================

  /**
   * KVA VENDIDOS de una nave que todavía no acreditan su devolución al parque.
   *
   * Regla de negocio: al dejar la nave, los KVA vendidos deben regresar al
   * parque y eso se acredita con documento (`kvaDevoluciones`). Mientras quede
   * pendiente, la nave NO se libera. Los RENTADOS no cuentan: regresan solos al
   * cerrar el vínculo.
   *
   * ⚠️ Mira las asignaciones VIVAS y las CANCELADAS: cancelar una venta no
   * devuelve el KVA, así que cancelarla no puede ser la puerta trasera para
   * saltarse el candado.
   */
  async pendientesPorDevolver(
    idNave: string,
  ): Promise<{ nivel: 'MT' | 'BT'; pendiente: number }[]> {
    const { data, error } = await this.supabase.admin
      .from('kvasAsignados')
      .select('nivel, cantKvas, cantDevuelta')
      .eq('idNave', idNave)
      .eq('figura', 'VENTA')
      .range(0, 999);
    if (error) fallaBd(this.logger, 'kvas.pendientesPorDevolver', error);

    const acc = new Map<'MT' | 'BT', number>();
    for (const f of data ?? []) {
      const pend = Number(f.cantKvas ?? 0) - Number(f.cantDevuelta ?? 0);
      if (pend <= 0) continue;
      const nivel = f.nivel as 'MT' | 'BT';
      acc.set(nivel, (acc.get(nivel) ?? 0) + pend);
    }
    return [...acc.entries()].map(([nivel, pendiente]) => ({ nivel, pendiente }));
  }

  /**
   * Lanza 409 con un mensaje de negocio si la nave tiene KVA vendidos sin
   * acreditar. Lo usan `liberarNave` (renta) y `desvincularNave` (venta).
   */
  async exigirKvasDevueltos(idNave: string | null | undefined): Promise<void> {
    if (!idNave) return;
    const pendientes = await this.pendientesPorDevolver(idNave);
    if (pendientes.length === 0) return;

    const detalle = pendientes
      .map((p) => `${p.pendiente} de ${p.nivel === 'MT' ? 'media' : 'baja'} tensión`)
      .join(' y ');
    throw new ConflictException(
      `No se puede liberar la nave: faltan KVA por regresar al parque (${detalle}). ` +
        'Registra la devolución con su documento en Parques → KVA\'s.',
    );
  }

  // ===================== Acometidas =====================

  async crearAcometida(dto: AcometidaDto, actorUid: string): Promise<{ idAcometida: string }> {
    const { data, error } = await this.supabase
      .comoActor(actorUid)
      .from('kvaAcometidas')
      .insert({
        nombre: dto.nombre,
        tensionKv: dto.tensionKv ?? null,
        capacidadMt: dto.capacidadMt,
        capacidadBt: dto.capacidadBt,
        folioCfe: dto.folioCfe ?? null,
        notas: dto.notas ?? null,
        uidr: actorUid,
      })
      .select('idAcometida')
      .single();
    if (error) fallaBd(this.logger, 'kvas.crearAcometida', error);
    return { idAcometida: data!.idAcometida };
  }

  async editarAcometida(
    idAcometida: string,
    dto: AcometidaDto,
    actorUid: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('kvaAcometidas')
      .update({
        nombre: dto.nombre,
        tensionKv: dto.tensionKv ?? null,
        capacidadMt: dto.capacidadMt,
        capacidadBt: dto.capacidadBt,
        folioCfe: dto.folioCfe ?? null,
        notas: dto.notas ?? null,
      })
      .eq('idAcometida', idAcometida);
    if (error) fallaBd(this.logger, 'kvas.editarAcometida', error);
  }

  /** Cuelga (o descuelga, con `null`) un parque de una acometida. */
  async asignarAcometida(
    idParque: string,
    idAcometida: string | null,
    actorUid: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('parques')
      .update({ idAcometida })
      .eq('idParque', idParque);
    if (error) fallaBd(this.logger, 'kvas.asignarAcometida', error);
  }

  // ===================== Helpers =====================

  private async obtener(idKvas: string) {
    const { data, error } = await this.supabase.admin
      .from('kvasAsignados')
      .select(
        'idKvas, idParque, idNave, nivel, figura, etapa, cantKvas, cantDevuelta, status, venceCompromiso',
      )
      .eq('idKvas', idKvas)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'kvas.obtener', error);
    if (!data) throw new NotFoundException('Asignación de KVA no encontrada.');
    return data;
  }

  /** El parque sale de la nave, no del cliente (evita descontar de otro parque). */
  private async parqueDeNave(idNave: string): Promise<string> {
    const { data, error } = await this.supabase.admin
      .from('naves')
      .select('idNave, idParque, status')
      .eq('idNave', idNave)
      .maybeSingle();
    if (error) fallaBd(this.logger, 'kvas.parqueDeNave', error);
    if (!data || data.status === false)
      throw new NotFoundException('La nave no existe o está dada de baja.');
    if (!data.idParque)
      throw new BadRequestException('La nave no pertenece a ningún parque.');
    return data.idParque;
  }

  /** VENTA exige el vínculo de propiedad; RENTA el de arrendamiento. */
  private validarVinculo(
    figura: string,
    idPropiedad?: string | null,
    idNavArrend?: string | null,
  ): void {
    if (figura === 'VENTA' && idNavArrend)
      throw new BadRequestException(
        'Una asignación de venta no puede ligarse a un vínculo de renta.',
      );
    if (figura === 'RENTA' && idPropiedad)
      throw new BadRequestException(
        'Una asignación de renta no puede ligarse a un vínculo de venta.',
      );
  }
}
