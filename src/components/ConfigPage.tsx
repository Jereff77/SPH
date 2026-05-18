import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Catálogo de proveedores y modelos disponibles en OpenRouter ────────────
const PROVIDERS: { id: string; label: string; models: { id: string; label: string }[] }[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: [
      { id: 'anthropic/claude-3.5-haiku',       label: 'Claude 3.5 Haiku (rápido, económico)' },
      { id: 'anthropic/claude-3.5-sonnet',       label: 'Claude 3.5 Sonnet (equilibrado)' },
      { id: 'anthropic/claude-3-opus',           label: 'Claude 3 Opus (máxima calidad)' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: [
      { id: 'openai/gpt-4o-mini',  label: 'GPT-4o Mini (rápido, económico)' },
      { id: 'openai/gpt-4o',       label: 'GPT-4o (equilibrado)' },
    ],
  },
  {
    id: 'google',
    label: 'Google',
    models: [
      { id: 'google/gemini-flash-1.5',    label: 'Gemini 1.5 Flash (rápido)' },
      { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (más reciente)' },
    ],
  },
  {
    id: 'meta-llama',
    label: 'Meta (Llama)',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (potente, open source)' },
      { id: 'meta-llama/llama-3.1-8b-instruct',  label: 'Llama 3.1 8B (ligero, open source)' },
    ],
  },
]

function providerFromModel(modelId: string): string {
  return modelId.split('/')[0] ?? 'anthropic'
}

// ─── Íconos ─────────────────────────────────────────────────────────────────
const IconSave = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
)

const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const IconBot = () => (
  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M12 11V7" />
    <circle cx="12" cy="5" r="2" />
    <path d="M8 15h.01M16 15h.01" />
  </svg>
)

