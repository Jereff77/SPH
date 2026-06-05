import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BancosService } from './bancos.service.js';
import { bancoSchema, type BancoDto } from './bancos.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/**
 * CxP > Bancos (catálogo). Acceso: clave 470. Antes solo se editaba directo en
 * la BD; ahora se gestiona desde la app. Escrituras sobre `catBancos`, auditadas.
 */
@Controller('cxp/bancos')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(470)
export class BancosController {
  constructor(private readonly svc: BancosService) {}

  @Get()
  listar() {
    return this.svc.listar();
  }

  @Post()
  crear(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(bancoSchema)) dto: BancoDto,
  ) {
    return this.svc.crear(dto, actor.uid);
  }

  @Patch(':id')
  async editar(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(bancoSchema)) dto: BancoDto,
  ) {
    await this.svc.editar(id, dto, actor.uid);
    return { ok: true };
  }
}
