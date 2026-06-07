import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller.js';
import { ClientesService } from './clientes.service.js';

/** Sección Clientes (clave 300), tabla `inversionista`. */
@Module({
  controllers: [ClientesController],
  providers: [ClientesService],
})
export class ClientesModule {}
