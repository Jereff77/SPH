import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type {
  CeldaDto,
  ConceptoDto,
  IvaDto,
  MovimientoContaDto,
  SaldoDto,
} from './fideicomiso.schemas.js';

type Db = ReturnType<SupabaseService['comoActor']>;

/** Concepto del catálogo contable (cascada Tipo→Concepto→Subconcepto→Descripción). */
export interface ContaConcepto {
  tipo: string | null;
  concepto: string | null;
  subconcepto: string | null;
  descripcion: string | null;
  aplicaIVA: boolean;
  ordenTipo: number | null;
  ordenConcepto: number | null;
}

/** Registro de `fideContabilidad` (para localizar/editar una celda). */
interface RegistroConta {
  id: number;
  monto: number | null;
  notas: string | null;
  aplicaIVA: boolean;
  fc: string;
}

/**
 * Fideicomiso → Contabilidad (clave 540). Réplica FIEL de la pantalla
 * `fide_contabilidad` de v1 (la versión WebView con CRUD completo) pero **segura**:
 * todo el acceso a datos pasa por el backend (sin anon key en el navegador, sin
 * SQL crudo). Cubre: tabla pivote por año, edición inline de celdas, toggle de
 * IVA por celda, notas, saldos del estado de cuenta (conciliación), alta de
 * movimientos (con reemplazo de duplicados) y alta de conceptos del catálogo.
 * Toda escritura usa `comoActor(uid)` (auditada por `trg_auditoria`) y registra
 * además el historial de cambios en `fideContaHistorial` (igual que v1).
 */
