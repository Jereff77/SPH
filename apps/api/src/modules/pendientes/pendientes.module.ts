import { Module } from '@nestjs/common';
import { TableroPendientesController } from './pendientes.controller.js';
import { TableroPendientesService } from './pendientes.service.js';

/**
 * Módulo Pendientes (Configuraciones → Pendientes).
 *
 * Tablero de trabajo del proyecto: el destino ÚNICO de deuda técnica, bugs
 * conocidos, mejoras, módulos nuevos, peticiones de negocio y decisiones
 * abiertas. Los archivos `DEUDA.md` quedaron congelados como histórico.
 *
 * No importa otros módulos: solo usa `SupabaseService`, que es global.
 */
@Module({
  controllers: [TableroPendientesController],
  providers: [TableroPendientesService],
})
export class TableroPendientesModule {}
