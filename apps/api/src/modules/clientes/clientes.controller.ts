import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientesService } from './clientes.service.js';
import {
  clienteSchema,
  TIPOS_CLIENTE,
  type ClienteDto,
  type TipoCliente,
} from './clientes.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

/** Sección Clientes (clave 300) — tabla `inversionista`. */
@Controller('clientes')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(300)
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  listar(@Query('tipo') tipo?: string) {
    const t: TipoCliente = TIPOS_CLIENTE.includes(tipo as TipoCliente)
      ? (tipo as TipoCliente)
      : 'inversionistas';
    return this.clientes.listar(t);
  }

  /** Verifica si un RFC ya existe (por base) en cualquier tipo de cliente. */
  @Get('verificar-rfc')
  verificarRfc(
    @Query('rfc') rfc?: string,
    @Query('excluirId') excluirId?: string,
  ) {
    return this.clientes.verificarRfc(rfc ?? '', excluirId || undefined);
  }

  /** Cliente completo por id (para abrir/editar el existente desde un aviso de duplicado). */
  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.clientes.obtener(id);
  }

  @Post()
  crear(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(clienteSchema)) dto: ClienteDto,
  ) {
    return this.clientes.crear(dto, actor.uid);
  }

  @Patch(':id')
  async actualizar(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(clienteSchema)) dto: ClienteDto,
  ) {
    await this.clientes.actualizar(id, dto, actor.uid);
    return { ok: true };
  }

  @Post(':id/papelera')
  async moverPapelera(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    await this.clientes.moverPapelera(id, actor.uid);
    return { ok: true };
  }
}
