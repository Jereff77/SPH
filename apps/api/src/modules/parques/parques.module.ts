import { Module } from '@nestjs/common';
import {
  ParquesController,
  DisponibilidadController,
} from './parques.controller.js';
import { ParquesService } from './parques.service.js';

@Module({
  controllers: [ParquesController, DisponibilidadController],
  providers: [ParquesService],
})
export class ParquesModule {}
