import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { KvasDocumentosService } from './kvas-documentos.service.js';
import {
  idInversionistaSchema,
  idNaveSchema,
  vistaPreviaSchema,
  type VistaPreviaDto,
} from './kvas-documentos.schemas.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { PermisoGuard } from '../../common/auth/permiso.guard.js';
import { RequierePermiso } from '../../common/auth/permisos.decorator.js';

/**
 * Generar documento de KVA's (Fase 2: solo vista previa, no escribe en la BD). Mismas claves
 * de lectura que las plantillas: 721 | 730 | 731 (soporte pasa, PermisoGuard). RBAC server-side.
 */
@Controller('kvas/documentos')
@UseGuards(JwtAuthGuard, PermisoGuard)
@RequierePermiso(730, 731, 721)
export class KvasDocumentosController {
  constructor(private readonly svc: KvasDocumentosService) {}

  @Get('empresas')
  empresas() {
    return this.svc.empresas();
  }

  /** Empresas de una nave (la ocupante primero): para abrir el modal desde la ficha de la nave. */
  @Get('naves/:idNave/empresas')
  empresasDeNave(@Param('idNave', new ZodValidationPipe(idNaveSchema)) idNave: string) {
    return this.svc.empresasDeNave(idNave);
  }

  @Get('empresas/:idInversionista/naves')
  naves(
    @Param('idInversionista', new ZodValidationPipe(idInversionistaSchema)) idInversionista: string,
  ) {
    return this.svc.navesDeEmpresa(idInversionista);
  }

  /** POST solo por el cuerpo; no crea nada (200). */
  @Post('vista-previa')
  @HttpCode(200)
  vistaPrevia(@Body(new ZodValidationPipe(vistaPreviaSchema)) dto: VistaPreviaDto) {
    return this.svc.vistaPrevia(dto);
  }
}
