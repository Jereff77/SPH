import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth.types.js';
import { RepPendientesService } from './rep-pendientes.service.js';

/**
 * "Mis complementos de pago pendientes" — lo que alimenta el panel del landing.
 *
 * ⛔ SIN `@RequierePermiso` a propósito: el landing lo ve todo usuario interno
 * autenticado, y este endpoint **solo devuelve lo del propio usuario**. El filtro
 * sale del `uid` del JWT verificado, **nunca** de un parámetro de la petición, así
 * que nadie puede pedir la lista de otro. No amplía la superficie de datos: quien
 * ve estas parcialidades aquí ya las veía en CxP → Solicitudes de Pago PPD.
 *
 * Va en un controlador propio (no en `PpdController`) porque aquella clase exige
 * la clave 420 y esto debe verlo también un gerente que solo autoriza.
 */
@Controller('cxp/mis-rep')
@UseGuards(JwtAuthGuard)
export class MisRepController {
  constructor(private readonly svc: RepPendientesService) {}

  @Get()
  async listar(@CurrentUser() actor: AuthUser) {
    const cfg = await this.svc.config();
    const hoy = new Date();
    const filas = await this.svc.listar({ uid: actor.uid }, cfg, hoy);

    // Días que le quedan al usuario antes de que se le bloquee el sistema: el
    // menor de sus parcialidades donde él es quien pagó (las que autorizó no lo
    // bloquean a él, bloquean al solicitante).
    const propias = filas.filter((f) => f.uidr === actor.uid);
    const diasParaMiBloqueo = propias.length
      ? Math.min(...propias.map((f) => f.diasBloqueoUsuario))
      : null;

    return {
      filas,
      resumen: {
        total: filas.length,
        comoSolicitante: propias.length,
        comoAutorizador: filas.filter((f) => f.autorizo === actor.uid).length,
        vencidas: filas.filter((f) => f.diasBloqueoProveedor < 0).length,
        venceManana: filas.filter((f) => f.diasBloqueoProveedor === 1).length,
        diasParaMiBloqueo,
      },
      config: {
        diaBloqueoProveedor: cfg.diaBloqueoProveedor,
        diaBloqueoUsuario: cfg.diaBloqueoUsuario,
      },
    };
  }
}
