import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './common/config/env.validation.js';
import { SupabaseModule } from './common/supabase/supabase.module.js';
import { AuthModule } from './common/auth/auth.module.js';
import { RegistroCronModule } from './common/cron/registro-cron.module.js';
import { HealthModule } from './health/health.module.js';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module.js';
import { AuthApiModule } from './modules/auth/auth.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { ParametrosModule } from './modules/parametros/parametros.module.js';
import { PermisosModule } from './modules/permisos/permisos.module.js';
import { IndicadoresModule } from './modules/indicadores/indicadores.module.js';
import { ParquesModule } from './modules/parques/parques.module.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { CxpModule } from './modules/cxp/cxp.module.js';
import { CorreoModule } from './modules/correo/correo.module.js';
import { VentasModule } from './modules/ventas/ventas.module.js';
import { ClientesModule } from './modules/clientes/clientes.module.js';
import { ArrendatariosModule } from './modules/arrendatarios/arrendatarios.module.js';
import { ChangelogModule } from './modules/changelog/changelog.module.js';
import { CronModule } from './modules/cron/cron.module.js';
import { FideicomisoModule } from './modules/fideicomiso/fideicomiso.module.js';

/**
 * Módulo raíz. Aquí se registran los módulos de dominio del ERP a medida que se
 * migran (un módulo Nest por módulo de negocio: inversionistas, cxp, fideicomiso,
 * crm, configuraciones, etc.), todos operando sobre el esquema Supabase existente.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // .env.local (credenciales locales, git-ignored) tiene prioridad sobre .env
      envFilePath: ['.env.local', '.env'],
    }),
    // Rate limiting global (anti fuerza bruta / abuso). Límite por defecto
    // generoso para la API; los endpoints sensibles (auth) lo endurecen con
    // @Throttle. Ver auth.controller.ts.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    SupabaseModule,
    AuthModule,
    RegistroCronModule,
    HealthModule,
    // --- Módulos de dominio ---
    ConfiguracionModule,
    AuthApiModule,
    UsuariosModule,
    ParametrosModule,
    PermisosModule,
    IndicadoresModule,
    ParquesModule,
    AuditoriaModule,
    CxpModule,
    CorreoModule,
    VentasModule,
    ClientesModule,
    ArrendatariosModule,
    ChangelogModule,
    CronModule,
    FideicomisoModule,
    // InversionistasModule,
    // ...
  ],
  providers: [
    // ThrottlerGuard global: aplica el rate limiting a todas las rutas.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
