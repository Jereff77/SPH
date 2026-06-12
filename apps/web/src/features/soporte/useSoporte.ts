import { useCallback, useState } from 'react';
import { soporteApi, type MensajeSoporte } from './soporte.api';

/**
 * Lógica del Agente de IA de Soporte (widget flotante). El frontend NO habla con
 * Supabase: todo pasa por `soporteApi` (backend proxy). Mantiene una conversación
 * en curso; "nueva conversación" la reinicia. La persistencia es server-side.
 */
export function useSoporte() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeSoporte[]>([]);
  const [ocupado, setOcupado] = useState(false);
  // Datos de la última respuesta del agente para la escalación.
  const [puedeEscalar, setPuedeEscalar] = useState(false);
  const [modulosUlt, setModulosUlt] = useState<string[]>([]);

  const nuevaConversacion = useCallback(() => {
    setSessionId(null);
    setMensajes([]);
    setPuedeEscalar(false);
    setModulosUlt([]);
  }, []);

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
    [ocupado, sessionId],
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
    mensajes,
    ocupado,
    puedeEscalar,
    enviar,
    escalar,
    nuevaConversacion,
  };
}
