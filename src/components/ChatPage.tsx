import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useChat } from '../hooks/useChat'
import { Sidebar } from './Sidebar'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'

interface Props {
  user: User
}

export function ChatPage({ user }: Props) {
  const { sesiones, sesionActual, mensajes, ocupado, sinTokens, cargando, cargarSesiones, nuevaSesion, seleccionarSesion, enviar, renombrarSesion, eliminarSesion } = useChat(user)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { cargarSesiones() }, [cargarSesiones])

  const handleNueva = async () => {
    setSidebarOpen(false)
    await nuevaSesion()
  }

  const handleSeleccionar = (uuid: string) => {
    seleccionarSesion(uuid)
    setSidebarOpen(false)
  }

  const sesionNombre = sesionActual
    ? sesiones.find(s => s.uuid === sesionActual)?.titulo || 'Conversación'
    : 'Selecciona o inicia una conversación'

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar — visible siempre en desktop, overlay en móvil */}
      <div className={`
        fixed inset-0 z-30 md:static md:z-auto md:flex
        ${sidebarOpen ? 'flex' : 'hidden'}
      `}>
        {/* Overlay móvil */}
        <div
          className="absolute inset-0 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="relative z-10 h-full">
          <Sidebar
            sesiones={sesiones}
            sesionActual={sesionActual}
            cargando={cargando}
            sinTokens={sinTokens}
            onNueva={handleNueva}
            onSeleccionar={handleSeleccionar}
            onRenombrar={renombrarSesion}
            onEliminar={eliminarSesion}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 flex-shrink-0">
          {/* Botón hamburguesa — solo móvil */}
          <button
            className="md:hidden text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Asistente SPH</div>
            <div className="text-xs text-slate-400 truncate max-w-xs">{sesionNombre}</div>
          </div>
        </div>

        {/* Mensajes */}
        <ChatMessages mensajes={mensajes} ocupado={ocupado} />

        {/* Input */}
        <ChatInput onEnviar={enviar} disabled={ocupado} sinTokens={sinTokens} />
      </div>
    </div>
  )
}
