import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { KvasPlantillasService } from './kvas-plantillas.service.js';
import {
  bajaPlantillaSchema,
  crearPlantillaSchema,
  guardarPlantillaSchema,
  idPlantillaSchema,
  tipoPlantillaSchema,
  listarPlantillasQuerySchema,
  type BajaPlantillaDto,
  type CrearPlantillaDto,
  type GuardarPlantillaDto,
  type TipoPlantilla,
} from './kvas-plantillas.schemas.js';
import { catalogoDeTipo } from './kvas-plantillas.campos.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

const idPipe = new ZodValidationPipe(idPlantillaSchema);

/**
 * Plantillas de documentos de KVA's (versión light). Claves: 730 ver plantillas ·
 * 731 editar plantillas. Lectura: cualquiera de 730, 731 o 721 (quien asigna KVA
 * necesita ver las plantillas). Escritura: 731. Soporte pasa todo (PermisoGuard).
 * RBAC server-side; el actor sale del JWT verificado.
 */
@Controller('kvas/plantillas')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(730, 731, 721)
export class KvasPlantillasController {
  constructor(private readonly svc: KvasPlantillasService) {}

  // ---------- Lectura (730 / 731 / 721) ----------

  /** `incluirBajas=true` solo con 730/731 (o soporte); con solo 721 responde 403. */
  @Get()
  async listar(
    @CurrentUser() actor: AuthUser,
    @Query(new ZodValidationPipe(listarPlantillasQuerySchema)) q: { incluirBajas?: string },
  ) {
    const incluirBajas = q.incluirBajas === 'true' || q.incluirBajas === '1';
    if (incluirBajas) await this.svc.exigirVerBajas(actor.uid);
    return this.svc.listar(incluirBajas);
  }

  /** Campos automáticos disponibles para un tipo (declarada ANTES de `:id`). */
  @Get('catalogo/:tipo')
  catalogo(@Param('tipo', new ZodValidationPipe(tipoPlantillaSchema)) tipo: TipoPlantilla) {
    return { tipo, campos: catalogoDeTipo(tipo) };
  }

  /** Una plantilla dada de baja solo la ve quien puede ver bajas (730/731 o soporte). */
  @Get(':id')
  async obtener(@CurrentUser() actor: AuthUser, @Param('id', idPipe) id: string) {
    const detalle = await this.svc.obtener(id);
    if (!detalle.status) await this.svc.exigirVerBajas(actor.uid);
    return detalle;
  }

  // ---------- Escritura (731) ----------

  @Post()
  @RequierePermiso(731)
  crear(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearPlantillaSchema)) dto: CrearPlantillaDto,
  ) {
    return this.svc.crear(dto, actor.uid);
  }

  @Put(':id')
  @RequierePermiso(731)
  guardar(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(guardarPlantillaSchema)) dto: GuardarPlantillaDto,
  ) {
    return this.svc.guardar(id, dto, actor.uid);
  }

  @Post(':id/duplicar')
  @RequierePermiso(731)
  duplicar(@CurrentUser() actor: AuthUser, @Param('id', idPipe) id: string) {
    return this.svc.duplicar(id, actor.uid);
  }

  /** Baja LÓGICA con motivo (POST porque el motivo viaja en el body). Sin reactivación en v1. */
  @Post(':id/baja')
  @RequierePermiso(731)
  @HttpCode(200)
  baja(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(bajaPlantillaSchema)) dto: BajaPlantillaDto,
  ) {
    return this.svc.baja(id, dto.motivo, actor.uid);
  }
}
