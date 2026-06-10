import { useCallback, useState } from 'react';
import { montseApi, type SesionIA, type MensajeIA } from './montse.api';

/**
 * Lógica del chat Montse AI (adaptada de la rama `gpt`). En v2 el frontend NO
 * habla con Supabase: todo pasa por el backend (`montseApi`), que invoca la edge
 * function `ia-chat` y gestiona sesiones/mensajes con el uid del JWT.
 */
export function useMontse() {
  const [sesiones, setSesiones] = useState<SesionIA[]>([]);
  const [sesionActual, setSesionActual] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeIA[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [sinTokens, setSinTokens] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargarSesiones = useCallback(async () => {
    setCargando(true);
    try {
      const ok = await montseApi.tokens();
      if (ok === false) {
        setSinTokens(true);
        return;
      }
      const data = await montseApi.sesiones();
      setSesiones(data || []);
    } catch {
      /* noop */
    } finally {
      setCargando(false);
    }
  }, []);

  const nuevaSesion = useCallback(async (): Promise<string> => {
    const { session_id } = await montseApi.nuevaSesion();
    setSesionActual(session_id);
    setMensajes([]);
    await cargarSesiones();
    return session_id;
  }, [cargarSesiones]);

  const seleccionarSesion = useCallback(async (uuid: string) => {
    setSesionActual(uuid);
    setMensajes([]);
    try {
      const data = await montseApi.mensajes(uuid);
      setMensajes(data || []);
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    }
  }, []);

  const enviar = useCallback(
    async (texto: string) => {
      if (ocupado || !texto.trim() || sinTokens) return;
      let sid = sesionActual;
      if (!sid) sid = await nuevaSesion();

      const esPrimerMensaje = mensajes.length === 0;
      setOcupado(true);
      setMensajes((prev) => [...prev, { tipo: 'user', texto, fc: new Date().toISOString() }]);

      try {
        const data = await montseApi.enviar(sid, texto);
        setMensajes((prev) => [
          ...prev,
          {
            tipo: 'ai',
            texto: data?.respuesta || 'Sin respuesta del servidor.',
            fc: new Date().toISOString(),
            grafico: data?.grafico ?? undefined,
          },
        ]);

        // Auto-renombrar la sesión con el primer mensaje del usuario.
        if (esPrimerMensaje && data?.respuesta) {
          const raw = texto.trim();
          const titulo = raw.charAt(0).toUpperCase() + raw.slice(1, 52) + (raw.length > 52 ? '...' : '');
          montseApi
            .renombrar(sid, titulo)
            .then(() => setSesiones((prev) => prev.map((s) => (s.uuid === sid ? { ...s, titulo } : s))))
            .catch(() => {});
        }
      } catch (e) {
        console.error('Error enviando mensaje:', e);
        setMensajes((prev) => [
          ...prev,
          { tipo: 'ai', texto: 'Error de conexión. Intenta de nuevo en un momento.', fc: new Date().toISOString() },
        ]);
      } finally {
        setOcupado(false);
      }
    },
    [ocupado, sesionActual, mensajes.length, sinTokens, nuevaSesion],
  );

  const renombrarSesion = useCallback(async (uuid: string, titulo: string) => {
    try {
      await montseApi.renombrar(uuid, titulo.trim());
      setSesiones((prev) => prev.map((s) => (s.uuid === uuid ? { ...s, titulo: titulo.trim() } : s)));
      return true;
    } catch {
      return false;
    }
  }, []);

  const eliminarSesion = useCallback(
    async (uuid: string) => {
      try {
        await montseApi.eliminar(uuid);
        setSesiones((prev) => prev.filter((s) => s.uuid !== uuid));
        if (sesionActual === uuid) {
          setSesionActual(null);
          setMensajes([]);
        }
        return true;
      } catch {
        return false;
      }
    },
    [sesionActual],
  );

  return {
    sesiones,
    sesionActual,
    mensajes,
    ocupado,
    sinTokens,
    cargando,
    cargarSesiones,
    nuevaSesion,
    seleccionarSesion,
    enviar,
    renombrarSesion,
    eliminarSesion,
  };
}
