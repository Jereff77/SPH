import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { TablesInsert, TablesUpdate } from '@erp/types';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type {
  InpcCrearDto,
  InpcEditarDto,
  CuentaCrearDto,
  CuentaEditarDto,
  FechaCxpCrearDto,
  FechaCxpToggleDto,
} from './parametros.schemas.js';

function nombre(u: {
  nombre: string | null;
  apellidos: string | null;
  nomCompleto: string | null;
}): string {
  if (u.apellidos && u.nombre) return `${u.apellidos}, ${u.nombre}`;
  return u.nomCompleto ?? u.nombre ?? '—';
}

/**
 * Sección Parámetros. Opera sobre tablas EXISTENTES y COMPARTIDAS con Flutter
 * (autorizado por el cliente): `inpc`, `PresCategorias`, `cxp_fechas_habilitadas`.
 * Los triggers de la BD generan id/consecutivo (inpc) y dia_semana/mes_anio (fechas).
 */
@Injectable()
export class ParametrosService {
  constructor(private readonly supabase: SupabaseService) {}

  // ===================== INPC =====================

  async listarInpc() {
    const { data, error } = await this.supabase.admin
      .from('inpc')
      .select('consecutivo, id, anio, mes, inpc, nota, fum')
      .order('consecutivo', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async crearInpc(dto: InpcCrearDto): Promise<void> {
    // El id ("AAAA/MM") y el consecutivo los gestiona el trigger; proveemos el
    // id con el mismo formato para satisfacer el tipo (NOT NULL).
    const id = `${dto.anio}/${String(dto.mes).padStart(2, '0')}`;
    const { error } = await this.supabase.admin.from('inpc').insert({
      id,
      anio: dto.anio,
      mes: dto.mes,
      inpc: dto.inpc,
      nota: dto.nota,
    });
    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Ya existe un INPC para ese año y mes.');
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async editarInpc(consecutivo: number, dto: InpcEditarDto): Promise<void> {
    const { error } = await this.supabase.admin
      .from('inpc')
      .update({ inpc: dto.inpc, nota: dto.nota })
      .eq('consecutivo', consecutivo);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async eliminarInpc(consecutivo: number): Promise<void> {
    const { error } = await this.supabase.admin
      .from('inpc')
      .delete()
      .eq('consecutivo', consecutivo);
    if (error) throw new InternalServerErrorException(error.message);
  }

  // ===================== Cuentas (PresCategorias + presupuesto) =====================

  /**
   * Lista las cuentas con su presupuesto anual usando la función de negocio
   * `prescategorias_obtener_con_presupuesto` (misma fuente que Flutter, para
   * consistencia), y añade el "consumido" desde la vista v_resumenPresupuesto.
   */
  async listarCuentas(filtroCuenta?: string, filtroSeccion?: string) {
    const { data: cuentas, error } = await this.supabase.admin.rpc(
      'prescategorias_obtener_con_presupuesto',
      {
        p_id_categoria: undefined,
        p_cuenta: filtroCuenta && filtroCuenta.trim() ? filtroCuenta : undefined,
        p_seccion:
          filtroSeccion && filtroSeccion.trim() ? filtroSeccion : undefined,
      },
    );
    if (error) throw new InternalServerErrorException(error.message);

    const { data: resumen } = await this.supabase.admin
      .from('v_resumenPresupuesto')
      .select('idCategoria, subtotal_gastado, total_gastado_comprometido');
    const mapR = new Map(
      (resumen ?? []).map((r) => [r.idCategoria, r] as const),
    );

    return (cuentas ?? []).map((c) => {
      const r = c.idCategoria ? mapR.get(c.idCategoria) : undefined;
      return {
        idCategoria: c.idCategoria,
        cuenta: c.cuenta,
        seccion: c.seccion,
        descripcion: c.descripcion,
        presupuestoAnual: c.presupuesto_anual ?? 0,
        consumido: r?.subtotal_gastado ?? 0,
        comprometido: r?.total_gastado_comprometido ?? 0,
        uidResponsable: c.uidResponsable,
        nombreResponsable: c.nomCompleto ?? null,
        idPresupuesto: c.idPresupuesto,
        presupuestable: c.presupuestable,
        status: c.status,
      };
    });
  }

  /** Usuarios activos para el combo de responsable. */
  async listarResponsables() {
    const { data, error } = await this.supabase.admin
      .from('catUsers')
      .select('uid, nombre, apellidos, nomCompleto')
      .eq('status', true)
      .order('apellidos', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []).map((u) => ({ uid: u.uid, nombre: nombre(u) }));
  }

  async crearCuenta(dto: CuentaCrearDto, uidActor: string): Promise<void> {
    const { error } = await this.supabase.admin.from('PresCategorias').insert({
      idCategoria: dto.idCategoria,
      cuenta: dto.cuenta,
      seccion: dto.seccion,
      descripcion: dto.descripcion,
      uidResponsable: dto.uidResponsable,
      uidr: uidActor,
      Presupuesto: 0,
    });
    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Ya existe una cuenta con ese ID.');
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async editarCuenta(idCategoria: string, dto: CuentaEditarDto): Promise<void> {
    const { error } = await this.supabase.admin
      .from('PresCategorias')
      .update({
        cuenta: dto.cuenta,
        seccion: dto.seccion,
        descripcion: dto.descripcion,
        uidResponsable: dto.uidResponsable,
      })
      .eq('idCategoria', idCategoria);
    if (error) throw new InternalServerErrorException(error.message);
  }

  /** Cambia el responsable de una cuenta (inline). */
  async cambiarResponsable(
    idCategoria: string,
    uidResponsable: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('PresCategorias')
      .update({ uidResponsable })
      .eq('idCategoria', idCategoria);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async setPresupuestable(idCategoria: string, valor: boolean): Promise<void> {
    const { error } = await this.supabase.admin
      .from('PresCategorias')
      .update({ presupuestable: valor })
      .eq('idCategoria', idCategoria);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async setStatusCuenta(idCategoria: string, valor: boolean): Promise<void> {
    const { error } = await this.supabase.admin
      .from('PresCategorias')
      .update({ status: valor })
      .eq('idCategoria', idCategoria);
    if (error) throw new InternalServerErrorException(error.message);
  }

  /**
   * Elimina una cuenta. Solo si NO se ha usado en pagos (no tiene movimientos en
   * `cxp`). El presupuesto mensual (`PresDetalle`) es configuración: se borra
   * junto con la cuenta (el FK PresDetalle→PresCategorias es RESTRICT).
   */
  async eliminarCuenta(idCategoria: string): Promise<void> {
    // 1. No permitir si la cuenta se usó en algún pago (movimientos en cxp).
    const { count, error: errC } = await this.supabase.admin
      .from('cxp')
      .select('*', { count: 'exact', head: true })
      .eq('idCategoria', idCategoria);
    if (errC) throw new InternalServerErrorException(errC.message);
    if ((count ?? 0) > 0) {
      throw new BadRequestException(
        'No se puede eliminar: la cuenta ya se usó en pagos.',
      );
    }

    // 2. Borrar el presupuesto mensual de la cuenta (satisface el FK RESTRICT).
    const { error: errD } = await this.supabase.admin
      .from('PresDetalle')
      .delete()
      .eq('idCategoria', idCategoria);
    if (errD) throw new InternalServerErrorException(errD.message);

    // 3. Borrar la cuenta.
    const { error } = await this.supabase.admin
      .from('PresCategorias')
      .delete()
      .eq('idCategoria', idCategoria);
    if (error) {
      if (error.code === '23503') {
        throw new BadRequestException(
          'No se puede eliminar: la cuenta tiene movimientos asociados.',
        );
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ----- Presupuesto mensual (PresDetalle) -----

  /**
   * Lee los montos mensuales existentes de una cuenta (0-12 filas). NO crea nada;
   * el frontend muestra siempre los 12 meses (default 0) y al guardar se persiste.
   */
  async obtenerPresupuestoMensual(idCategoria: string, idPresupuesto: string) {
    const { data, error } = await this.supabase.admin
      .from('PresDetalle')
      .select('id, mes, monto')
      .eq('idCategoria', idCategoria)
      .eq('idPresupuesto', idPresupuesto)
      .order('mes', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Guarda el presupuesto mensual completo (12 meses): actualiza los meses que
   * existen y crea los que faltan. `claveUnica` es columna GENERATED, no se inserta.
   */
  async guardarPresupuestoMensual(
    idCategoria: string,
    idPresupuesto: string,
    meses: { mes: number; monto: number }[],
    uidActor: string,
  ): Promise<void> {
    const { data: pres, error: errP } = await this.supabase.admin
      .from('Presupuestos')
      .select('anio')
      .eq('idPresupuesto', idPresupuesto)
      .maybeSingle();
    if (errP) throw new InternalServerErrorException(errP.message);
    if (!pres) throw new BadRequestException('Presupuesto no encontrado.');
    const anio = pres.anio;

    const { data: existentes, error: errE } = await this.supabase.admin
      .from('PresDetalle')
      .select('id, mes, monto')
      .eq('idCategoria', idCategoria)
      .eq('idPresupuesto', idPresupuesto);
    if (errE) throw new InternalServerErrorException(errE.message);
    const porMes = new Map((existentes ?? []).map((r) => [r.mes, r] as const));

    const aInsertar: TablesInsert<'PresDetalle'>[] = [];
    const aActualizar: { id: number; monto: number }[] = [];
    for (const { mes, monto } of meses) {
      const ex = porMes.get(mes);
      if (ex) {
        if (ex.monto !== monto) aActualizar.push({ id: ex.id, monto });
      } else {
        // Sin claveUnica: es GENERATED ALWAYS (Postgres la calcula).
        aInsertar.push({
          uidc: uidActor,
          uidm: uidActor,
          idCategoria,
          anio,
          mes,
          monto,
          idPresupuesto,
        });
      }
    }

    if (aInsertar.length) {
      const { error } = await this.supabase.admin
        .from('PresDetalle')
        .insert(aInsertar);
      if (error) throw new InternalServerErrorException(error.message);
    }
    for (const u of aActualizar) {
      const { error } = await this.supabase.admin
        .from('PresDetalle')
        .update({ monto: u.monto, uidm: uidActor, fua: new Date().toISOString() })
        .eq('id', u.id);
      if (error) throw new InternalServerErrorException(error.message);
    }
  }

  // ===================== Fechas CxP =====================

  async listarPeriodos(): Promise<string[]> {
    const { data, error } = await this.supabase.admin
      .from('cxp_fechas_habilitadas')
      .select('mes_anio')
      .order('mes_anio', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return [
      ...new Set((data ?? []).map((r) => r.mes_anio).filter((m): m is string => !!m)),
    ];
  }

  async listarFechas(periodo?: string) {
    let query = this.supabase.admin
      .from('cxp_fechas_habilitadas')
      .select('fecha, dia_semana, mes_anio, cfdi, autorizar')
      .order('fecha', { ascending: true });
    if (periodo) query = query.eq('mes_anio', periodo);
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async crearFecha(dto: FechaCxpCrearDto, uidActor: string): Promise<void> {
    // El trigger genera dia_semana y mes_anio.
    const { error } = await this.supabase.admin
      .from('cxp_fechas_habilitadas')
      .insert({
        fecha: dto.fecha,
        cfdi: dto.cfdi,
        autorizar: dto.autorizar,
        created_by: uidActor,
      });
    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Esa fecha ya está registrada.');
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async toggleFecha(fecha: string, dto: FechaCxpToggleDto): Promise<void> {
    const cambios: TablesUpdate<'cxp_fechas_habilitadas'> = {};
    if (dto.cfdi !== undefined) cambios.cfdi = dto.cfdi;
    if (dto.autorizar !== undefined) cambios.autorizar = dto.autorizar;
    const { error } = await this.supabase.admin
      .from('cxp_fechas_habilitadas')
      .update(cambios)
      .eq('fecha', fecha);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async eliminarFecha(fecha: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('cxp_fechas_habilitadas')
      .delete()
      .eq('fecha', fecha);
    if (error) throw new InternalServerErrorException(error.message);
  }
}
