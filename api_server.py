"""
Servidor API FastAPI para monitoreo y control del procesador de facturas
Proporciona endpoints REST y WebSocket para el dashboard web
"""

import asyncio
import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from supabase import create_client, Client
import uvicorn

from src.config import Config
from src.processor import FacturaProcessor
from src.logger import logger


# ============================================================================
# MODELOS PYDANTIC
# ============================================================================

class StatusResponse(BaseModel):
    """Respuesta de estado del sistema"""
    running: bool
    schedule_active: bool
    config: Dict[str, Any]
    stats: Dict[str, Any]
    last_activity: Optional[str] = None
    uptime_seconds: Optional[int] = None


class ConfigUpdate(BaseModel):
    """Modelo para actualizar configuración"""
    polling_interval: Optional[int] = Field(None, ge=10, le=3600, description="Intervalo de sondeo en segundos")
    polling_interval_idle: Optional[int] = Field(None, ge=30, le=3600, description="Intervalo idle en segundos")
    schedule_enabled: Optional[bool] = None
    schedule_start_time: Optional[str] = Field(None, pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    schedule_end_time: Optional[str] = Field(None, pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    schedule_days: Optional[str] = None


class LoginRequest(BaseModel):
    """Modelo para solicitud de login"""
    email: str = Field(..., description="Email del usuario")
    password: str = Field(..., description="Contraseña del usuario")


class LoginResponse(BaseModel):
    """Respuesta de login exitoso"""
    access_token: str
    user: Dict[str, Any]


class ControlResponse(BaseModel):
    """Respuesta de operaciones de control"""
    success: bool
    message: str
    action: str


class LogEntry(BaseModel):
    """Entrada de log"""
    timestamp: str
    level: str
    message: str


# ============================================================================
# CONFIGURACIÓN FASTAPI
# ============================================================================

# Instancia global del procesador
processor_instance: Optional[FacturaProcessor] = None
start_time: Optional[datetime] = None

# Cliente Supabase para autenticación
supabase: Client = create_client(
    Config.SUPABASE_URL,
    Config.SUPABASE_KEY
)

# Security para Bearer tokens
security = HTTPBearer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager para FastAPI"""
    global processor_instance, start_time

    logger.info("🚀 Iniciando servidor API FastAPI...")
    start_time = datetime.now()

    # Inicializar el procesador pero NO iniciarlo automáticamente
    processor_instance = FacturaProcessor()
    logger.info("✅ Procesador inicializado (estado: detenido)")

    yield

    # Cleanup
    logger.info("🛑 Deteniendo servidor API FastAPI...")
    if processor_instance and processor_instance.running:
        processor_instance.stop_processing()
    logger.info("✅ Servidor API detenido")


app = FastAPI(
    title="Sistema de Procesamiento de Facturas - API",
    description="API para monitoreo y control del procesador de facturas y depósitos",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar orígenes permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# DEPENDENCIAS DE AUTENTICACIÓN
# ============================================================================

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verifica el token JWT de Supabase y retorna el usuario

    Args:
        credentials: Credenciales HTTP Bearer

    Returns:
        Dict con información del usuario

    Raises:
        HTTPException: Si el token es inválido
    """
    try:
        token = credentials.credentials
        # Verificar token con Supabase
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado"
            )

        return user_response.user

    except Exception as e:
        logger.error(f"Error verificando token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )


async def verify_admin(user: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    """
    Verifica que el usuario tenga rol de admin

    Args:
        user: Usuario autenticado

    Returns:
        Dict con información del usuario

    Raises:
        HTTPException: Si el usuario no es admin
    """
    # Verificar si el usuario tiene el role 'admin' en user_metadata o app_metadata
    user_role = user.user_metadata.get("role") or user.app_metadata.get("role")

    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador"
        )

    return user


# ============================================================================
# ENDPOINTS DE AUTENTICACIÓN
# ============================================================================

@app.post("/api/auth/login", response_model=LoginResponse, tags=["Autenticación"])
async def login(request: LoginRequest):
    """
    Autentica un usuario usando Supabase Auth

    Args:
        request: Credenciales de login

    Returns:
        LoginResponse con token y usuario
    """
    try:
        # Autenticar con Supabase
        auth_response = supabase.auth.sign_in_with_password(
            email=request.email,
            password=request.password
        )

        if not auth_response or not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas"
            )

        user = auth_response.user
        access_token = auth_response.session.access_token

        logger.info(f"✅ Usuario autenticado: {user.email}")

        return LoginResponse(
            access_token=access_token,
            user={
                "id": user.id,
                "email": user.email,
                "role": user.user_metadata.get("role", "user")
            }

        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al autenticar: {str(e)}"
        )


@app.post("/api/auth/logout", tags=["Autenticación"])
async def logout(user: Dict[str, Any] = Depends(verify_token)):
    """
    Cierra la sesión del usuario

    Args:
        user: Usuario autenticado

    Returns:
        Mensaje de éxito
    """
    try:
        supabase.auth.sign_out()
        logger.info(f"✅ Usuario cerró sesión: {user.get('email')}")
        return {"message": "Sesión cerrada correctamente"}
    except Exception as e:
        logger.error(f"Error en logout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cerrar sesión"
        )


@app.get("/api/auth/me", tags=["Autenticación"])
async def get_current_user(user: Dict[str, Any] = Depends(verify_token)):
    """
    Obtiene información del usuario autenticado

    Args:
        user: Usuario autenticado

    Returns:
        Información del usuario
    """
    return {
        "id": user.id,
        "email": user.email,
        "role": user.user_metadata.get("role", "user"),
        "created_at": user.created_at
    }


# ============================================================================
# ENDPOINTS DE ESTADO Y MONITOREO
# ============================================================================

@app.get("/api/status", response_model=StatusResponse, tags=["Monitoreo"])
async def get_status(user: Dict[str, Any] = Depends(verify_token)):
    """
    Obtiene el estado actual del procesador y sistema

    Args:
        user: Usuario autenticado

    Returns:
        StatusResponse con estado completo
    """
    try:
        if not processor_instance:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Procesador no inicializado"
            )

        # Obtener estado del procesador
        status = processor_instance.get_status()

        # Calcular uptime
        uptime_seconds = None
        if start_time:
            uptime_seconds = int((datetime.now() - start_time).total_seconds())

        # Obtener info de horarios
        schedule_info = Config.get_schedule_info()
        schedule_active = Config.is_schedule_active()

        return StatusResponse(
            running=status.get('running', False),
            schedule_active=schedule_active,
            config={
                "imap_server": Config.IMAP_SERVER,
                "imap_user": Config.IMAP_USER,
                "supabase_url": Config.SUPABASE_URL,
                "polling_interval": Config.POLLING_INTERVAL,
                "polling_interval_idle": Config.POLLING_INTERVAL_IDLE,
                "log_level": Config.LOG_LEVEL,
                "schedule": schedule_info
            },
            stats=status,
            last_activity=datetime.now().isoformat(),
            uptime_seconds=uptime_seconds
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo estado: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener estado: {str(e)}"
        )


