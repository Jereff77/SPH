import { Global, Module } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service.js';
import { ConfiguracionController } from './configuracion.controller.js';

/**
 * Global: ConfiguracionService está disponible para otros módulos (p. ej.
 * AuthService usa los dominios autorizados).
 */
@Global()
@Module({
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
