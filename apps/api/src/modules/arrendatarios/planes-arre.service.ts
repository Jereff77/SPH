import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { IncrementosService } from './incrementos.service.js';
import type {
  CancelarAnticipadoDto,
  ConceptoFinanciadoDto,
  CrearPlanRentaDto,
  DocArreDto,
  EditarCampoDto,
  RenovarPlanDto,
  VincularNaveArreDto,
} from './arrendatarios.schemas.js';

const ID_ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Bucket de documentos del arrendatario/inversionista (existente). */
const BUCKET_DOCS = 'Documentos';

type Db = ReturnType<SupabaseService['comoActor']>;

/** Forma del jsonb que devuelven las RPCs `arrepdp_*` (exito/mensaje). */
interface RpcResultado {
  exito?: boolean;
  mensaje?: string;
  detalles?: { id_plan?: string } & Record<string, unknown>;
}

/**
 * Arrendatarios > Planes de Renta (clave 20). Selector arrendatario/propiedad,
 * historial de planes (`arrePdp`), corrida (`arrepdpdetalle_obtener_resumen_por_plan`),
 * y Configuración (Datos generales solo lectura, Documentos, Propiedades, crear/
 * editar/eliminar Plan de Pago). El motor de cálculo INPC vive en las RPCs
 * `arrepdp_*` existentes, invocadas con `comoActor` (auditoría). Reemplaza
 * `ArrendatariosWidget`/`ConfigArrendatariosWidget`/`arre_pdp_widget` de v1.
 */
@Injectable()
export class PlanesArreService {
  private readonly logger = new Logger(PlanesArreService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly incrementos: IncrementosService,
  ) {}

  private generarId(n: number): string {
    const bytes = randomBytes(n);
    let id = '';
    for (let i = 0; i < n; i++) id += ID_ALFABETO[bytes[i]! % ID_ALFABETO.length];
    return id;
  }

  // ----------------------------- Selectores / lectura -----------------------------