# ============================================================================
# ENDPOINTS DE CONFIGURACIÓN
# ============================================================================

@app.get("/api/config", tags=["Configuración"])
async def get_config(user: Dict[str, Any] = Depends(verify_token)):
    """
    Obtiene la configuración actual del sistema

    Args:
        user: Usuario autenticado

    Returns:
        Configuración actual
    """
    try:
        schedule_info = Config.get_schedule_info()

        return {
            "polling_interval": Config.POLLING_INTERVAL,
            "polling_interval_idle": Config.POLLING_INTERVAL_IDLE,
            "log_level": Config.LOG_LEVEL,
            "schedule_enabled": schedule_info['enabled'],
            "schedule_start_time": schedule_info['start_time'],
            "schedule_end_time": schedule_info['end_time'],
            "schedule_days": schedule_info['days'],
            "schedule_timezone": schedule_info['timezone']
        }

    except Exception as e:
        logger.error(f"Error obteniendo configuración: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener configuración: {str(e)}"
        )


@app.put("/api/config", tags=["Configuración"])
async def update_config(
    config_update: ConfigUpdate,
    user: Dict[str, Any] = Depends(verify_admin)
):
    """
    Actualiza la configuración del sistema

    Args:
        config_update: Configuración a actualizar
        user: Usuario admin autenticado

    Returns:
        Configuración actualizada
    """
    try:
        # Ruta al archivo .env
        env_path = Path(__file__).parent / '.env'

        if not env_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Archivo .env no encontrado"
            )

        # Leer archivo .env actual
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # Actualizar líneas según config_update
        updated_lines = []
        updates = {
            'POLLING_INTERVAL': config_update.polling_interval,
            'POLLING_INTERVAL_IDLE': config_update.polling_interval_idle,
            'SCHEDULE_ENABLED': 'true' if config_update.schedule_enabled else 'false',
            'SCHEDULE_START_TIME': config_update.schedule_start_time,
            'SCHEDULE_END_TIME': config_update.schedule_end_time,
            'SCHEDULE_DAYS': config_update.schedule_days,
        }

        for line in lines:
            updated = False
            for key, value in updates.items():
                if value is not None and line.startswith(f'{key}='):
                    updated_lines.append(f'{key}={value}\n')
                    updates[key] = None  # Marcado como actualizado
                    updated = True
                    break
            if not updated:
                updated_lines.append(line)

        # Escribir archivo .env actualizado
        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(updated_lines)

        logger.info(f"✅ Configuración actualizada por {user.get('email')}")

        # Recargar configuración
        Config.load_config()

        return await get_config(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error actualizando configuración: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar configuración: {str(e)}"
        )


