import { Module } from '@nestjs/common';
import { PermisosController } from './permisos.controller.js';
import { PermisosService } from './permisos.service.js';

@Module({
  controllers: [PermisosController],
  providers: [PermisosService],
})
export class PermisosModule {}
