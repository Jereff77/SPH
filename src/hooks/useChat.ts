import { useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { IaSesion, ChatMessage } from '../types'

const TOKEN_LIMIT = Number(import.meta.env.VITE_TOKEN_LIMIT) || 1_000_000

export function useChat(user: User) {
  const [sesiones, setSesiones] = useState<IaSesion[]>([])
  const [sesionActual, setSesionActual] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<ChatMessage[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [sinTokens, setSinTokens] = useState(false)
  const [cargando, setCargando] = useState(false)

  const cargarSesiones = useCallback(async () => {
    setCargando(true)
    try {
      const { data: tokensOk } = await supabase.rpc('ia_tokens_disponibles', { p_limite: TOKEN_LIMIT })
      if (tokensOk === false) { setSinTokens(true); return }

      const { data } = await supabase
        .from('iaSesiones')
        .select('uuid, titulo, fc')
        .eq('uid_usuario', user.id)
        .eq('status', true)
        .order('fc', { ascending: false })
        .limit(40)
      setSesiones(data || [])
    } finally {
      setCargando(false)
    }
  }, [user.id])

  const nuevaSesion = useCallback(async (): Promise<string> => {
    const { data } = await supabase.rpc('ia_nueva_sesion', { p_uid_usuario: user.id })
    const sid: string = data?.session_id ?? data
    setSesionActual(sid)
    setMensajes([])
    await cargarSesiones()
    return sid
  }, [user.id, cargarSesiones])

  const seleccionarSesion = useCallback(async (uuid: string) => {
    setSesionActual(uuid)
    setMensajes([]) // limpiar mientras carga
    const { data, error } = await supabase
      .from('iaConversaciones')
      .select('pregunta, respuesta, fc, grafico_json')
      .eq('session_id', uuid)
      .eq('uid_usuario', user.id)
      .order('fc', { ascending: true })

    if (error) {
      console.error('Error cargando mensajes:', error)
      return
    }

    const msgs: ChatMessage[] = []
    for (const m of data || []) {
      msgs.push({ tipo: 'user', texto: m.pregunta, fc: m.fc })
      msgs.push({
        tipo: 'ai',
        texto: m.respuesta,
        fc: m.fc,
        grafico: m.grafico_json ?? undefined,
      })
    }
    setMensajes(msgs)
  }, [user.id])

  const enviar = useCallback(async (texto: string) => {
    if (ocupado || !texto.trim() || sinTokens) return

    let sid = sesionActual
    if (!sid) sid = await nuevaSesion()

    // Capturar si es el primer mensaje ANTES de modificar el estado
    const esPrimerMensaje = mensajes.length === 0

    setOcupado(true)
    setMensajes(prev => [...prev, { tipo: 'user', texto, fc: new Date().toISOString() }])

    try {
      const { data, error } = await supabase.functions.invoke('ia-chat', {
        body: { chatInput: texto, session_id: sid },
      })

      if (error) throw error

      setMensajes(prev => [...prev, {
        tipo: 'ai',
        texto: data?.respuesta || 'Sin respuesta del servidor.',
        fc: new Date().toISOString(),
        grafico: data?.grafico ?? undefined,
      }])

      // Auto-renombrar la sesión con el primer mensaje del usuario
      if (esPrimerMensaje && data?.respuesta) {
        const raw = texto.trim()
        const titulo = raw.charAt(0).toUpperCase() + raw.slice(1, 52) + (raw.length > 52 ? '...' : '')
        supabase
          .from('iaSesiones')
          .update({ titulo })
          .eq('uuid', sid)
          .then(() => {
            setSesiones(prev => prev.map(s => s.uuid === sid ? { ...s, titulo } : s))
          })
      }
    } catch (err) {
      console.error('Error enviando mensaje:', err)
      setMensajes(prev => [...prev, {
        tipo: 'ai',
        texto: 'Error de conexión. Intenta de nuevo en un momento.',
        fc: new Date().toISOString(),
      }])
    } finally {
      setOcupado(false)
    }
  }, [ocupado, sesionActual, mensajes.length, user.id, sinTokens, nuevaSesion])

  const renombrarSesion = useCallback(async (uuid: string, titulo: string) => {
    const { error } = await supabase
      .from('iaSesiones')
      .update({ titulo: titulo.trim() })
      .eq('uuid', uuid)
      .eq('uid_usuario', user.id)
    if (!error) {
      setSesiones(prev => prev.map(s => s.uuid === uuid ? { ...s, titulo: titulo.trim() } : s))
    }
    return !error
  }, [user.id])

  const eliminarSesion = useCallback(async (uuid: string) => {
    const { error } = await supabase
      .from('iaSesiones')
      .update({ status: false })
      .eq('uuid', uuid)
      .eq('uid_usuario', user.id)
    if (!error) {
      setSesiones(prev => prev.filter(s => s.uuid !== uuid))
      if (sesionActual === uuid) {
        setSesionActual(null)
        setMensajes([])
      }
    }
    return !error
  }, [user.id, sesionActual])

  return { sesiones, sesionActual, mensajes, ocupado, sinTokens, cargando, cargarSesiones, nuevaSesion, seleccionarSesion, enviar, renombrarSesion, eliminarSesion }
}
