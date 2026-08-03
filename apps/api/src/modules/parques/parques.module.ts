import { Module } from '@nestjs/common';
import {
  ParquesController,
  DisponibilidadController,
} from './parques.controller.js';
import { ParquesService } from './parques.service.js';
import { KvasController } from './kvas.controller.js';
import { KvasService } from './kvas.service.js';

@Module({
  controllers: [ParquesController, DisponibilidadController, KvasController],
  providers: [ParquesService, KvasService],
  // Lo exporta para el candado de liberación de nave (Ventas y Arrendatarios
  // consultan los KVA vendidos pendientes de devolución antes de liberar).
  exports: [KvasService],
})
export class ParquesModule {}
