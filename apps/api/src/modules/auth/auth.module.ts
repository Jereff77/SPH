import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

/** Módulo de autenticación (login/refresh/logout/me). El backend es proxy de auth. */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthApiModule {}