# ============================================================================
# ENDPOINTS DE CONTROL DEL PROCESADOR
# ============================================================================

@app.post("/api/control/start", response_model=ControlResponse, tags=["Control"])
async def start_processor(user: Dict[str, Any] = Depends(verify_admin)):
    """
    Inicia el procesador de facturas

    Args:
        user: Usuario admin autenticado

    Returns:
        ControlResponse con resultado
    """
    try:
        if not processor_instance:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Procesador no inicializado"
            )

        if processor_instance.running:
            return ControlResponse(
                success=True,
                message="El procesador ya está en ejecución",
                action="start"
            )

        # Iniciar procesador en un thread separado
        import threading
        thread = threading.Thread(target=processor_instance.start_processing, daemon=True)
        thread.start()

        logger.info(f"✅ Procesador iniciado por {user.get('email')}")

        return ControlResponse(
            success=True,
            message="Procesador iniciado correctamente",
            action="start"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error iniciando procesador: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al iniciar procesador: {str(e)}"
        )


@app.post("/api/control/stop", response_model=ControlResponse, tags=["Control"])
async def stop_processor(user: Dict[str, Any] = Depends(verify_admin)):
    """
    Detiene el procesador de facturas

    Args:
        user: Usuario admin autenticado

    Returns:
        ControlResponse con resultado
    """
    try:
        if not processor_instance:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Procesador no inicializado"
            )

        if not processor_instance.running:
            return ControlResponse(
                success=True,
                message="El procesador ya está detenido",
                action="stop"
            )

        processor_instance.stop_processing()

        logger.info(f"✅ Procesador detenido por {user.get('email')}")

        return ControlResponse(
            success=True,
            message="Procesador detenido correctamente",
            action="stop"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deteniendo procesador: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al detener procesador: {str(e)}"
        )


