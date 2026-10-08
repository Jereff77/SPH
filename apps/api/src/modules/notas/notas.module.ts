import { Module } from '@nestjs/common';
import { NotasController } from './notas.controller.js';
import { NotasService } from './notas.service.js';

/**
 * Notas por entidad (chat reutilizable) y avisos automáticos de MontseAI.
 * Los módulos que generan avisos importan este módulo e inyectan `NotasService`.
 */
@Module({
  controllers: [NotasController],
  providers: [NotasService],
  exports: [NotasService],
})
export class NotasModule {}
