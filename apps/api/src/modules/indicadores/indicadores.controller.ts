import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import {
  IndicadoresService,
  type TipoCambio,
  type UltimoInpc,
} from './indicadores.service.js';

/**
 * Indicadores del landing. Requieren sesión (el landing es post-login). El tipo
 * de cambio se sirve vía proxy para no exponer el token de Banxico al cliente.
 */
@Controller('indicadores')
@UseGuards(JwtAuthGuard)
export class IndicadoresController {
  constructor(private readonly svc: IndicadoresService) {}

  @Get('tipo-cambio')
  tipoCambio(): Promise<TipoCambio> {
    return this.svc.obtenerTipoCambio();
  }

  @Get('inpc')
  inpc(): Promise<UltimoInpc | null> {
    return this.svc.ultimoInpc();
  }
}