@Injectable()
export class ContabilidadService {
  private readonly logger = new Logger(ContabilidadService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ------------------------------- Lecturas -------------------------------

  /** Tabla pivote (filas por concepto, columnas Ene..Dic + Total + notas) de un año. */
  async pivote(anio: number) {
    const { data, error } = await this.supabase.admin.rpc('pivot_contabilidad', {
      p_anio: anio,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Subtotales por tipo/concepto + GRAN TOTAL del año. */
  async totales(anio: number) {
    const { data, error } = await this.supabase.admin.rpc(
      'pivot_contabilidad_totales',
      { p_anio: anio },
    );
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Catálogo de conceptos contables, ordenado para la cascada del modal. */
  async conceptos(): Promise<ContaConcepto[]> {
    const { data, error } = await this.supabase.admin
      .from('fideContaConceptos')
      .select('tipo, concepto, subconcepto, descripcion, aplicaIVA, orden_tipo, orden_concepto')
      .order('orden_tipo', { ascending: true, nullsFirst: false })
      .order('orden_concepto', { ascending: true, nullsFirst: false })
      .order('tipo', { ascending: true })
      .order('concepto', { ascending: true })
      .order('subconcepto', { ascending: true, nullsFirst: false })
      .order('descripcion', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((c) => ({
      tipo: c.tipo,
      concepto: c.concepto,
      subconcepto: c.subconcepto,
      descripcion: c.descripcion,
      aplicaIVA: c.aplicaIVA,
      ordenTipo: c.orden_tipo,
      ordenConcepto: c.orden_concepto,
    }));
  }

  /** Saldos del estado de cuenta (banco) por mes, para un año. */
  async saldos(anio: number): Promise<{ mes: number; saldo: number }[]> {
    const { data, error } = await this.supabase.admin
      .from('fideSaldosBanco')
      .select('mes, saldo')
      .eq('anio', anio);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((s) => ({ mes: s.mes, saldo: s.saldo }));
  }

  // ------------------------------ Escrituras ------------------------------

  /**
   * Edición inline de una celda (mes) de la tabla pivote. Busca el registro de
   * `fideContabilidad` que corresponde a la clave; si existe, actualiza el monto;
   * si no, lo crea. Registra el cambio en `fideContaHistorial` (UPDATE/INSERT).
   */
  async guardarCelda(dto: CeldaDto, actorUid: string): Promise<{ ok: true }> {
    const db = this.supabase.comoActor(actorUid);
    const existente = await this.buscarRegistro(dto);

    if (existente) {
      const { error } = await db
        .from('fideContabilidad')
        .update({ monto: dto.monto, uid: actorUid })
        .eq('id', existente.id);
      if (error) throw new InternalServerErrorException(error.message);
      await this.registrarHistorial(db, {
        accion: 'UPDATE',
        registroId: existente.id,
        montoAntes: existente.monto,
        montoNuevo: dto.monto,
        notasAntes: existente.notas,
        notasNuevo: existente.notas,
        snapshot: existente,
        uid: actorUid,
      });
    } else {
      // Al crear una celda nueva, hereda el IVA del concepto (no hardcodear
      // `false`): si no coincide con el IVA de los demás meses del mismo
      // concepto, el pivote partiría la fila en dos (bug de "renglón duplicado").
      const aplicaIVA = dto.aplicaIVA ?? (await this.ivaDelConcepto(dto));
      const id = await this.insertarRegistro(db, {
        anio: dto.anio,
        mes: dto.mes,
        tipo: dto.tipo,
        concepto: dto.concepto,
        subconcepto: dto.subconcepto,
        descripcion: dto.descripcion,
        monto: dto.monto,
        aplicaIVA,
        notas: null,
        uid: actorUid,
      });
      await this.registrarHistorial(db, {
        accion: 'INSERT',
        registroId: id,
        montoAntes: null,
        montoNuevo: dto.monto,
        notasAntes: null,
        notasNuevo: null,
        snapshot: null,
        uid: actorUid,
      });
    }
    return { ok: true };
  }

  /** Toggle de "Aplica IVA" del registro de una celda. */
  async toggleIva(dto: IvaDto, actorUid: string): Promise<{ ok: true; aplicaIVA: boolean }> {
    const existente = await this.buscarRegistro(dto);
    if (!existente)
      throw new BadRequestException('Sin registro — ingresa un monto primero.');
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db
      .from('fideContabilidad')
      .update({ aplicaIVA: dto.aplicaIVA })
      .eq('id', existente.id);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true, aplicaIVA: dto.aplicaIVA };
  }

  /**
   * Alta de un movimiento desde el modal "Nuevo". Si ya existe un registro con
   * la misma clave y no se pidió reemplazar, responde 409 con los datos del
   * existente (para que el front confirme, como el `confirm()` de v1).
   */
  async crearMovimiento(
    dto: MovimientoContaDto,
    actorUid: string,
  ): Promise<{ ok: true; reemplazado: boolean }> {
    const db = this.supabase.comoActor(actorUid);
    const notas = dto.notas ?? null;
    const existente = await this.buscarRegistro(dto);

    if (existente) {
      if (!dto.reemplazar) {
        throw new ConflictException({
          duplicado: true,
          montoExistente: existente.monto,
          fc: existente.fc,
          mensaje: 'Ya existe un registro con estos datos.',
        });
      }
      const { error } = await db
        .from('fideContabilidad')
        .update({
          monto: dto.monto,
          aplicaIVA: dto.aplicaIVA,
          notas,
          uid: actorUid,
        })
        .eq('id', existente.id);
      if (error) throw new InternalServerErrorException(error.message);
      await this.registrarHistorial(db, {
        accion: 'REPLACE',
        registroId: existente.id,
        montoAntes: existente.monto,
        montoNuevo: dto.monto,
        notasAntes: existente.notas,
        notasNuevo: notas,
        snapshot: existente,
        uid: actorUid,
      });
      return { ok: true, reemplazado: true };
    }

    const id = await this.insertarRegistro(db, {
      anio: dto.anio,
      mes: dto.mes,
      tipo: dto.tipo,
      concepto: dto.concepto,
      subconcepto: dto.subconcepto,
      descripcion: dto.descripcion,
      monto: dto.monto,
      aplicaIVA: dto.aplicaIVA,
      notas,
      uid: actorUid,
    });
    await this.registrarHistorial(db, {
      accion: 'INSERT',
      registroId: id,
      montoAntes: null,
      montoNuevo: dto.monto,
      notasAntes: null,
      notasNuevo: notas,
      snapshot: null,
      uid: actorUid,
    });
    return { ok: true, reemplazado: false };
  }

  /** Alta de un concepto del catálogo (`fideContaConceptos`). */
  async crearConcepto(dto: ConceptoDto, actorUid: string): Promise<{ ok: true; id: number }> {
    const subconcepto = dto.subconcepto ?? '';
    const descripcion = dto.descripcion ? dto.descripcion : null;

    // Verificar duplicado (tipo + concepto + subconcepto + descripción).
    const { data: existe, error: errBusca } = await this.supabase.admin
      .from('fideContaConceptos')
      .select('id')
      .eq('tipo', dto.tipo)
      .eq('concepto', dto.concepto)
      .eq('subconcepto', subconcepto)
      .eq('descripcion', descripcion ?? '')
      .limit(1);
    if (errBusca) throw new InternalServerErrorException(errBusca.message);
    if (existe && existe.length > 0)
      throw new ConflictException('Ya existe ese concepto en el catálogo.');

    const db = this.supabase.comoActor(actorUid);
    const { data, error } = await db
      .from('fideContaConceptos')
      .insert({
        tipo: dto.tipo,
        concepto: dto.concepto,
        subconcepto,
        descripcion,
        aplicaIVA: dto.aplicaIVA,
        orden_tipo: dto.ordenTipo,
        orden_concepto: dto.ordenConcepto,
      })
      .select('id')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true, id: data.id };
  }

  /** Guarda (upsert) el saldo del estado de cuenta de un mes. */
  async guardarSaldo(dto: SaldoDto, actorUid: string): Promise<{ ok: true }> {
    const db = this.supabase.comoActor(actorUid);
    const { data: existente, error: errBusca } = await this.supabase.admin
      .from('fideSaldosBanco')
      .select('id')
      .eq('anio', dto.anio)
      .eq('mes', dto.mes)
      .limit(1);
    if (errBusca) throw new InternalServerErrorException(errBusca.message);

    if (existente && existente.length > 0) {
      const { error } = await db
        .from('fideSaldosBanco')
        .update({ saldo: dto.saldo, uidr: actorUid })
        .eq('id', existente[0]!.id);
      if (error) throw new InternalServerErrorException(error.message);
    } else {
      const { error } = await db
        .from('fideSaldosBanco')
        .insert({ anio: dto.anio, mes: dto.mes, saldo: dto.saldo, uidr: actorUid });
      if (error) throw new InternalServerErrorException(error.message);
    }
    return { ok: true };
  }

  /** Elimina el saldo del estado de cuenta de un mes. */
  async eliminarSaldo(
    anio: number,
    mes: number,
    actorUid: string,
  ): Promise<{ ok: true }> {
    const db = this.supabase.comoActor(actorUid);
    const { error } = await db
      .from('fideSaldosBanco')
      .delete()
      .eq('anio', anio)
      .eq('mes', mes);
    if (error) throw new InternalServerErrorException(error.message);
    return { ok: true };
  }

  // ------------------------------- Privados -------------------------------

  /** Localiza el registro activo de `fideContabilidad` para una clave de celda. */
  private async buscarRegistro(clave: {
    anio: number;
    mes: number;
    tipo: string;
    concepto: string;
    subconcepto: string;
    descripcion: string;
  }): Promise<RegistroConta | null> {
    const { data, error } = await this.supabase.admin
      .from('fideContabilidad')
      .select('id, monto, notas, aplicaIVA, fc')
      .eq('tipo', clave.tipo)
      .eq('concepto', clave.concepto)
      .eq('subconcepto', clave.subconcepto)
      .eq('descripcion', clave.descripcion)
      .eq('mes', clave.mes)
      .eq('anio', clave.anio)
      .eq('status', true)
      .limit(1);
    if (error) throw new InternalServerErrorException(error.message);
    const r = data?.[0];
    return r
      ? { id: r.id, monto: r.monto, notas: r.notas, aplicaIVA: r.aplicaIVA, fc: r.fc }
      : null;
  }

  /**
   * IVA que corresponde a un concepto al crear una celda nueva. Para que la fila
   * del pivote quede unificada (no se parta por IVA), hereda el flag de cualquier
   * mes ya capturado del mismo concepto/año; si no hay ninguno, cae al valor del
   * catálogo `fideContaConceptos` (match por tipo+concepto). Default: `false`.
   */
  private async ivaDelConcepto(clave: {
    anio: number;
    tipo: string;
    concepto: string;
    subconcepto: string;
    descripcion: string;
  }): Promise<boolean> {
    // 1) Hermano del mismo concepto/año (misma clave, cualquier mes).
    const { data: hermano } = await this.supabase.admin
      .from('fideContabilidad')
      .select('aplicaIVA')
      .eq('tipo', clave.tipo)
      .eq('concepto', clave.concepto)
      .eq('subconcepto', clave.subconcepto)
      .eq('descripcion', clave.descripcion)
      .eq('anio', clave.anio)
      .eq('status', true)
      .limit(1);
    if (hermano && hermano.length > 0) return hermano[0]!.aplicaIVA === true;

    // 2) Catálogo de conceptos (match laxo por tipo+concepto).
    const { data: cat } = await this.supabase.admin
      .from('fideContaConceptos')
      .select('aplicaIVA')
      .eq('tipo', clave.tipo)
      .eq('concepto', clave.concepto)
      .limit(1);
    if (cat && cat.length > 0) return cat[0]!.aplicaIVA === true;

    return false;
  }

  private async insertarRegistro(
    db: Db,
    v: {
      anio: number;
      mes: number;
      tipo: string;
      concepto: string;
      subconcepto: string;
      descripcion: string;
      monto: number;
      aplicaIVA: boolean;
      notas: string | null;
      uid: string;
    },
  ): Promise<number> {
    const { data, error } = await db
      .from('fideContabilidad')
      .insert({
        anio: v.anio,
        mes: v.mes,
        tipo: v.tipo,
        concepto: v.concepto,
        subconcepto: v.subconcepto,
        descripcion: v.descripcion,
        monto: v.monto,
        aplicaIVA: v.aplicaIVA,
        notas: v.notas,
        status: true,
        uid: v.uid,
      })
      .select('id')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data.id;
  }

  /** Inserta una fila en el historial de cambios contables (`fideContaHistorial`). */
  private async registrarHistorial(
    db: Db,
    h: {
      accion: string;
      registroId: number;
      montoAntes: number | null;
      montoNuevo: number;
      notasAntes: string | null;
      notasNuevo: string | null;
      snapshot: RegistroConta | null;
      uid: string;
    },
  ): Promise<void> {
    const { error } = await db.from('fideContaHistorial').insert({
      registro_id: h.registroId,
      accion: h.accion,
      uid: h.uid,
      monto_antes: h.montoAntes,
      monto_nuevo: h.montoNuevo,
      notas_antes: h.notasAntes,
      notas_nuevo: h.notasNuevo,
      snapshot: h.snapshot ? JSON.parse(JSON.stringify(h.snapshot)) : null,
    });
    if (error) this.logger.warn(`No se pudo registrar historial: ${error.message}`);
  }
}