  /**
   * Arrendatarios para el selector: registros de `inversionista` con
   * `(arrendatario = true OR usuarioFinal = true) AND status = true`, ordenados
   * por razón social. (Gotcha: el "arrendador" es un inversionista.)
   */
  async arrendatarios() {
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select('idInversionista, nombre, apellido1, apellido2, razonsocial')
      .eq('status', true)
      .or('arrendatario.eq.true,usuarioFinal.eq.true')
      .order('razonsocial', { ascending: true, nullsFirst: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Propiedades (naves) arrendadas de un arrendatario, desde la vista
   * `v_arrendadasNaves` (idArrendatario), ordenadas por nombre descriptivo. Solo
   * **vínculos activos**: la vista no expone `arrenPropiedades.status`, así que se
   * filtran los `idNavArrend` con `status=true` (las naves liberadas no aparecen).
   */
  async propiedadesDe(idArrendador: string) {
    const [{ data, error }, { data: activos, error: actErr }] = await Promise.all([
      this.supabase.admin
        .from('v_arrendadasNaves')
        .select(
          'idNavArrend, idArrendadoPdp, nomDescriptivo, idParque, idNave, nomParque, numNave, numNaveNAME, tienePdp, pdpActivo',
        )
        .eq('idArrendatario', idArrendador)
        .eq('esTicket', false)
        .order('nomDescriptivo', { ascending: true, nullsFirst: false }),
      this.supabase.admin
        .from('arrenPropiedades')
        .select('idNavArrend')
        .eq('idArrendador', idArrendador)
        .eq('status', true),
    ]);
    if (error) throw new InternalServerErrorException(error.message);
    if (actErr) throw new InternalServerErrorException(actErr.message);
    const activosSet = new Set((activos ?? []).map((a) => a.idNavArrend));
    return (data ?? []).filter((r) => !!r.idNavArrend && activosSet.has(r.idNavArrend));
  }

  /**
   * Historial de planes (`arrePdp`) de una nave-arrendatario. El enum
   * `arrePdpVigente` ya ordena Si → 3/2/1 Meses → No, así que basta `.order`.
   */
  async planesDe(idNavArrend: string, idArrendador: string) {
    const { data, error } = await this.supabase.admin
      .from('arrePdp')
      .select(
        'idArrePdp, idNavArrend, idArrendador, fecInicio, fecFin, plazo, deposito, precioM2, construccionM2, rtaBase, INPC, INPCPlus, pm2Admin, pm2Mtto, pm2Vig, Moneda, vigente, arrePdpVigente',
      )
      .eq('idNavArrend', idNavArrend)
      .eq('idArrendador', idArrendador)
      .eq('status', true)
      .order('arrePdpVigente', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Resumen/corrida de un plan (RPC `arrepdpdetalle_obtener_resumen_por_plan`).
   * Como en v1, solo se devuelve si el plan está activo (`pdpactivo`).
   */
  async resumenPlan(idArrePdp: string) {
    const { data, error } = await this.supabase.admin.rpc(
      'arrepdpdetalle_obtener_resumen_por_plan',
      { p_idarrepdp: idArrePdp, p_validar: false },
    );
    if (error) throw new InternalServerErrorException(error.message);
    const filas = (data ?? []) as Array<{ pdpactivo: boolean | null }>;
    if (filas.length > 0 && filas[0]!.pdpactivo === false) return [];
    return filas;
  }

  /**
   * Detalle (partidas) de un plan para una partida/año concreto — incluye el
   * flag `tieneMesGratis` (resaltado de cortesía) que la corrida resumida no trae.
   */
  async detallePlan(idArrePdp: string, numPartida?: number) {
    let q = this.supabase.admin
      .from('arrePdpDetalle')
      .select(
        'idArrePdpDet, idArrePdp, numPartida, anio, ciclo, concepto, fecha, pm2, constM2, INPC, ptsINPC, inpcTotal, cantidad, cantidadAplicada, tieneMesGratis, comprobantePago, fecPago, moneda',
      )
      .eq('idArrePdp', idArrePdp)
      .eq('status', true);
    if (numPartida !== undefined) q = q.eq('numPartida', numPartida);
    const { data, error } = await q
      .order('numPartida', { ascending: true })
      .order('anio', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Listado del INPC (mes/valor), como en la Consulta INPC de v1. */
  async inpc() {
    const { data, error } = await this.supabase.admin
      .from('inpc')
      .select('id, anio, mes, inpc')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  // ----------------------------- Config: Datos Generales (solo lectura) -----------------------------

  /** Datos generales del arrendatario (solo lectura; el alta/edición vive en Clientes). */
  async datosGenerales(idInversionista: string) {
    const { data, error } = await this.supabase.admin
      .from('inversionista')
      .select(
        'idInversionista, personalidad, nombre, apellido1, apellido2, razonsocial, fecNacimiento, telefono, correo, RFC, CURP',
      )
      .eq('idInversionista', idInversionista)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Arrendatario no encontrado.');
    return data;
  }

  // ----------------------------- Config: Documentos -----------------------------

  async listarDocs(idInversionista: string) {
    const { data, error } = await this.supabase.admin
      .from('inversionista_docs')
      .select('idDocumento, titulo, descripcion, urldoc')
      .eq('idInversionista', idInversionista)
      .eq('status', true)
      .order('fc', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async subirDoc(
    dto: DocArreDto,
    archivo: { buffer: Buffer; ext: string; contentType: string },
    actorUid: string,
  ): Promise<{ idDocumento: string }> {
    const idDocumento = this.generarId(15);
    const path = `${dto.idInversionista}/${idDocumento}.${archivo.ext}`;
    const { error: upErr } = await this.supabase.admin.storage
      .from(BUCKET_DOCS)
      .upload(path, archivo.buffer, { contentType: archivo.contentType, upsert: true });
    if (upErr)
      throw new InternalServerErrorException(`No se pudo subir el documento: ${upErr.message}`);
    const urldoc = this.supabase.admin.storage.from(BUCKET_DOCS).getPublicUrl(path).data.publicUrl;

    const { error } = await this.supabase.comoActor(actorUid).from('inversionista_docs').insert({
      idDocumento,
      idInversionista: dto.idInversionista,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      urldoc,
      status: true,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return { idDocumento };
  }

  async eliminarDoc(idDocumento: string, actorUid: string): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('inversionista_docs')
      .update({ status: false })
      .eq('idDocumento', idDocumento);
    if (error) throw new InternalServerErrorException(error.message);
  }

  // ----------------------------- Config: Propiedades -----------------------------

  /** Parques disponibles (excluye los de Tickets), para vincular naves. */
  async parquesDisponibles() {
    const { data, error } = await this.supabase.admin
      .from('parques')
      .select('idParque, nomParque')
      .eq('status', true)
      .eq('esTicket', false)
      .order('nomParque', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Naves de un parque que aún no están arrendadas (`Arrendada = false`). Excluye Tickets. */
  async navesDisponibles(idParque?: string) {
    let q = this.supabase.admin
      .from('naves')
      .select('idNave, idParque, numNave, numNaveNAME, lote, mza, terreno, construccion, precio')
      .eq('status', true)
      .eq('Arrendada', false)
      .eq('esTicket', false);
    if (idParque) q = q.eq('idParque', idParque);
    const { data, error } = await q.order('numNave', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Vincula una nave a un arrendatario (insert `arrenPropiedades` + marca `naves.Arrendada`). */
  async vincularNave(
    dto: VincularNaveArreDto,
    actorUid: string,
  ): Promise<{ idNavArrend: string }> {
    const { data: nave, error: naveErr } = await this.supabase.admin
      .from('naves')
      .select('idNave, idParque, Arrendada')
      .eq('idNave', dto.idNave)
      .maybeSingle();
    if (naveErr) throw new InternalServerErrorException(naveErr.message);
    if (!nave) throw new NotFoundException('Nave no encontrada.');
    if (nave.Arrendada) throw new BadRequestException('La nave ya está arrendada.');

    const actor = this.supabase.comoActor(actorUid);
    const idNavArrend = this.generarId(15);
    const idParque = dto.idParque || nave.idParque;
    if (!idParque) throw new BadRequestException('La nave no tiene parque asociado.');

    const { error } = await actor.from('arrenPropiedades').insert({
      idNavArrend,
      uid: actorUid,
      idArrendador: dto.idArrendador,
      idParque,
      idNave: dto.idNave,
      tienePdp: false,
      pdpActivo: false,
      pdpVigente: false,
      status: true,
    });
    if (error) throw new InternalServerErrorException(error.message);

    const { error: navErr } = await actor
      .from('naves')
      .update({ Arrendada: true })
      .eq('idNave', dto.idNave);
    if (navErr) throw new InternalServerErrorException(navErr.message);

    return { idNavArrend };
  }

  /**
   * Libera una nave arrendada para volver a rentarla (baja lógica que conserva el
   * histórico). Solo si la nave NO tiene plan vigente ni activo: todos sus planes
   * deben estar vencidos (`arrePdpVigente='No'`) y `pdpActivo=false`. Marca
   * `arrenPropiedades.status=false` y `naves.Arrendada=false`; los planes
   * (`arrePdp`/`arrePdpDetalle`) y sus pagos se conservan. No existía en v1.
   */
  async liberarNave(idNavArrend: string, actorUid: string): Promise<void> {
    const { data: prop, error: propErr } = await this.supabase.admin
      .from('arrenPropiedades')
      .select('idNavArrend, idNave, pdpActivo, status')
      .eq('idNavArrend', idNavArrend)
      .maybeSingle();
    if (propErr) throw new InternalServerErrorException(propErr.message);
    if (!prop || prop.status === false)
      throw new NotFoundException('Propiedad arrendada no encontrada o ya liberada.');
    if (prop.pdpActivo)
      throw new BadRequestException('Desactiva el plan antes de liberar la nave.');

    // No debe haber ningún plan vigente (todos deben estar 'No').
    const { count, error: vigErr } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp', { count: 'exact', head: true })
      .eq('idNavArrend', idNavArrend)
      .eq('status', true)
      .neq('arrePdpVigente', 'No');
    if (vigErr) throw new InternalServerErrorException(vigErr.message);
    if ((count ?? 0) > 0)
      throw new BadRequestException('La nave tiene un plan vigente; no se puede liberar.');

    const db = this.supabase.comoActor(actorUid);
    const { error: upPropErr } = await db
      .from('arrenPropiedades')
      .update({
        status: false,
        tienePdp: false,
        pdpActivo: false,
        pdpVigente: false,
        idArrePdp: null,
      })
      .eq('idNavArrend', idNavArrend);
    if (upPropErr) throw new InternalServerErrorException(upPropErr.message);

    if (prop.idNave) {
      const { error: upNaveErr } = await db
        .from('naves')
        .update({ Arrendada: false })
        .eq('idNave', prop.idNave);
      if (upNaveErr) throw new InternalServerErrorException(upNaveErr.message);
    }

    await this.registrarActividad(db, {
      pantalla: 'Arrendatarios',
      nomwidget: 'LiberarNave',
      comentario: `Se liberó la nave ${prop.idNave ?? '-'} (vínculo ${idNavArrend}); queda disponible para renta.`,
      actorUid,
    });
  }

  // ----------------------------- Plan de Pago (crear/editar/conceptos/activar/eliminar) -----------------------------

  /**
   * Crea un Plan de Pago orquestando las 3 RPCs en secuencia (con `comoActor`):
   *  1. `arrepdp_crear_plan_simple_rpc` → cabecera (devuelve id_plan).
   *  2. `arrepdp_generar_corrida_desde_plan_simple` → detalle/corrida.
   *  3. `arrepdpdetalle_aplicar_meses_gracia` → marca meses de gracia.
   */
  async crearPlan(
    idNavArrend: string,
    dto: CrearPlanRentaDto,
    actorUid: string,
  ): Promise<{ idArrePdp: string; mensaje: string }> {
    // La nave-arrendatario no debe tener ya un plan.
    const { data: prop, error: propErr } = await this.supabase.admin
      .from('arrenPropiedades')
      .select('idNavArrend, tienePdp')
      .eq('idNavArrend', idNavArrend)
      .maybeSingle();
    if (propErr) throw new InternalServerErrorException(propErr.message);
    if (!prop) throw new NotFoundException('Propiedad arrendada no encontrada.');
    if (prop.tienePdp) throw new BadRequestException('Esta propiedad ya tiene un plan de pago.');

    const db = this.supabase.comoActor(actorUid);

    // Paso 1: crear la cabecera.
    const { data: creado, error: crearErr } = await db.rpc('arrepdp_crear_plan_simple_rpc', {
      p_uid: actorUid,
      p_id_arrendador: dto.idArrendador,
      p_id_nav_arrend: idNavArrend,
      p_fec_inicio: dto.fecInicio,
      p_plazo: dto.plazo,
      p_deposito: dto.deposito,
      p_precio_m2: dto.precioM2,
      p_construccion_m2: dto.m2Construccion,
      p_pm2_admin: dto.pm2Admin,
      p_pm2_mtto: dto.pm2Mtto,
      p_pm2_vig: dto.pm2Vig,
      p_inpc_plus: dto.inpcPlus,
      p_moneda: dto.moneda,
      p_mes_gracia_renta: dto.cortesiaRenta,
      p_mes_gracia_administracion: dto.cortesiaAdmin,
      p_mes_gracia_mantenimiento: dto.cortesiaMtto,
      p_mes_gracia_vigilancia: dto.cortesiaVig,
    });
    if (crearErr) {
      this.logger.error(`Error creando plan de renta: ${crearErr.message}`);
      throw new InternalServerErrorException('No se pudo crear el plan de pago.');
    }
    const res = creado as RpcResultado;
    if (res?.exito === false)
      throw new BadRequestException(res.mensaje ?? 'No se pudo crear el plan de pago.');
    const idArrePdp = res?.detalles?.id_plan;
    if (!idArrePdp)
      throw new InternalServerErrorException('La RPC no devolvió el id del plan creado.');

    // Paso 2: generar la corrida.
    const { error: corridaErr } = await db.rpc('arrepdp_generar_corrida_desde_plan_simple', {
      p_id_arre_pdp: idArrePdp,
      p_inpc_adicional: 0,
      p_pts_inpc_adicional: dto.inpcPlus,
    });
    if (corridaErr) {
      this.logger.error(`Error generando corrida ${idArrePdp}: ${corridaErr.message}`);
      throw new InternalServerErrorException('Se creó el plan pero no se pudo generar la corrida.');
    }

    // Paso 3: aplicar meses de gracia.
    const { error: graciaErr } = await db.rpc('arrepdpdetalle_aplicar_meses_gracia', {
      p_idarrepdp: idArrePdp,
    });
    if (graciaErr)
      this.logger.warn(`No se pudieron aplicar meses de gracia en ${idArrePdp}: ${graciaErr.message}`);

    // Nota: `fecFin` es una columna GENERADA en `arrePdp` (no se inserta/actualiza);
    // su fórmula vive en la definición de la columna.

    await this.registrarActividad(db, {
      pantalla: 'Arrendatarios',
      nomwidget: 'CrearPlan',
      comentario: `Se creó plan de renta ${idArrePdp} para la nave ${idNavArrend} (arrendatario ${dto.idArrendador}).`,
      actorUid,
    });

    return { idArrePdp, mensaje: res?.mensaje ?? 'Plan de pago creado correctamente.' };
  }

  /** Edita un campo de la corrida desde un año (solo si el plan está vigente). */
  async editarCampo(idArrePdp: string, dto: EditarCampoDto, actorUid: string): Promise<void> {
    const { data: plan, error: planErr } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, arrePdpVigente')
      .eq('idArrePdp', idArrePdp)
      .maybeSingle();
    if (planErr) throw new InternalServerErrorException(planErr.message);
    if (!plan) throw new NotFoundException('Plan no encontrado.');
    if (plan.arrePdpVigente === 'No')
      throw new BadRequestException('No se puede modificar un plan no vigente.');

    const { error } = await this.supabase
      .comoActor(actorUid)
      .rpc('arrepdpdetalle_actualizar_campo_manual', {
        p_id_arre_pdp: idArrePdp,
        p_anio_desde: dto.anioDesde,
        p_concepto: dto.concepto,
        p_nombre_campo: dto.campo,
        p_valor: dto.valor,
      });
    if (error) throw new InternalServerErrorException(error.message);

    // La edición manual de INPC/pts (año ≥ 2, la RPC recalcula pm2) queda en la
    // bitácora de incrementos (origen='manual') para que el flujo automático
    // sepa que ese plan+año ya se movió. Best-effort: no bloquea la edición.
    if ((dto.campo === 'INPC' || dto.campo === 'ptsINPC') && dto.anioDesde >= 2) {
      await this.incrementos.registrarManual({
        idArrePdp,
        anio: dto.anioDesde,
        campo: dto.campo,
        concepto: dto.concepto,
        valor: dto.valor,
        actorUid,
      });
    }
  }

  /** Agrega un concepto financiado (KVA / adecuación) al plan. */
  async agregarConcepto(
    idArrePdp: string,
    dto: ConceptoFinanciadoDto,
    actorUid: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .rpc('arrepdp_agregar_concepto_financiado', {
        p_id_arre_pdp: idArrePdp,
        p_concepto: dto.concepto,
        p_monto_financiar: dto.monto,
        p_mes_inicio: dto.mesInicio,
        p_periodo: dto.periodo,
        p_dividir: dto.dividir,
      });
    if (error) throw new InternalServerErrorException(error.message);
  }

  /** Elimina (físico) las partidas de un concepto del plan. */
  async eliminarConcepto(idArrePdp: string, concepto: string, actorUid: string): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('arrePdpDetalle')
      .delete()
      .eq('idArrePdp', idArrePdp)
      .eq('concepto', concepto);
    if (error) throw new InternalServerErrorException(error.message);
  }

  /** Activa o desactiva el plan (congela/edita renta) togglando `pdpActivo`. */
  async setActivo(idNavArrend: string, activo: boolean, actorUid: string): Promise<void> {
    const { error } = await this.supabase
      .comoActor(actorUid)
      .from('arrenPropiedades')
      .update({ pdpActivo: activo })
      .eq('idNavArrend', idNavArrend);
    if (error) throw new InternalServerErrorException(error.message);
  }

  /** Elimina un plan con restricciones (RPC) y registra la actividad. */
  async eliminarPlan(idArrePdp: string, actorUid: string): Promise<{ mensaje: string }> {
    const db = this.supabase.comoActor(actorUid);
    const { data, error } = await db.rpc('arrepdp_eliminar_plan_con_restricciones', {
      p_id_arre_pdp: idArrePdp,
    });
    if (error) {
      this.logger.error(`Error eliminando plan ${idArrePdp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo eliminar el plan.');
    }
    const res = data as RpcResultado;
    if (res?.exito === false)
      throw new BadRequestException(res.mensaje ?? 'No se pudo eliminar el plan.');

    await this.registrarActividad(db, {
      pantalla: 'Arrendatarios',
      nomwidget: 'EliminarPlan',
      comentario: `Se eliminó el plan de renta ${idArrePdp}.`,
      actorUid,
    });
    return { mensaje: res?.mensaje ?? 'Plan eliminado.' };
  }

  // ----------------------------- Renovación -----------------------------

  /**
   * Datos para precargar el formulario de renovación: fecha de inicio sugerida
   * (fin del plan actual + 1 día) y los precios del **último mes** de cada concepto
   * base (la renta ya incrementada por INPC), además de plazo/depósito/moneda/INPC+.
   */
  async precargaRenovacion(idArrePdp: string) {
    const { data: plan, error: planErr } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, fecFin, plazo, deposito, construccionM2, INPCPlus, Moneda, arrePdpVigente')
      .eq('idArrePdp', idArrePdp)
      .maybeSingle();
    if (planErr) throw new InternalServerErrorException(planErr.message);
    if (!plan) throw new NotFoundException('Plan no encontrado.');
    if (!plan.fecFin) throw new BadRequestException('El plan no tiene fecha de fin.');

    const { data: det, error: detErr } = await this.supabase.admin
      .from('arrePdpDetalle')
      .select('concepto, pm2, constM2, numPartida')
      .eq('idArrePdp', idArrePdp)
      .eq('status', true)
      .order('numPartida', { ascending: false });
    if (detErr) throw new InternalServerErrorException(detErr.message);

    // pm2 del último mes (mayor numPartida) por concepto base.
    const ultimo = (concepto: string): number => {
      const fila = (det ?? []).find((d) => d.concepto === concepto);
      return fila?.pm2 != null ? Number(fila.pm2) : 0;
    };
    const constM2 =
      (det ?? []).find((d) => d.concepto === 'Renta')?.constM2 ?? plan.construccionM2 ?? 0;

    // fecInicio sugerida = fecFin + 1 día (en UTC para no desfasar).
    const f = new Date(`${plan.fecFin}T00:00:00Z`);
    f.setUTCDate(f.getUTCDate() + 1);
    const fecInicio = f.toISOString().slice(0, 10);

    return {
      idArrePdp,
      fecInicio,
      fecFinActual: plan.fecFin,
      arrePdpVigente: plan.arrePdpVigente,
      plazo: plan.plazo ?? 12,
      m2Construccion: Number(constM2) || 0,
      deposito: Number(plan.deposito) || 0,
      precioM2: ultimo('Renta'),
      pm2Admin: ultimo('Administración'),
      pm2Mtto: ultimo('Mantenimiento'),
      pm2Vig: ultimo('Vigilancia'),
      inpcPlus: Number(plan.INPCPlus) || 0,
      moneda: (plan.Moneda as 'MXN' | 'USD') ?? 'MXN',
    };
  }

  /**
   * Registra el plan de renovación (RPC `v2_arrepdp_renovar`): crea el nuevo plan
   * que sucede al actual (fecInicio = fin + 1 día) sin tocar el vigente, valida que
   * sea renovable (≤3 meses o vencido) y que no exista ya una renovación.
   */
  async renovar(
    idArrePdp: string,
    dto: RenovarPlanDto,
    actorUid: string,
  ): Promise<{ idArrePdp: string; mensaje: string }> {
    const db = this.supabase.comoActor(actorUid);
    // RPC nueva v2_ (aún no tipada en @erp/types); cast localizado.
    const { data, error } = await (
      db.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )('v2_arrepdp_renovar', {
      p_id_arre_pdp_actual: idArrePdp,
      p_uid: actorUid,
      p_plazo: dto.plazo,
      p_precio_m2: dto.precioM2,
      p_construccion_m2: dto.m2Construccion,
      p_deposito: dto.deposito,
      p_pm2_admin: dto.pm2Admin,
      p_pm2_mtto: dto.pm2Mtto,
      p_pm2_vig: dto.pm2Vig,
      p_inpc_plus: dto.inpcPlus,
      p_moneda: dto.moneda,
      p_mes_gracia_renta: dto.cortesiaRenta,
      p_mes_gracia_administracion: dto.cortesiaAdmin,
      p_mes_gracia_mantenimiento: dto.cortesiaMtto,
      p_mes_gracia_vigilancia: dto.cortesiaVig,
    });
    if (error) {
      this.logger.error(`Error renovando plan ${idArrePdp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo registrar la renovación.');
    }
    const res = data as RpcResultado;
    if (res?.exito === false)
      throw new BadRequestException(res.mensaje ?? 'No se pudo registrar la renovación.');
    const idNuevo = res?.detalles?.id_plan;
    if (!idNuevo)
      throw new InternalServerErrorException('La RPC no devolvió el id de la renovación.');

    await this.registrarActividad(db, {
      pantalla: 'Arrendatarios',
      nomwidget: 'RenovarPlan',
      comentario: `Se registró la renovación ${idNuevo} del plan ${idArrePdp}.`,
      actorUid,
    });
    return { idArrePdp: idNuevo, mensaje: res?.mensaje ?? 'Renovación registrada.' };
  }

  // ----------------------------- Cancelación anticipada -----------------------------

  /**
   * Datos para precargar el modal de cancelación anticipada: las partidas
   * (meses) del plan y la **primera partida cancelable** = último mes con pago
   * aplicado + 1 (no se permite cancelar meses ya cobrados). Solo aplica a planes
   * activos y vigentes (se revalida server-side).
   */
  async precargaCancelacion(idArrePdp: string) {
    const { data: plan, error: planErr } = await this.supabase.admin
      .from('arrePdp')
      .select('idArrePdp, idNavArrend, arrePdpVigente')
      .eq('idArrePdp', idArrePdp)
      .eq('status', true)
      .maybeSingle();
    if (planErr) throw new InternalServerErrorException(planErr.message);
    if (!plan) throw new NotFoundException('Plan no encontrado.');
    if (plan.arrePdpVigente === 'No')
      throw new BadRequestException('El plan no está vigente; no se puede cancelar.');

    const { data: prop, error: propErr } = await this.supabase.admin
      .from('arrenPropiedades')
      .select('pdpActivo')
      .eq('idNavArrend', plan.idNavArrend ?? '')
      .eq('status', true)
      .maybeSingle();
    if (propErr) throw new InternalServerErrorException(propErr.message);
    if (!prop?.pdpActivo)
      throw new BadRequestException('El plan no está activo; no se puede cancelar.');

    // Corrida resumida (una fila por partida, ya filtra status=true).
    const { data: resumen, error: resErr } = await this.supabase.admin.rpc(
      'arrepdpdetalle_obtener_resumen_por_plan',
      { p_idarrepdp: idArrePdp, p_validar: false },
    );
    if (resErr) throw new InternalServerErrorException(resErr.message);

    // Partidas con pago aplicado (fecPago no nulo) → no se pueden cancelar.
    const { data: pagadas, error: pagErr } = await this.supabase.admin
      .from('arrePdpDetalle')
      .select('numPartida')
      .eq('idArrePdp', idArrePdp)
      .eq('status', true)
      .not('fecPago', 'is', null);
    if (pagErr) throw new InternalServerErrorException(pagErr.message);
    const pagadasSet = new Set((pagadas ?? []).map((p) => p.numPartida));
    const maxPagada = pagadasSet.size
      ? Math.max(...[...pagadasSet].filter((n): n is number => n != null))
      : 0;

    const partidas = (
      (resumen ?? []) as Array<{ numPartida: number; fecha: string; total_cantidad: number }>
    ).map((r) => ({
      numPartida: r.numPartida,
      fecha: r.fecha,
      monto: Number(r.total_cantidad) || 0,
      pagada: pagadasSet.has(r.numPartida),
    }));

    return { primerCancelable: maxPagada + 1, partidas };
  }

  /**
   * Cancela anticipadamente un plan: baja lógica de las partidas desde el mes de
   * corte, marca la cabecera (`canceladoAnticipado`, `fecCancelacion`,
   * `canceladoPor`, `motivoCancelacion`, `vigente=false`) y **libera la nave**.
   * Todo en una sola transacción (RPC `v2_arrepdp_cancelar_anticipado`), auditado
   * vía `comoActor`. La RPC revalida plan activo/vigente y que el corte no caiga
   * en/antes de un mes ya pagado.
   */
  async cancelarAnticipado(
    idArrePdp: string,
    dto: CancelarAnticipadoDto,
    actorUid: string,
  ): Promise<{ mensaje: string; fecCancelacion: string | null }> {
    const db = this.supabase.comoActor(actorUid);
    // RPC nueva v2_ (aún no tipada en @erp/types); cast localizado (igual que renovar).
    const { data, error } = await (
      db.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )('v2_arrepdp_cancelar_anticipado', {
      p_id_arre_pdp: idArrePdp,
      p_uid: actorUid,
      p_num_partida_corte: dto.numPartidaCorte,
      p_motivo: dto.motivo,
    });
    if (error) {
      this.logger.error(`Error cancelando plan ${idArrePdp}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo cancelar el contrato.');
    }
    const res = data as RpcResultado;
    if (res?.exito === false)
      throw new BadRequestException(res.mensaje ?? 'No se pudo cancelar el contrato.');

    const fecCancelacion = (res?.detalles?.['fec_cancelacion'] as string | undefined) ?? null;
    await this.registrarActividad(db, {
      pantalla: 'Arrendatarios',
      nomwidget: 'CancelarAnticipado',
      comentario: `Cancelación anticipada del plan ${idArrePdp} (corte en partida ${dto.numPartidaCorte}). Motivo: ${dto.motivo}`,
      actorUid,
    });
    return { mensaje: res?.mensaje ?? 'Contrato cancelado.', fecCancelacion };
  }

  /** Bitácora de actividad (entorno 3 = web/servidor), como v1. */
  private async registrarActividad(
    db: Db,
    a: { pantalla: string; nomwidget: string; comentario: string; actorUid: string },
  ): Promise<void> {
    const { error } = await db.from('actividad').insert({
      uid: a.actorUid,
      entorno: 3,
      logeado: true,
      pantalla: a.pantalla,
      widget: 'Button',
      nomwidget: a.nomwidget,
      comentario: a.comentario,
      version: 'erp-v2',
    });
    if (error) this.logger.warn(`No se pudo registrar actividad: ${error.message}`);
  }
}
