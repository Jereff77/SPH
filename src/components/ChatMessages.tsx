import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../types'
import { ChartBlock } from './ChartBlock'

interface Props {
  mensajes: ChatMessage[]
  ocupado: boolean
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

const AIIcon = () => (
  <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

// Icono descarga CSV
const IconCSV = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const IconImage = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
)

const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

// Convierte tablas markdown a CSV; si no hay tabla devuelve texto plano
function markdownToCSV(text: string): string {
  const lines = text.split('\n')
  const tableLines = lines.filter(l => l.trim().startsWith('|'))

  if (tableLines.length === 0) return text  // sin tabla → texto plano

  const csvRows: string[] = []
  for (const line of tableLines) {
    // Omitir filas separadoras: |---|---|
    if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue
    const cells = line
      .split('|')
      .slice(1, -1) // quitar primer y último elemento vacío
      .map(cell => {
        const val = cell.trim()
        // Quitar formato markdown: **bold**, *italic*
        const clean = val.replace(/\*\*?([^*]+)\*\*?/g, '$1').trim()
        // Escapar para CSV: si contiene coma, comilla o salto → envolver en comillas
        if (clean.includes(',') || clean.includes('"') || clean.includes('\n')) {
          return `"${clean.replace(/"/g, '""')}"`
        }
        return clean
      })
    csvRows.push(cells.join(','))
  }

  return csvRows.join('\n')
}

// Componente para cada mensaje IA — maneja sus propios refs y estado de copiado
function AIMessageItem({ m }: { m: ChatMessage }) {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState<'text' | 'image' | null>(null)

  const markCopied = (type: 'text' | 'image') => {
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCopyCSV = async () => {
    const csv = markdownToCSV(m.texto)
    try {
      await navigator.clipboard.writeText(csv)
      markCopied('text')
    } catch {
      console.error('Error copiando CSV')
    }
  }

  const handleCopyImage = async () => {
    if (!bubbleRef.current) return
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(bubbleRef.current, {
        backgroundColor: '#f8fafc',
        pixelRatio: 2,
        style: { borderRadius: '12px', padding: '16px' },
      })
      const blob = await fetch(dataUrl).then(r => r.blob())
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      markCopied('image')
    } catch {
      console.error('Error copiando imagen')
    }
  }

  return (
    <div className="self-start w-full max-w-[92%] flex gap-2">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-blue-50 border border-blue-100 mt-0.5">
        <AIIcon />
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        {/* Burbuja */}
        <div
          ref={bubbleRef}
          className="px-4 py-3 text-sm leading-relaxed bg-slate-50 border border-slate-200 rounded-tr-xl rounded-br-xl rounded-bl-xl text-slate-800 overflow-x-auto"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ children }) => (
                <div className="overflow-x-auto my-2">
                  <table className="text-xs border-collapse w-full">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-slate-200">{children}</thead>,
              th: ({ children }) => (
                <th className="border border-slate-300 px-3 py-1.5 text-left font-semibold text-slate-700 whitespace-nowrap">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-slate-200 px-3 py-1.5 text-slate-700">{children}</td>
              ),
              tr: ({ children }) => <tr className="even:bg-slate-50">{children}</tr>,
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="text-slate-700">{children}</li>,
              h1: ({ children }) => <h1 className="text-base font-semibold mb-2 text-slate-800">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-semibold mb-1.5 text-slate-800">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-medium mb-1 text-slate-700">{children}</h3>,
              code: ({ children }) => (
                <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-blue-300 pl-3 text-slate-600 italic my-2">{children}</blockquote>
              ),
              hr: () => <hr className="border-slate-200 my-3" />,
            }}
          >
            {m.texto}
          </ReactMarkdown>
        </div>

        {/* Gráfico */}
        {m.grafico && <ChartBlock grafico={m.grafico} />}

        {/* Fila inferior: hora + botones de copia (solo iconos con tooltip) */}
        <div className="flex items-center justify-between mt-1.5 gap-3">
          <span className="text-[10px] text-slate-400">{fmtHora(m.fc)}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyCSV}
              title="Copiar como CSV (pegar en Excel)"
              className={`p-1.5 rounded transition-colors border ${
                copied === 'text'
                  ? 'bg-green-50 border-green-200 text-green-600'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              {copied === 'text' ? <IconCheck /> : <IconCSV />}
            </button>
            <button
              onClick={handleCopyImage}
              title="Copiar como imagen"
              className={`p-1.5 rounded transition-colors border ${
                copied === 'image'
                  ? 'bg-green-50 border-green-200 text-green-600'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              {copied === 'image' ? <IconCheck /> : <IconImage />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChatMessages({ mensajes, ocupado }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, ocupado])

  if (mensajes.length === 0 && !ocupado) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3 p-8 text-center">
        <svg className="w-12 h-12" fill="none" stroke="#cbd5e1" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <h3 className="text-base text-slate-400 font-medium">¿En qué te puedo ayudar?</h3>
        <p className="text-sm text-slate-300 max-w-xs">Pregunta sobre parques, inversionistas, pagos o cualquier dato del sistema.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
      {mensajes.map((m, i) =>
        m.tipo === 'user' ? (
          <div key={i} className="self-end flex-row-reverse max-w-[80%] flex gap-2">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold mt-0.5">
              Tú
            </div>
            <div className="flex flex-col min-w-0">
              <div className="px-3.5 py-2.5 text-sm leading-relaxed bg-blue-600 text-white rounded-tl-xl rounded-bl-xl rounded-br-xl break-words">
                {m.texto}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 text-right">{fmtHora(m.fc)}</span>
            </div>
          </div>
        ) : (
          <AIMessageItem key={i} m={m} />
        )
      )}

      {/* Indicador de escritura */}
      {ocupado && (
        <div className="flex gap-2 self-start">
          <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <AIIcon />
          </div>
          <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-tr-xl rounded-br-xl rounded-bl-xl flex gap-1 items-center">
            {[0, 150, 300].map(delay => (
              <span
                key={delay}
                className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
