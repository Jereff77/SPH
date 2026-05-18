import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { IaSesion } from '../types'

interface Props {
  sesiones: IaSesion[]
  sesionActual: string | null
  cargando: boolean
  sinTokens: boolean
  onNueva: () => void
  onSeleccionar: (uuid: string) => void
  onRenombrar: (uuid: string, titulo: string) => Promise<boolean>
  onEliminar: (uuid: string) => Promise<boolean>
  onClose?: () => void
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Dropdown renderizado vía portal (escapa del overflow-y-auto) ────────────
function DropdownMenu({
  anchorRect,
  confirmando,
  guardando,
  onRenombrar,
  onEliminar,
  onConfirmar,
  onCancelarConfirm,
  onClose,
}: {
  anchorRect: DOMRect
  confirmando: boolean
  guardando: boolean
  onRenombrar: () => void
  onEliminar: () => void
  onConfirmar: () => void
  onCancelarConfirm: () => void
  onClose: () => void
}) {
  // Posición: justo debajo y alineado a la derecha del botón
  const top   = anchorRect.bottom + 4
  const right = window.innerWidth - anchorRect.right

  return createPortal(
    <>
      {/* Backdrop invisible */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
      />
      {/* Menú */}
      <div
        className="fixed z-[9999] w-40 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 text-sm"
        style={{ top, right }}
      >
        {!confirmando ? (
          <>
            <button
              onClick={e => { e.stopPropagation(); onRenombrar() }}
              className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700 flex items-center gap-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Renombrar
            </button>
            <button
              onClick={e => { e.stopPropagation(); onEliminar() }}
              className="w-full text-left px-3 py-2 text-red-400 hover:bg-slate-700 flex items-center gap-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Eliminar
            </button>
          </>
        ) : (
          <div className="px-3 py-2">
            <p className="text-xs text-slate-300 mb-2">¿Eliminar esta conversación?</p>
            <div className="flex gap-1">
              <button
                onClick={e => { e.stopPropagation(); onConfirmar() }}
                disabled={guardando}
                className="flex-1 text-xs py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {guardando ? '...' : 'Sí, eliminar'}
              </button>
              <button
                onClick={e => { e.stopPropagation(); onCancelarConfirm() }}
                className="flex-1 text-xs py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

// ─── Item individual ─────────────────────────────────────────────────────────
function SesionItem({
  s, activa, onSeleccionar, onRenombrar, onEliminar,
}: {
  s: IaSesion
  activa: boolean
  onSeleccionar: () => void
  onRenombrar: (titulo: string) => Promise<boolean>
  onEliminar: () => Promise<boolean>
}) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [anchorRect, setAnchorRect]   = useState<DOMRect | null>(null)
  const [editando, setEditando]       = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [titulo, setTitulo]           = useState(s.titulo || 'Conversación')
  const [guardando, setGuardando]     = useState(false)
  const btnRef  = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editando) inputRef.current?.select()
  }, [editando])

  // Sincronizar título si cambia externamente
  useEffect(() => {
    if (!editando) setTitulo(s.titulo || 'Conversación')
  }, [s.titulo, editando])

  const abrirMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect())
    setMenuAbierto(v => !v)
    setConfirmando(false)
  }, [])

  const cerrarMenu = useCallback(() => {
    setMenuAbierto(false)
    setConfirmando(false)
  }, [])

  const handleRenombrar = async () => {
    const val = titulo.trim()
    if (!val || val === (s.titulo || 'Conversación')) { setEditando(false); return }
    setGuardando(true)
    await onRenombrar(val)
    setGuardando(false)
    setEditando(false)
  }

  const handleEliminar = async () => {
    setGuardando(true)
    await onEliminar()
    setGuardando(false)
    cerrarMenu()
  }

  return (
    <div className={`group relative rounded-lg mb-1 ${activa ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
      {editando ? (
        /* ── Modo edición inline ── */
        <div className="px-3 py-2">
          <input
            ref={inputRef}
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRenombrar()
              if (e.key === 'Escape') { setTitulo(s.titulo || 'Conversación'); setEditando(false) }
            }}
            disabled={guardando}
            className="w-full text-sm bg-slate-800 text-white border border-slate-500 rounded px-2 py-1 outline-none focus:border-blue-400"
          />
          <div className="flex gap-1 mt-1.5">
            <button
              onClick={handleRenombrar}
              disabled={guardando}
              className="flex-1 text-xs py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
            >
              {guardando ? '...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setTitulo(s.titulo || 'Conversación'); setEditando(false) }}
              className="flex-1 text-xs py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        /* ── Modo normal ── */
        <button onClick={onSeleccionar} className="w-full text-left px-3 py-2 pr-8">
          <div className={`text-sm truncate ${activa ? 'text-white' : 'text-slate-200'}`}>
            {s.titulo || 'Conversación'}
          </div>
          <div className={`text-xs mt-0.5 ${activa ? 'text-blue-200' : 'text-slate-500'}`}>
            {fmtFecha(s.fc)}
          </div>
        </button>
      )}

      {/* Botón "•••" */}
      {!editando && (
        <button
          ref={btnRef}
          onClick={abrirMenu}
          className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
            menuAbierto
              ? 'text-white bg-slate-600 opacity-100'
              : 'text-slate-500 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-slate-600'
          }`}
          title="Opciones"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      )}

      {/* Dropdown vía portal */}
      {menuAbierto && anchorRect && (
        <DropdownMenu
          anchorRect={anchorRect}
          confirmando={confirmando}
          guardando={guardando}
          onRenombrar={() => { cerrarMenu(); setTitulo(s.titulo || 'Conversación'); setEditando(true) }}
          onEliminar={() => setConfirmando(true)}
          onConfirmar={handleEliminar}
          onCancelarConfirm={() => setConfirmando(false)}
          onClose={cerrarMenu}
        />
      )}
    </div>
  )
}

// ─── Sidebar principal ───────────────────────────────────────────────────────
export function Sidebar({ sesiones, sesionActual, cargando, sinTokens, onNueva, onSeleccionar, onRenombrar, onEliminar, onClose }: Props) {
  return (
    <aside className="w-64 bg-[#1e293b] text-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Conversaciones</span>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white md:hidden">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Botón nueva conversación */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNueva}
          disabled={sinTokens}
          className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva conversación
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {cargando ? (
          <p className="text-center text-slate-500 text-xs mt-6">Cargando...</p>
        ) : sinTokens ? (
          <p className="text-center text-slate-400 text-xs mt-6 px-3 leading-relaxed">
            El asistente no está disponible en este momento.<br />Contacta a soporte para continuar.
          </p>
        ) : sesiones.length === 0 ? (
          <p className="text-center text-slate-500 text-xs mt-6">Sin conversaciones aún.<br />Toca &ldquo;+ Nueva conversación&rdquo;.</p>
        ) : (
          sesiones.map(s => (
            <SesionItem
              key={s.uuid}
              s={s}
              activa={sesionActual === s.uuid}
              onSeleccionar={() => onSeleccionar(s.uuid)}
              onRenombrar={titulo => onRenombrar(s.uuid, titulo)}
              onEliminar={() => onEliminar(s.uuid)}
            />
          ))
        )}
      </div>
    </aside>
  )
}
