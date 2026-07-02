import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ResponsablesService } from './responsables.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

const agregarResponsableSchema = z.object({
  idParque: z.string().trim().min(1, 'Falta el parque.').max(60),
  uid: z.string().trim().min(1, 'Falta el usuario.').max(60),
});
type AgregarResponsableDto = z.infer<typeof agregarResponsableSchema>;

const gerenteSchema = z.object({
  // uid vacío o null = quitar la gerente
  uid: z.string().trim().max(60).nullable(),
});
type GerenteDto = z.infer<typeof gerenteSchema>;

/**
 * Arrendatarios · Responsables de parque + gerente del módulo (permiso 212 —
 * la misma llave del flujo de incrementos INPC, cuyos correos alimenta).
 */
@Controller('arrendatarios/responsables')
@UseGuards(JwtAuthGuard, PermisoGuard)
export class ResponsablesController {
  constructor(private readonly responsables: ResponsablesService) {}

  @Get()
  @RequierePermiso(212)
  listar() {
    return this.responsables.listar();
  }

  @Get('usuarios')
  @RequierePermiso(212)
  usuarios() {
    return this.responsables.usuariosElegibles();
  }

  @Post()
  @RequierePermiso(212)
  agregar(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(agregarResponsableSchema)) dto: AgregarResponsableDto,
  ) {
    return this.responsables.agregar(dto.idParque, dto.uid, actor.uid);
  }

  @Delete(':id')
  @RequierePermiso(212)
  quitar(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.responsables.quitar(id, actor.uid);
  }

  @Patch('gerente')
  @RequierePermiso(212)
  gerente(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(gerenteSchema)) dto: GerenteDto,
  ) {
    return this.responsables.setGerente(dto.uid, actor.uid);
  }
}
