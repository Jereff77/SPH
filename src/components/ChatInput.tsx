import { useState, useRef, type KeyboardEvent } from 'react'

interface Props {
  onEnviar: (texto: string) => void
  disabled: boolean
  sinTokens: boolean
}

export function ChatInput({ onEnviar, disabled, sinTokens }: Props) {
  const [texto, setTexto] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!texto.trim() || disabled || sinTokens) return
    onEnviar(texto.trim())
    setTexto('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  if (sinTokens) {
    return (
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-center">
        <p className="text-sm text-slate-500">
          El asistente no está disponible en este momento.{' '}
          <span className="text-slate-400">Contacta a soporte para continuar.</span>
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 pt-3 border-t border-slate-200 bg-white flex-shrink-0">
      <div className={`flex items-end gap-2 bg-slate-50 border rounded-xl px-4 py-2 transition-colors ${
        disabled ? 'border-slate-200' : 'border-slate-200 focus-within:border-blue-400 focus-within:bg-white'
      }`}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKey}
          onInput={handleInput}
          placeholder="Escribe tu pregunta..."
          disabled={disabled}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-slate-800 placeholder-slate-400 min-h-[22px] max-h-[120px] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !texto.trim()}
          className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center flex-shrink-0 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      <p className="text-center text-[10.5px] text-slate-400 mt-2">
        ⚠️ El asistente puede cometer errores. Verifica información importante con tu asesor.
      </p>
    </div>
  )
}
