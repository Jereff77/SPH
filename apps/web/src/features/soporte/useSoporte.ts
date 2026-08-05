import { useCallback, useEffect, useState } from 'react';
import {
  soporteApi,
  type MensajeSoporte,
  type PropuestaTicket,
  type SesionSoporte,
} from './soporte.api';
import { capturarPantalla } from './screen-capture';
import { ultimosErroresApi } from '@/lib/api';

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

  /**
   * Ejecuta un turno del chat. Si el modelo pide ver la pantalla (`pideCaptura`)
   * y este turno lo permitía, captura y se REENVÍA solo con
   * `permitirCaptura: false` (anti-bucle: una captura por cadena).
   */
  const ejecutarTurno = useCallback(
    async (
      textoInicial: string,
      rutaActual: string | undefined,
      capturaInicial: string | undefined,
      permitirCapturaInicial: boolean,
      sesionInicial: string | null,
    ): Promise<void> => {
      let texto = textoInicial;
      let captura = capturaInicial;
      let permitirCaptura = permitirCapturaInicial;
      let sesion = sesionInicial;
      for (;;) {
        setMensajes((prev) => [
          ...prev,
          {
            tipo: 'user',
            texto: captura ? `📸 ${texto}` : texto,
            fc: new Date().toISOString(),
            imagen: captura,
          },
        ]);
        const data = await soporteApi.enviar(texto, {
          sessionId: sesion ?? undefined,
          rutaActual,
          captura,
          permitirCaptura,
          erroresRecientes: ultimosErroresApi(),
        });
        setSessionId(data.sessionId);
        recordarSesion(data.sessionId);
        setModulosUlt(data.modulos ?? []);
        setPuedeEscalar(!!data.escalable);
        if (data.respuesta) {
          setMensajes((prev) => [
            ...prev,
            {
              tipo: 'ai',
              texto: data.respuesta,
              fc: new Date().toISOString(),
              escalable: !!data.escalable,
            },
          ]);
        }
        if (!data.pideCaptura || !permitirCaptura) return;
        // La respuesta ya incluye el aviso "Déjame ver tu pantalla… 👀" (backend).
        try {
          const shot = await capturarPantalla();
          texto = 'Esta es mi pantalla ahora mismo.';
          captura = shot.dataUrl;
          permitirCaptura = false;
          sesion = data.sessionId;
        } catch {
          setMensajes((prev) => [
            ...prev,
            {
              tipo: 'ai',
              texto:
                'No pude capturar tu pantalla automáticamente. Prueba el botón 📷 para adjuntarla tú mismo.',
              fc: new Date().toISOString(),
            },
          ]);
          return;
        }
      }
    },
    [recordarSesion],
  );

  const enviar = useCallback(
    async (texto: string, rutaActual?: string, captura?: string) => {
      const t = texto.trim();
      if ((!t && !captura) || ocupado) return;
      setOcupado(true);
      setPuedeEscalar(false);
      try {
        await ejecutarTurno(t || 'Esta es mi pantalla.', rutaActual, captura, !captura, sessionId);
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
    [ocupado, sessionId, ejecutarTurno],
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
