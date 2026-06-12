import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fideicomisoApi,
  hoyMexico,
  type CfgCondiciones,
  type CfgPartida,
  type CondicionesInput,
  type InversionistaInput,
} from './fideicomiso.api';
import { ApiRequestError } from '@/lib/api';
import { SearchSelect, type OpcionSelect } from '@/components/SearchSelect';
import { moneda, fechaCorta } from './format';

const TABS = [
  { id: 'datos', label: 'Datos Generales' },
  { id: 'docs', label: 'Documentos' },
  { id: 'props', label: 'Propiedades' },
  { id: 'cond', label: 'Adhesiones' },
  { id: 'pdp', label: 'Plan de Pagos' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const PM_OPC = ['PM', 'PF'];
const MEDIO_OPC = ['Broker', 'Cambio de Nave a ticket', 'Directo', 'Lead', 'Medio', 'Recompra', 'Referido'];
const NAVE_OPC = ['A', 'B', 'C', 'D', 'E'] as const;
const ID_OPC = ['1', '2', '3', '4'] as const;
const DOC_CATALOGO = [
  'DPM - Acta constitutiva y última acta de asamblea / estatutos vigentes',
  'DPM - RFC (cédula fiscal) vigencia no mayor a 3 meses',
  'DPM - FIEL (en caso de contar con ella)',
  'DPM - Comprobante de domicilio (a nombre de la empresa, ≤ 3 meses)',
  'DPM - Identificación oficial de socios (INE/Pasaporte y Licencia/cédula)',
];

const err = (e: unknown) => (e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

/**
 * Configuración del propietario (engrane ⚙️ de Aportaciones). Réplica completa de
 * `config_propietario_fide` de v1: selector de propiedad + 5 pestañas (Datos,
 * Documentos, Propiedades/Naves, Adhesiones/Condiciones, Plan de Pagos).
 */
export function ConfigFideModal({
  idInversionista,
  onClose,
}: {
  idInversionista: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>('datos');
  const [prop, setProp] = useState('');

  const { data: propsSel = [] } = useQuery({
    queryKey: ['cfg-props', idInversionista],
    queryFn: () => fideicomisoApi.cfgPropiedades(idInversionista),
  });
  const optProp: OpcionSelect[] = useMemo(
    () =>
      propsSel
        .filter((p) => p.idPropiedad)
        .map((p) => ({ value: p.idPropiedad!, label: p.nomDescriptivo ?? p.idPropiedad! })),
    [propsSel],
  );

  const requierePropiedad = tab === 'cond' || tab === 'pdp';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="text-base font-semibold">Configuración del propietario</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Cerrar">✕</button>
        </div>

        {/* Selector de propiedad */}
        <div className="flex items-end gap-3 border-b bg-gray-50 px-5 py-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">Propiedad</label>
            <SearchSelect
              value={prop}
              onChange={setProp}
              options={optProp}
              placeholder="Selecciona una propiedad…"
              className="mt-1 w-[360px]"
            />
          </div>
          {prop && <span className="mb-1.5 text-xs text-gray-400">{prop}</span>}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b px-3 pt-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
                tab === t.id ? 'bg-white text-[#1f2a4d] shadow-[inset_0_-2px_0_#1f2a4d]' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5">
          {tab === 'datos' && <DatosTab idInversionista={idInversionista} />}
          {tab === 'docs' && <DocsTab idInversionista={idInversionista} />}
          {tab === 'props' && <PropsTab idInversionista={idInversionista} />}
          {requierePropiedad && !prop && (
            <p className="rounded-lg border border-dashed bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
              Selecciona una propiedad para ver esta sección.
            </p>
          )}
          {tab === 'cond' && prop && <CondicionesTab idPropiedad={prop} />}
          {tab === 'pdp' && prop && <PdpTab idPropiedad={prop} />}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── Tab Datos Generales ────────────────────────── */

function DatosTab({ idInversionista }: { idInversionista: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cfg-inv', idInversionista],
    queryFn: () => fideicomisoApi.cfgGetInversionista(idInversionista),
  });
  const [form, setForm] = useState<InversionistaInput | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inv = (data ?? {}) as Record<string, string | null>;
  const f = form ?? {
    nombre: inv.nombre ?? '',
    apellido1: inv.apellido1 ?? '',
    apellido2: inv.apellido2 ?? '',
    fecNacimiento: (inv.fecNacimiento ?? '').slice(0, 10),
    telefono: inv.telefono ?? '',
    correo: inv.correo ?? '',
    RFC: inv.RFC ?? '',
    CURP: inv.CURP ?? '',
    razonsocial: inv.razonsocial ?? '',
    personalidad: inv.personalidad ?? '',
  };
  const set = (k: keyof InversionistaInput, v: string) => setForm({ ...f, [k]: v });

  const m = useMutation({
    mutationFn: () => fideicomisoApi.cfgActualizarInversionista(idInversionista, f),
    onSuccess: () => { setMsg('Datos actualizados ✓'); setError(null); },
    onError: (e) => { setError(err(e)); setMsg(null); },
  });

  if (isLoading) return <p className="text-sm text-gray-400">Cargando…</p>;

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (!f.nombre.trim()) { setError('El nombre es obligatorio.'); return; } m.mutate(); }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Campo label="Nombre(s)" v={f.nombre} on={(v) => set('nombre', v)} />
      <Campo label="Primer apellido" v={f.apellido1 ?? ''} on={(v) => set('apellido1', v)} />
      <Campo label="Segundo apellido" v={f.apellido2 ?? ''} on={(v) => set('apellido2', v)} />
      <Campo label="Fecha nacimiento" tipo="date" v={f.fecNacimiento ?? ''} on={(v) => set('fecNacimiento', v)} />
      <Campo label="Teléfono" v={f.telefono ?? ''} on={(v) => set('telefono', v)} />
      <Campo label="Correo" v={f.correo ?? ''} on={(v) => set('correo', v)} />
      <Campo label="RFC" v={f.RFC ?? ''} on={(v) => set('RFC', v)} />
      <Campo label="CURP" v={f.CURP ?? ''} on={(v) => set('CURP', v)} />
      <Campo label="Razón social" v={f.razonsocial ?? ''} on={(v) => set('razonsocial', v)} />
      <div className="sm:col-span-3 flex items-center justify-end gap-3">
        {error && <span className="text-xs text-red-600">{error}</span>}
        {msg && <span className="text-xs text-green-700">{msg}</span>}
        <button type="submit" disabled={m.isPending}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50">
          {m.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, v, on, tipo = 'text' }: { label: string; v: string; on: (v: string) => void; tipo?: string }) {
  return (
    <label className="text-xs text-gray-600">
      {label}
      <input type={tipo} value={v} onChange={(e) => on(e.target.value)}
        className="mt-1 block w-full rounded border px-2 py-1.5 text-sm" />
    </label>
  );
}

/* ────────────────────────── Tab Documentos ────────────────────────── */

function DocsTab({ idInversionista }: { idInversionista: string }) {
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['cfg-docs', idInversionista],
    queryFn: () => fideicomisoApi.cfgDocs(idInversionista),
  });
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const refrescar = () => qc.invalidateQueries({ queryKey: ['cfg-docs', idInversionista] });

  async function subir(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!titulo) { setError('Selecciona el tipo de documento.'); return; }
    if (!archivo) { setError('Selecciona un archivo PDF.'); return; }
    setSubiendo(true);
    try {
      await fideicomisoApi.cfgSubirDoc(idInversionista, titulo, descripcion, archivo);
      setTitulo(''); setDescripcion(''); setArchivo(null);
      refrescar();
    } catch (e2) { setError(err(e2)); } finally { setSubiendo(false); }
  }
  async function eliminar(id: string) {
    if (!window.confirm('¿Eliminar este documento?')) return;
    await fideicomisoApi.cfgEliminarDoc(id);
    refrescar();
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <form onSubmit={subir} className="space-y-3 rounded-lg border bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700">Agregar documento</h3>
        <label className="block text-xs text-gray-600">
          Tipo de documento
          <select value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1.5 text-sm">
            <option value="">Selecciona…</option>
            {DOC_CATALOGO.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          Descripción
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3}
            className="mt-1 block w-full rounded border px-2 py-1.5 text-sm" />
        </label>
        <label className="block text-xs text-gray-600">
          Archivo (PDF)
          <input type="file" accept="application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={subiendo}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50">
          {subiendo ? 'Subiendo…' : 'Agregar'}
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Documentos</h3>
        {isLoading ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-gray-400">Sin documentos.</p>
        ) : (
          docs.map((d) => (
            <div key={d.idDocumento} className="flex items-start justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-700">{d.titulo}</p>
                {d.descripcion && <p className="text-xs text-gray-500">{d.descripcion}</p>}
                {d.urldoc && /^https?:\/\//.test(d.urldoc) && (
                  <a href={d.urldoc} target="_blank" rel="noreferrer" className="text-xs text-[#3f5b87] underline">ver PDF</a>
                )}
              </div>
              <button onClick={() => eliminar(d.idDocumento)} className="shrink-0 text-red-600 hover:text-red-800" title="Eliminar">🗑</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── Tab Propiedades / Naves ────────────────────────── */

function PropsTab({ idInversionista }: { idInversionista: string }) {
  const qc = useQueryClient();
  const { data: parques = [] } = useQuery({ queryKey: ['cfg-parques'], queryFn: () => fideicomisoApi.cfgParques() });
  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['cfg-props-fide', idInversionista],
    queryFn: () => fideicomisoApi.cfgPropiedadesFide(idInversionista),
  });
  const [idParque, setIdParque] = useState('');
  const [nave, setNave] = useState<'A' | 'B' | 'C' | 'D' | 'E' | ''>('');
  const [id, setId] = useState<'1' | '2' | '3' | '4' | ''>('');
  const [error, setError] = useState<string | null>(null);

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['cfg-props-fide', idInversionista] });
    qc.invalidateQueries({ queryKey: ['cfg-props', idInversionista] });
  };

  const mCrear = useMutation({
    mutationFn: () => fideicomisoApi.cfgCrearNave({ idInversionista, idParque, nave: nave as 'A', id: id as '1' }),
    onSuccess: () => { setIdParque(''); setNave(''); setId(''); setError(null); refrescar(); },
    onError: (e) => setError(err(e)),
  });
  const mEliminar = useMutation({
    mutationFn: (idPropiedad: string) => fideicomisoApi.cfgEliminarPropiedad(idPropiedad),
    onSuccess: refrescar,
    onError: (e) => setError(err(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-gray-50 p-4">
        <label className="text-xs text-gray-600">
          Parque
          <select value={idParque} onChange={(e) => setIdParque(e.target.value)} className="mt-1 block w-56 rounded border px-2 py-1.5 text-sm">
            <option value="">Selecciona…</option>
            {parques.map((p) => <option key={p.idParque} value={p.idParque}>{p.nomParque ?? p.idParque}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Nave
          <select value={nave} onChange={(e) => setNave(e.target.value as 'A')} disabled={!idParque} className="mt-1 block w-24 rounded border px-2 py-1.5 text-sm disabled:bg-gray-100">
            <option value="">—</option>
            {NAVE_OPC.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          ID
          <select value={id} onChange={(e) => setId(e.target.value as '1')} disabled={!nave} className="mt-1 block w-24 rounded border px-2 py-1.5 text-sm disabled:bg-gray-100">
            <option value="">—</option>
            {ID_OPC.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={() => { if (!idParque || !nave || !id) { setError('Completa parque, nave e ID.'); return; } mCrear.mutate(); }}
          disabled={mCrear.isPending}
          className="mb-0.5 rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50">
          Agregar
        </button>
        {error && <span className="mb-1.5 text-xs text-red-600">{error}</span>}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-gray-400">Sin propiedades.</p>
        ) : (
          lista.map((p) => (
            <div key={p.idPropiedad} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">{p.nomDescriptivo ?? '—'}</p>
                  <p className="text-xs text-gray-500">
                    {p.nominversionista ?? '—'} · {fechaCorta(p.fc)} · creó {p.creadoPor ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">ID {p.idPropiedad}</p>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <div>Tiene PDP: <strong>{p.tienenPdp ? 'Sí' : 'No'}</strong> · Activo: <strong>{p.pdpActivo ? 'Sí' : 'No'}</strong></div>
                  <div>Valor: <strong>{moneda(p.totalpdp)}</strong> · Pagos: <strong>{moneda(p.totalpagos)}</strong></div>
                  <div>Avance: <strong>{p.avance_porcentaje != null ? `${Number(p.avance_porcentaje).toLocaleString('es-MX', { maximumFractionDigits: 2 })}%` : '—'}</strong></div>
                  {!p.tienenPdp && (
                    <button onClick={() => { if (p.idPropiedad && window.confirm('¿Eliminar esta propiedad/ticket?')) mEliminar.mutate(p.idPropiedad); }}
                      className="mt-1 text-red-600 hover:text-red-800">🗑 Eliminar</button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── Tab Condiciones ────────────────────────── */

function CondicionesTab({ idPropiedad }: { idPropiedad: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['cfg-cond', idPropiedad],
    queryFn: () => fideicomisoApi.cfgCondiciones(idPropiedad),
  });
  const [form, setForm] = useState<CondicionesInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const cond = data as CfgCondiciones | null | undefined;
  const base: CondicionesInput = {
    idPropiedad,
    idfideCond: cond?.idfideCond,
    noAdhesion: cond?.noAdhesion ?? '',
    pm: cond?.PM ?? '',
    medio: cond?.Medio ?? '',
    apartado: cond?.Apartado ?? 0,
    rendimiento: cond?.rendimiento ?? 0,
    prom9: cond?.['Prom9%'] ?? false,
    comentarios: cond?.comentarios ?? '',
  };
  const f = form ?? base;
  const set = <K extends keyof CondicionesInput>(k: K, v: CondicionesInput[K]) => setForm({ ...f, [k]: v });

  const m = useMutation({
    mutationFn: () => fideicomisoApi.cfgGuardarCondiciones({ ...f, idPropiedad, idfideCond: cond?.idfideCond }),
    onSuccess: () => { setMsg('Guardado ✓'); setError(null); qc.invalidateQueries({ queryKey: ['cfg-cond', idPropiedad] }); setForm(null); },
    onError: (e) => { setError(err(e)); setMsg(null); },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.noAdhesion.trim() || !f.pm || !f.medio) { setError('Completa adhesión, PM y medio.'); return; }
    if (f.rendimiento < 1 || f.rendimiento > 12) { setError('El rendimiento debe estar entre 1 y 12.'); return; }
    m.mutate();
  }

  if (isLoading) return <p className="text-sm text-gray-400">Cargando…</p>;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Campo label="No. de Adhesión" v={f.noAdhesion} on={(v) => set('noAdhesion', v)} />
      <label className="text-xs text-gray-600">PM
        <select value={f.pm} onChange={(e) => set('pm', e.target.value)} className="mt-1 block w-full rounded border px-2 py-1.5 text-sm">
          <option value="">Selecciona…</option>{PM_OPC.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <label className="text-xs text-gray-600">Medio
        <select value={f.medio} onChange={(e) => set('medio', e.target.value)} className="mt-1 block w-full rounded border px-2 py-1.5 text-sm">
          <option value="">Selecciona…</option>{MEDIO_OPC.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <Campo label="Apartado" tipo="number" v={String(f.apartado)} on={(v) => set('apartado', Number(v))} />
      <Campo label="Rendimiento (1–12)" tipo="number" v={String(f.rendimiento)} on={(v) => set('rendimiento', Number(v))} />
      <label className="flex items-center gap-2 text-xs text-gray-600 sm:col-span-2">
        <input type="checkbox" checked={!!f.prom9} onChange={(e) => set('prom9', e.target.checked)} />
        Promoción del 9% el primer año
      </label>
      <label className="text-xs text-gray-600 sm:col-span-2">Anotaciones
        <textarea value={f.comentarios ?? ''} onChange={(e) => set('comentarios', e.target.value)} rows={3}
          className="mt-1 block w-full rounded border px-2 py-1.5 text-sm" />
      </label>
      <div className="sm:col-span-2 flex items-center justify-end gap-3">
        {error && <span className="text-xs text-red-600">{error}</span>}
        {msg && <span className="text-xs text-green-700">{msg}</span>}
        <button type="submit" disabled={m.isPending}
          className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50">
          {m.isPending ? 'Guardando…' : cond ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

/* ────────────────────────── Tab PDP ────────────────────────── */

const TIPO_OPC = ['Enganche', 'Parcialidad', 'Escrituracion'];

function PdpTab({ idPropiedad }: { idPropiedad: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['cfg-pdp', idPropiedad],
    queryFn: () => fideicomisoApi.cfgPdp(idPropiedad),
  });
  const [error, setError] = useState<string | null>(null);
  const refrescar = () => qc.invalidateQueries({ queryKey: ['cfg-pdp', idPropiedad] });

  // Form crear PDP
  const [fecha, setFecha] = useState(hoyMexico());
  const [cantPagos, setCantPagos] = useState('1');
  const [valTicket, setValTicket] = useState('');

  const mCrear = useMutation({
    mutationFn: () => fideicomisoApi.cfgCrearPdp({ idPropiedad, fecha, cantPagos: Number(cantPagos), valTicket: Number(valTicket) }),
    onSuccess: () => { setValTicket(''); setError(null); refrescar(); },
    onError: (e) => setError(err(e)),
  });
  const mActivar = useMutation({ mutationFn: () => fideicomisoApi.cfgActivarPdp(idPropiedad), onSuccess: refrescar, onError: (e) => setError(err(e)) });
  const mDesactivar = useMutation({ mutationFn: () => fideicomisoApi.cfgDesactivarPdp(idPropiedad), onSuccess: refrescar, onError: (e) => setError(err(e)) });
  const mEliminar = useMutation({
    mutationFn: (idPdp: string) => fideicomisoApi.cfgEliminarPdp(idPropiedad, idPdp),
    onSuccess: refrescar, onError: (e) => setError(err(e)),
  });

  if (isLoading) return <p className="text-sm text-gray-400">Cargando…</p>;
  if (!data) return <p className="text-sm text-gray-400">Sin datos.</p>;

  const { propiedad, pdp, detalle, totales } = data;

  // PDP activo → bloqueado (solo desactivar)
  if (propiedad.pdpActivo) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Cuenta con un PDP <strong>activo</strong>. No se puede modificar.
        </div>
        <PdpTabla detalle={detalle} pdp={pdp} totales={totales} bloqueado refrescar={refrescar} setError={setError} />
        <div className="flex justify-end">
          <button onClick={() => { if (window.confirm('¿Desactivar el PDP para poder editarlo?')) mDesactivar.mutate(); }}
            className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
            Desactivar PDP
          </button>
        </div>
        {error && <p className="text-right text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // Sin PDP → formulario de creación
  if (!propiedad.tienenPdp || !pdp) {
    return (
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (!(Number(valTicket) > 0)) { setError('Captura el valor del ticket.'); return; } mCrear.mutate(); }}
        className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Generar Plan de Pagos</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo label="Fecha primer pago" tipo="date" v={fecha} on={setFecha} />
          <Campo label="Cantidad de pagos" tipo="number" v={cantPagos} on={setCantPagos} />
          <Campo label="Valor del ticket" tipo="number" v={valTicket} on={setValTicket} />
        </div>
        <p className="text-xs text-gray-400">
          1 pago → «Único». Más de 1 → primero «Enganche», resto «Parcialidad» (monto = valor / cantidad, fechas mensuales).
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={mCrear.isPending}
            className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a] disabled:opacity-50">
            {mCrear.isPending ? 'Generando…' : 'Guardar'}
          </button>
        </div>
      </form>
    );
  }

  // Con PDP (no activo) → tabla editable + activar/eliminar
  const cuadra = totales?.montos_son_iguales === true;
  return (
    <div className="space-y-4">
      <PdpTabla detalle={detalle} pdp={pdp} totales={totales} refrescar={refrescar} setError={setError} />
      <div className="flex items-center justify-between">
        <button onClick={() => { if (pdp.idPdp && window.confirm('¿Eliminar permanentemente el PDP?')) mEliminar.mutate(pdp.idPdp); }}
          className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
          Eliminar PDP
        </button>
        <button onClick={() => mActivar.mutate()} disabled={!cuadra || mActivar.isPending}
          title={cuadra ? 'Activar el PDP' : 'Los totales no cuadran con el valor del ticket'}
          className="rounded-lg bg-[#90BF32] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
          Activar PDP
        </button>
      </div>
      {error && <p className="text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}

function PdpTabla({
  detalle, pdp, totales, bloqueado, refrescar, setError,
}: {
  detalle: CfgPartida[];
  pdp: { idPdp: string; monto: number | null } | null;
  totales: { monto: number | null; montos_son_iguales: boolean | null } | null;
  bloqueado?: boolean;
  refrescar: () => void;
  setError: (s: string | null) => void;
}) {
  const [edit, setEdit] = useState<{ id: string; campo: 'fecha' | 'monto' | 'tipo'; valor: string } | null>(null);

  const mFecha = useMutation({ mutationFn: (v: { id: string; fecha: string }) => fideicomisoApi.cfgEditarFechaPartida(v.id, v.fecha), onSuccess: refrescar, onError: (e) => setError(err(e)) });
  const mMonto = useMutation({
    mutationFn: (v: { id: string; monto: number; idPdp: string | null; tipoPago: string | null }) =>
      fideicomisoApi.cfgEditarMontoPartida(v.id, v.monto),
    onSuccess: async (_r, v) => {
      // Si la partida editada es el Enganche, ofrecer recalcular las parcialidades.
      if (v.tipoPago === 'Enganche' && v.idPdp && window.confirm('¿Recalcular las parcialidades restantes a partir del nuevo enganche?')) {
        try { await fideicomisoApi.cfgRecalcular(v.idPdp); } catch (e) { setError(err(e)); }
      }
      refrescar();
    },
    onError: (e) => setError(err(e)),
  });
  const mTipo = useMutation({ mutationFn: (v: { id: string; tipo: string }) => fideicomisoApi.cfgEditarTipoPartida(v.id, v.tipo), onSuccess: refrescar, onError: (e) => setError(err(e)) });

  function abrir(p: CfgPartida, campo: 'fecha' | 'monto' | 'tipo') {
    if (bloqueado) return;
    setError(null);
    const valor = campo === 'fecha' ? (p.fecha ?? '').slice(0, 10) : campo === 'monto' ? String(p.monto ?? '') : (p.tipoPago ?? 'Parcialidad');
    setEdit({ id: p.idPdpDet, campo, valor });
  }
  function confirmar(p: CfgPartida) {
    if (!edit) return;
    const { campo, valor } = edit;
    setEdit(null);
    if (campo === 'fecha') { if (valor && valor !== (p.fecha ?? '').slice(0, 10)) mFecha.mutate({ id: p.idPdpDet, fecha: valor }); }
    else if (campo === 'monto') { const n = Number(valor); if (n > 0 && n !== p.monto) mMonto.mutate({ id: p.idPdpDet, monto: n, idPdp: p.idPdp, tipoPago: p.tipoPago }); }
    else { if (valor && valor !== p.tipoPago) mTipo.mutate({ id: p.idPdpDet, tipo: valor }); }
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="min-w-full text-sm">
        <thead className="bg-[#1f2a4d] text-left text-xs uppercase tracking-wide text-white">
          <tr>
            <th className="px-3 py-2 text-center">No.</th>
            <th className="px-3 py-2 text-center">Fecha</th>
            <th className="px-3 py-2 text-right">Monto</th>
            <th className="px-3 py-2">Tipo</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {detalle.length === 0 && (
            <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">Sin partidas.</td></tr>
          )}
          {detalle.map((p, i) => {
            const e = edit?.id === p.idPdpDet ? edit : null;
            return (
              <tr key={p.idPdpDet} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                <td className="px-3 py-2 text-center">
                  {e?.campo === 'fecha' ? (
                    <input type="date" autoFocus value={e.valor} onChange={(ev) => setEdit({ ...e, valor: ev.target.value })}
                      onBlur={() => confirmar(p)} onKeyDown={(ev) => { if (ev.key === 'Enter') confirmar(p); if (ev.key === 'Escape') setEdit(null); }}
                      className="rounded border border-[#3f5b87] px-1 py-0.5 text-sm" />
                  ) : (
                    <span onDoubleClick={() => abrir(p, 'fecha')} className={bloqueado ? '' : 'cursor-pointer rounded px-1 hover:bg-gray-100'} title={bloqueado ? '' : 'Doble clic para editar'}>
                      {fechaCorta(p.fecha)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {e?.campo === 'monto' ? (
                    <input type="number" step="0.01" autoFocus value={e.valor} onChange={(ev) => setEdit({ ...e, valor: ev.target.value })}
                      onBlur={() => confirmar(p)} onKeyDown={(ev) => { if (ev.key === 'Enter') confirmar(p); if (ev.key === 'Escape') setEdit(null); }}
                      className="w-28 rounded border border-[#3f5b87] px-1 py-0.5 text-right text-sm" />
                  ) : (
                    <span onDoubleClick={() => abrir(p, 'monto')} className={bloqueado ? '' : 'cursor-pointer rounded px-1 hover:bg-gray-100'} title={bloqueado ? '' : 'Doble clic para editar'}>
                      {moneda(p.monto)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {e?.campo === 'tipo' ? (
                    <select autoFocus value={e.valor} onChange={(ev) => setEdit({ ...e, valor: ev.target.value })}
                      onBlur={() => confirmar(p)} className="rounded border border-[#3f5b87] px-1 py-0.5 text-sm">
                      {TIPO_OPC.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <span onDoubleClick={() => abrir(p, 'tipo')} className={bloqueado ? '' : 'cursor-pointer rounded px-1 hover:bg-gray-100'} title={bloqueado ? '' : 'Doble clic para editar'}>
                      {p.tipoPago ?? '—'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className={`font-semibold ${totales?.montos_son_iguales ? 'bg-[#90BF32]/15 text-[#3f5b1a]' : 'bg-red-50 text-red-700'}`}>
            <td className="px-3 py-2" colSpan={2}>
              Total {totales?.montos_son_iguales ? '✓ cuadra' : '✗ no cuadra'}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{moneda(totales?.monto)}</td>
            <td className="px-3 py-2 text-xs">vs valor {moneda(pdp?.monto)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
