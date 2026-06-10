import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { MontseService } from './montse.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';

const mensajeSchema = z.object({
  sessionId: z.string().trim().min(1, 'Falta la sesión.'),
  chatInput: z.string().trim().min(1, 'Escribe una pregunta.').max(4000),
});
type MensajeDto = z.infer<typeof mensajeSchema>;

const renombrarSchema = z.object({ titulo: z.string().trim().min(1).max(120) });
type RenombrarDto = z.infer<typeof renombrarSchema>;

/** Montse AI (pestaña dentro de Reportes, clave 620). */
@Controller('ventas/montse')
@UseGuards(JwtAuthGuard, PermisoGuard)
export class MontseController {
  constructor(private readonly montse: MontseService) {}

  @Get('tokens')
  @RequierePermiso(620)
  tokens() {
    return this.montse.tokensDisponibles();
  }

  @Get('sesiones')
  @RequierePermiso(620)
  sesiones(@CurrentUser() actor: AuthUser) {
    return this.montse.listarSesiones(actor.uid);
  }

  @Post('sesiones')
  @RequierePermiso(620)
  nuevaSesion(@CurrentUser() actor: AuthUser) {
    return this.montse.nuevaSesion(actor.uid);
  }

  @Get('sesiones/:id/mensajes')
  @RequierePermiso(620)
  mensajes(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.montse.mensajes(actor.uid, id);
  }

  @Patch('sesiones/:id')
  @RequierePermiso(620)
  renombrar(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(renombrarSchema)) dto: RenombrarDto,
  ) {
    return this.montse.renombrar(actor.uid, id, dto.titulo);
  }

  @Delete('sesiones/:id')
  @RequierePermiso(620)
  eliminar(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.montse.eliminar(actor.uid, id);
  }

  @Post('mensaje')
  @RequierePermiso(620)
  enviar(
    @Headers('authorization') auth: string,
    @Body(new ZodValidationPipe(mensajeSchema)) dto: MensajeDto,
  ) {
    // Reenviamos el JWT del usuario a la edge function (la identifica con auth.getUser()).
    const jwt = (auth ?? '').replace(/^Bearer\s+/i, '');
    return this.montse.enviar(jwt, dto.sessionId, dto.chatInput);
  }
}