const IconModel = () => (
  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

// ─── Componente principal ────────────────────────────────────────────────────
export function ConfigPage() {
  const [prompt, setPrompt]               = useState('')
  const [promptOriginal, setPromptOriginal] = useState('')
  const [modeloActual, setModeloActual]   = useState('anthropic/claude-3.5-haiku')
  const [modeloOriginal, setModeloOriginal] = useState('anthropic/claude-3.5-haiku')
  const [proveedorSel, setProveedorSel]   = useState('anthropic')
  const [modeloSel, setModeloSel]         = useState('anthropic/claude-3.5-haiku')
  const [cargando, setCargando]           = useState(true)

  const [guardandoPrompt, setGuardandoPrompt] = useState(false)
  const [exitoPrompt, setExitoPrompt]         = useState(false)
  const [errorPrompt, setErrorPrompt]         = useState('')

  const [guardandoModelo, setGuardandoModelo] = useState(false)
  const [exitoModelo, setExitoModelo]         = useState(false)
  const [errorModelo, setErrorModelo]         = useState('')

  // Cargar config al montar
  useEffect(() => {
    supabase
      .from('SPHConfiguraciones')
      .select('parametro, valor')
      .in('parametro', ['IA_PROMPT_AGENTE', 'IA_LLM_MODEL'])
      .eq('status', true)
      .then(({ data }) => {
        const rows = (data ?? []) as { parametro: string; valor: string }[]
        const p = rows.find(r => r.parametro === 'IA_PROMPT_AGENTE')?.valor ?? ''
        const m = rows.find(r => r.parametro === 'IA_LLM_MODEL')?.valor ?? 'anthropic/claude-3.5-haiku'
        setPrompt(p)
        setPromptOriginal(p)
        setModeloActual(m)
        setModeloOriginal(m)
        setModeloSel(m)
        setProveedorSel(providerFromModel(m))
        setCargando(false)
      })
  }, [])

  // Cuando cambia proveedor → seleccionar primer modelo de ese proveedor
  const handleProveedorChange = (prov: string) => {
    setProveedorSel(prov)
    const firstModel = PROVIDERS.find(p => p.id === prov)?.models[0]?.id ?? ''
    setModeloSel(firstModel)
  }

  const modelos = PROVIDERS.find(p => p.id === proveedorSel)?.models ?? []
  const modeloLabel = PROVIDERS.flatMap(p => p.models).find(m => m.id === modeloActual)?.label ?? modeloActual

  // ── Guardar prompt ────────────────────────────────────────────────────────
  const handleGuardarPrompt = async () => {
    setGuardandoPrompt(true)
    setErrorPrompt('')
    try {
      const { data, error } = await supabase.rpc('ia_update_prompt', {
        p_parametro: 'IA_PROMPT_AGENTE',
        p_valor: prompt,
      })
      if (error) throw error
      if (!data) throw new Error('No se encontró el parámetro')
      setPromptOriginal(prompt)
      setExitoPrompt(true)
      setTimeout(() => setExitoPrompt(false), 2500)
    } catch (err: unknown) {
      setErrorPrompt(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardandoPrompt(false)
    }
  }

  // ── Guardar modelo ────────────────────────────────────────────────────────
  const handleGuardarModelo = async () => {
    setGuardandoModelo(true)
    setErrorModelo('')
    try {
      // Guardar modelo completo
      const { data: d1, error: e1 } = await supabase.rpc('ia_update_prompt', {
        p_parametro: 'IA_LLM_MODEL',
        p_valor: modeloSel,
      })
      if (e1) throw e1
      if (!d1) throw new Error('No se encontró IA_LLM_MODEL')

      // Guardar proveedor (campo auxiliar)
      await supabase.rpc('ia_update_prompt', {
        p_parametro: 'IA_LLM_PROVIDER',
        p_valor: proveedorSel,
      })

      setModeloActual(modeloSel)
      setModeloOriginal(modeloSel)
      setExitoModelo(true)
      setTimeout(() => setExitoModelo(false), 2500)
    } catch (err: unknown) {
      setErrorModelo(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardandoModelo(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-3xl mx-auto space-y-6">

        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-0.5">Configuración de la IA</h2>
          <p className="text-sm text-slate-500">
            Ajusta el prompt del asistente y el modelo de lenguaje. Los cambios se aplican en la siguiente conversación.
          </p>
        </div>

        {/* ── Modelo LLM ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <IconModel />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Modelo de lenguaje</h3>
              <p className="text-xs text-slate-500">
                Modelo activo: <span className="font-mono text-slate-700">{modeloLabel}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Proveedor */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Proveedor</label>
              <select
                value={proveedorSel}
                onChange={e => handleProveedorChange(e.target.value)}
                className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Modelo</label>
              <select
                value={modeloSel}
                onChange={e => setModeloSel(e.target.value)}
                className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:border-blue-400 focus:bg-white transition-colors"
              >
                {modelos.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              {exitoModelo && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <IconCheck /> Modelo actualizado
                </span>
              )}
              {errorModelo && (
                <span className="text-xs text-red-500">{errorModelo}</span>
              )}
            </div>
            <button
              onClick={handleGuardarModelo}
              disabled={guardandoModelo || modeloSel === modeloOriginal}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {guardandoModelo ? (
                <span>Guardando...</span>
              ) : exitoModelo ? (
                <><IconCheck /><span>Guardado</span></>
              ) : (
                <><IconSave /><span>Aplicar modelo</span></>
              )}
            </button>
          </div>
        </div>

        {/* ── Prompt del agente ───────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <IconBot />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Instrucciones del asistente</h3>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Define el comportamiento, tono y restricciones del asistente IA. Se combina automáticamente con el esquema de la base de datos y las reglas de integridad.
          </p>

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full text-xs font-mono text-slate-700 border border-slate-200 rounded-lg p-3 resize-y outline-none focus:border-blue-400 bg-slate-50 leading-relaxed transition-colors"
          />

          <div className="flex items-center justify-between mt-3">
            <div>
              {exitoPrompt && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <IconCheck /> Instrucciones guardadas
                </span>
              )}
              {errorPrompt && (
                <span className="text-xs text-red-500">{errorPrompt}</span>
              )}
              <p className="text-[10px] text-slate-400 mt-0.5">
                {prompt.length.toLocaleString('es-MX')} caracteres
              </p>
            </div>
            <button
              onClick={handleGuardarPrompt}
              disabled={guardandoPrompt || prompt === promptOriginal}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {guardandoPrompt ? (
                <span>Guardando...</span>
              ) : exitoPrompt ? (
                <><IconCheck /><span>Guardado</span></>
              ) : (
                <><IconSave /><span>Guardar instrucciones</span></>
              )}
            </button>
          </div>
        </div>

        {/* ── Nota informativa ────────────────────────────────────────────── */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
          <strong>Nota:</strong> El esquema de la base de datos, las reglas de integridad de datos y las instrucciones de visualización de gráficos se inyectan automáticamente y no pueden editarse desde aquí.
        </div>

      </div>
    </div>
  )
}
