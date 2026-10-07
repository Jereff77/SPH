import { Module } from '@nestjs/common';
import {
  ParquesController,
  DisponibilidadController,
} from './parques.controller.js';
import { ParquesService } from './parques.service.js';
import { KvasController } from './kvas.controller.js';
import { KvasService } from './kvas.service.js';
import { KvasPlantillasController } from './kvas-plantillas.controller.js';
import { KvasPlantillasService } from './kvas-plantillas.service.js';
import { KvasDocumentosController } from './kvas-documentos.controller.js';
import { KvasDocumentosService } from './kvas-documentos.service.js';
import { KvasCompromisosScheduler } from './kvas-compromisos.scheduler.js';
import { InvitacionesModule } from '../invitaciones/invitaciones.module.js';

@Module({
  // `InvitacionesModule` por su `InvitacionesMailer` (cuenta SMTP dedicada): el
  // scheduler de compromisos avisa por correo. `RegistroCronService` no se
  // importa: su módulo es global.
  imports: [InvitacionesModule],
  controllers: [ParquesController, DisponibilidadController, KvasController, KvasPlantillasController, KvasDocumentosController],
  providers: [ParquesService, KvasService, KvasPlantillasService, KvasDocumentosService, KvasCompromisosScheduler],
  // `KvasService` para el candado de liberación de nave (Ventas y Arrendatarios
  // consultan los KVA vendidos pendientes de devolución antes de liberar).
  // El scheduler, para que la pantalla Cron pueda dispararlo a mano.
  exports: [KvasService, KvasCompromisosScheduler],
})
export class ParquesModule {}
