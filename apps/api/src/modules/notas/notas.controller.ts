import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { NotasService } from './notas.service.js';
import {
  crearNotaSchema,
  refNotaSchema,
  type CrearNotaDto,
  type RefNotaDto,
} from './notas.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * Notas por entidad (chat reutilizable). Sin `@RequierePermiso` fijo: la clave
 * depende de la pantalla (catálogo `NOTAS_ENTIDADES`) y la valida el servicio
 * con el uid del JWT verificado.
 */
@Controller('notas')
@UseGuards(JwtAuthGuard)
export class NotasController {
  constructor(private readonly notas: NotasService) {}

  @Get()
  listar(
    @CurrentUser() actor: AuthUser,
    @Query(new ZodValidationPipe(refNotaSchema)) ref: RefNotaDto,
  ) {
    return this.notas.listar(actor.uid, ref);
  }

  @Post()
  crear(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(crearNotaSchema)) dto: CrearNotaDto,
  ) {
    const { texto, ...ref } = dto;
    return this.notas.crear(actor.uid, ref, texto);
  }

  @Delete(':id')
  @HttpCode(200)
  async eliminar(@CurrentUser() actor: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.notas.eliminar(actor.uid, id);
    return { ok: true };
  }
}
