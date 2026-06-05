import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service.js';

/** Global: el SupabaseService está disponible en toda la app sin re-importar. */
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