@app.post("/api/control/restart", response_model=ControlResponse, tags=["Control"])
async def restart_processor(user: Dict[str, Any] = Depends(verify_admin)):
    """
    Reinicia el procesador de facturas

    Args:
        user: Usuario admin autenticado

    Returns:
        ControlResponse con resultado
    """
    try:
        # Detener si está corriendo
        if processor_instance and processor_instance.running:
            processor_instance.stop_processing()
            await asyncio.sleep(2)  # Esperar a que detenga

        # Iniciar nuevamente
        import threading
        thread = threading.Thread(target=processor_instance.start_processing, daemon=True)
        thread.start()

        logger.info(f"✅ Procesador reiniciado por {user.get('email')}")

        return ControlResponse(
            success=True,
            message="Procesador reiniciado correctamente",
            action="restart"
        )

    except Exception as e:
        logger.error(f"Error reiniciando procesador: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al reiniciar procesador: {str(e)}"
        )


# ============================================================================
# ENDPOINTS DE LOGS
# ============================================================================

@app.get("/api/logs", tags=["Logs"])
async def get_logs(
    lines: int = 100,
    level: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token)
):
    """
    Obtiene las últimas líneas del log

    Args:
        lines: Número de líneas a retornar
        level: Filtrar por nivel (DEBUG, INFO, WARNING, ERROR)
        user: Usuario autenticado

    Returns:
        Lista de entradas de log
    """
    try:
        # Encontrar el archivo de log más reciente
        logs_dir = Path(__file__).parent / 'logs'
        if not logs_dir.exists():
            return []

        log_files = sorted(logs_dir.glob('facturas_*.log'), reverse=True)
        if not log_files:
            return []

        latest_log = log_files[0]

        # Leer últimas líneas
        with open(latest_log, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()

        # Tomar últimas N líneas
        lines_to_return = all_lines[-lines:] if len(all_lines) > lines else all_lines

        # Filtrar por nivel si se especifica
        if level:
            lines_to_return = [l for l in lines_to_return if f'] {level} [' in l]

        # Parsear líneas a objetos
        logs = []
        for line in lines_to_return:
            try:
                # Formato esperado: 2024-12-28 10:30:45,123 - root - INFO - Message
                if ' - ' in line:
                    parts = line.split(' - ', 3)
                    if len(parts) >= 4:
                        timestamp = parts[0]
                        logger_name = parts[1]
                        log_level = parts[2]
                        message = parts[3].strip()

                        logs.append({
                            "timestamp": timestamp,
                            "logger": logger_name,
                            "level": log_level,
                            "message": message
                        })
            except Exception:
                # Si no se puede parsear, incluir como está
                logs.append({
                    "timestamp": "",
                    "logger": "",
                    "level": "INFO",
                    "message": line.strip()
                })

        return logs

    except Exception as e:
        logger.error(f"Error obteniendo logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener logs: {str(e)}"
        )


# ============================================================================
# WEBSOCKET PARA ACTUALIZACIONES EN TIEMPO REAL
# ============================================================================

class ConnectionManager:
    """Maneja conexiones WebSocket"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Endpoint WebSocket para actualizaciones en tiempo real

    Envia actualizaciones periódicas sobre:
    - Estado del procesador
    - Nuevas entradas de log
    - Estadísticas
    """
    await manager.connect(websocket)

    try:
        while True:
            # Enviar estado actual
            if processor_instance:
                status = processor_instance.get_status()
                schedule_active = Config.is_schedule_active()

                await websocket.send_json({
                    "type": "status",
                    "data": {
                        "running": status.get('running', False),
                        "schedule_active": schedule_active,
                        "stats": status,
                        "timestamp": datetime.now().isoformat()
                    }
                })

            # Esperar antes de próxima actualización
            await asyncio.sleep(5)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Cliente WebSocket desconectado")
    except Exception as e:
        logger.error(f"Error en WebSocket: {str(e)}")
        manager.disconnect(websocket)


# ============================================================================
# ENDPOINT DE SALUD
# ============================================================================

@app.get("/health", tags=["Sistema"])
async def health_check():
    """Endpoint de salud para load balancers y monitores"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "facturas-api"
    }


# ============================================================================
# EJECUCIÓN DEL SERVIDOR
# ============================================================================

if __name__ == "__main__":
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
