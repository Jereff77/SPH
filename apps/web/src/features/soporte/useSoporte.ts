import { useCallback, useEffect, useState } from 'react';
import {
  soporteApi,
  type MensajeSoporte,
  type PropuestaTicket,
  type SesionSoporte,
} from './soporte.api';

// La conversación en curso se recuerda entre recargas (el historial completo vive
// server-side; aquí solo guardamos cuál es la sesión activa).
const LS_SESION = 'sph_soporte_session';

/**
 * Lógica del Agente de IA de Soporte (widget flotante). El frontend NO habla con
 * Supabase: todo pasa por `soporteApi` (backend proxy). La persistencia es
 * server-side; al recargar se retoma la última conversación y se pueden abrir las
 * anteriores.
 */
export function useSoporte() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeSoporte[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(false);
  // Datos de la última respuesta del agente para la escalación.
  const [puedeEscalar, setPuedeEscalar] = useState(false);
  const [modulosUlt, setModulosUlt] = useState<string[]>([]);

  // Al montar: retoma la conversación en curso (si la había) cargando sus mensajes.
  useEffect(() => {
    const guardada = localStorage.getItem(LS_SESION);
    if (!guardada) return;
    setCargando(true);
    soporteApi
      .mensajes(guardada)
      .then((msgs) => {
        setSessionId(guardada);
        setMensajes(msgs);
        const ultAi = [...msgs].reverse().find((m) => m.tipo === 'ai');
        setPuedeEscalar(!!ultAi?.escalable);
      })
      .catch(() => {
        // La sesión ya no existe o no es accesible: empezamos limpio.
        localStorage.removeItem(LS_SESION);
      })
      .finally(() => setCargando(false));
  }, []);

  const recordarSesion = useCallback((id: string | null) => {
    if (id) localStorage.setItem(LS_SESION, id);
    else localStorage.removeItem(LS_SESION);
  }, []);

  const nuevaConversacion = useCallback(() => {
    setSessionId(null);
    setMensajes([]);
    setPuedeEscalar(false);
    setModulosUlt([]);
    recordarSesion(null);
  }, [recordarSesion]);

  const enviar = useCallback(
    async (texto: string, rutaActual?: string) => {
      const t = texto.trim();
      if (!t || ocupado) return;
      setOcupado(true);
      setPuedeEscalar(false);
      setMensajes((prev) => [...prev, { tipo: 'user', texto: t, fc: new Date().toISOString() }]);
      try {
        const data = await soporteApi.enviar(t, sessionId ?? undefined, rutaActual);
        setSessionId(data.sessionId);
        recordarSesion(data.sessionId);
        setModulosUlt(data.modulos ?? []);
        setPuedeEscalar(!!data.escalable);
        setMensajes((prev) => [
          ...prev,
          {
            tipo: 'ai',
            texto: data.respuesta || 'Sin respuesta del servidor.',
            fc: new Date().toISOString(),
            escalable: !!data.escalable,
          },
        ]);
      } catch (e) {
        console.error('Error en soporte:', e);
        setMensajes((prev) => [
          ...prev,
          {
            tipo: 'ai',
            texto: 'Tuve un problema para responder. Intenta de nuevo en un momento.',
            fc: new Date().toISOString(),
          },
        ]);
      } finally {
        setOcupado(false);
      }
    },
    [ocupado, sessionId, recordarSesion],
  );

  // --- Conversaciones anteriores -------------------------------------------

  /** Lista las conversaciones previas del usuario (para el panel de historial). */
  const listarSesiones = useCallback((): Promise<SesionSoporte[]> => soporteApi.sesiones(), []);

  /** Abre una conversación anterior cargando sus mensajes. */
  const abrirSesion = useCallback(
    async (id: string) => {
      setCargando(true);
      try {
        const msgs = await soporteApi.mensajes(id);
        setSessionId(id);
        recordarSesion(id);
        setMensajes(msgs);
        setModulosUlt([]);
        const ultAi = [...msgs].reverse().find((m) => m.tipo === 'ai');
        setPuedeEscalar(!!ultAi?.escalable);
      } catch (e) {
        console.error('No se pudo abrir la conversación:', e);
      } finally {
        setCargando(false);
      }
    },
    [recordarSesion],
  );

  /** Renombra una conversación (el título lo ve el usuario en el historial). */
  const renombrarSesion = useCallback(
    (id: string, titulo: string) => soporteApi.renombrar(id, titulo.trim()),
    [],
  );

  /** Elimina una conversación; si es la activa, empieza una nueva. */
  const eliminarSesion = useCallback(
    async (id: string) => {
      await soporteApi.eliminar(id);
      if (id === sessionId) nuevaConversacion();
    },
    [sessionId, nuevaConversacion],
  );

  /**
   * Pide a la IA que redacte (asunto + resumen) el ticket analizando la
   * conversación. Devuelve la propuesta editable; si falla, null (el widget usa
   * el último mensaje como respaldo).
   */
  const proponerTicket = useCallback(
    async (rutaActual?: string): Promise<PropuestaTicket | null> => {
      if (!sessionId) return null;
      try {
        return await soporteApi.proponerTicket(sessionId, rutaActual);
      } catch (e) {
        console.error('Error proponiendo ticket:', e);
        return null;
      }
    },
    [sessionId],
  );

  /** Crea un ticket de soporte (escalación), solo tras confirmación del usuario. */
  const escalar = useCallback(
    async (asunto: string, resumen: string, rutaActual?: string): Promise<string | null> => {
      if (!sessionId) return null;
      try {
        const { ticketId } = await soporteApi.escalar({
          sessionId,
          asunto: asunto.trim(),
          resumen: resumen.trim(),
          modulo: modulosUlt[0],
          rutaActual,
        });
        setPuedeEscalar(false);
        setMensajes((prev) => [
          ...prev,
          {
            tipo: 'ai',
            texto: `✅ Listo, generé el ticket de soporte. Un responsable lo revisará. Folio: ${ticketId}.`,
            fc: new Date().toISOString(),
          },
        ]);
        return ticketId;
      } catch (e) {
        console.error('Error escalando:', e);
        return null;
      }
    },
    [sessionId, modulosUlt],
  );

  return {
    sessionId,
    mensajes,
    ocupado,
    cargando,
    puedeEscalar,
    enviar,
    proponerTicket,
    escalar,
    nuevaConversacion,
    listarSesiones,
    abrirSesion,
    renombrarSesion,
    eliminarSesion,
  };
}
