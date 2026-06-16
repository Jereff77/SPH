import { useMemo, useState, useRef, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clavesSatApi,
  type ClaveSat,
  type ClaveSatInput,
} from './clavesSat.api';
import {
  descargarLayout,
  leerLayout,
  type FilaImport,
  type FilaInvalida,
} from './clavesSatLayout';
import { Toggle } from '@/components/Toggle';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { ApiRequestError } from '@/lib/api';

const QKEY = ['claves-sat'];

const ACCESSORS: Accessors<ClaveSat> = {
  clave: (c) => c.claveProdServ,
  descripcion: (c) => c.descripcion,
  iva: (c) => c.retieneIVA,
  isr: (c) => c.retieneISR,
  status: (c) => c.status,
};

export function ClavesSatTab() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editarDe, setEditarDe] = useState<ClaveSat | null>(null);
  const [showAlta, setShowAlta] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [descargando, setDescargando] = useState(false);

  async function onDescargarLayout() {
    setDescargando(true);
    setError(null);
    try {
      await descargarLayout();
    } catch {
      setError('No se pudo generar la plantilla.');
    } finally {
      setDescargando(false);
    }
  }

  const { data: claves = [], isLoading } = useQuery({
    queryKey: QKEY,
    queryFn: () => clavesSatApi.listar(),
  });

  const invalidar = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: QKEY });
  };
  const onError = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  // Mutación optimista de un campo booleano (retieneIVA/retieneISR/status).
  function useBool(
    campo: 'retieneIVA' | 'retieneISR' | 'status',
    fn: (id: string, valor: boolean) => Promise<unknown>,
  ) {
    return useMutation({
      mutationFn: ({ id, valor }: { id: string; valor: boolean }) =>
        fn(id, valor),
      onMutate: async ({ id, valor }) => {
        setError(null);
        await queryClient.cancelQueries({ queryKey: QKEY });
        const prev = queryClient.getQueryData<ClaveSat[]>(QKEY);
        queryClient.setQueryData<ClaveSat[]>(QKEY, (old) =>
          old?.map((c) => (c.idClave === id ? { ...c, [campo]: valor } : c)),
        );
        return { prev };
      },
      onError: (e, _v, ctx) => {
        if (ctx?.prev) queryClient.setQueryData(QKEY, ctx.prev);
        onError(e);
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: QKEY }),
    });
  }

  const mIva = useBool('retieneIVA', (id, v) =>
    clavesSatApi.editar(id, { retieneIVA: v }),
  );
  const mIsr = useBool('retieneISR', (id, v) =>
    clavesSatApi.editar(id, { retieneISR: v }),
  );
  const mStatus = useBool('status', (id, v) => clavesSatApi.setStatus(id, v));

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return claves;
    return claves.filter(
      (c) =>
        c.claveProdServ.toLowerCase().includes(q) ||
        (c.descripcion ?? '').toLowerCase().includes(q),
    );
  }, [claves, busqueda]);

  const { ordenados, sortKey, dir, toggle } = useSort(filtradas, ACCESSORS, {
    key: 'clave',
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Catálogo de claves Producto/Servicio del SAT. Define si cada concepto
        retiene IVA y/o ISR; se usa para validar las facturas en Cuentas por
        Pagar (regímenes 612, 626 y 606).
      </p>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por clave o descripción…"
          className="w-72 max-w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onDescargarLayout}
            disabled={descargando}
            className="rounded-lg border border-[#1f2a4d] px-4 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d]/5 disabled:opacity-50"
          >
            {descargando ? 'Generando…' : '↓ Descargar layout'}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-lg border border-[#1f2a4d] px-4 py-2 text-sm font-medium text-[#1f2a4d] hover:bg-[#1f2a4d]/5"
          >
            ↥ Importar
          </button>
          <button
            onClick={() => setShowAlta(true)}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]"
          >
            Nueva clave
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-xl border bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <SortableTh campo="clave" sortKey={sortKey} dir={dir} onSort={toggle}>
                Clave SAT
              </SortableTh>
              <SortableTh
                campo="descripcion"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
              >
                Descripción
              </SortableTh>
              <SortableTh campo="iva" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Retiene IVA
              </SortableTh>
              <SortableTh campo="isr" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Retiene ISR
              </SortableTh>
              <SortableTh campo="status" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                Activa
              </SortableTh>
              <SortableTh align="center">Editar</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && ordenados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-300">
                  Sin claves registradas.
                </td>
              </tr>
            )}
            {ordenados.map((c) => (
              <tr key={c.idClave} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-700">
                  {c.claveProdServ}
                </td>
                <td
                  className="max-w-[320px] truncate px-3 py-2 text-gray-600"
                  title={c.descripcion ?? ''}
                >
                  {c.descripcion || '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <Toggle
                    checked={c.retieneIVA}
                    disabled={mIva.isPending}
                    title="Retiene IVA"
                    onChange={(valor) => mIva.mutate({ id: c.idClave, valor })}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <Toggle
                    checked={c.retieneISR}
                    disabled={mIsr.isPending}
                    title="Retiene ISR"
                    onChange={(valor) => mIsr.mutate({ id: c.idClave, valor })}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <Toggle
                    checked={c.status}
                    variant="status"
                    disabled={mStatus.isPending}
                    title={c.status ? 'Activa' : 'Inactiva'}
                    onChange={(valor) => mStatus.mutate({ id: c.idClave, valor })}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => setEditarDe(c)}
                    title="Editar clave/descripción"
                    className="text-[#3f5b87] hover:text-[#1f2a4d]"
                  >
                    ✎
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showAlta || editarDe) && (
        <ClaveModal
          clave={editarDe}
          onClose={() => {
            setShowAlta(false);
            setEditarDe(null);
          }}
          onGuardada={() => {
            setShowAlta(false);
            setEditarDe(null);
            invalidar();
          }}
        />
      )}

      {showImport && (
        <ImportarClavesModal
          onClose={() => setShowImport(false)}
          onImportado={invalidar}
        />
      )}
    </div>
  );
}

/** Tamaño de lote para enviar las filas al backend (acota el body por request). */
const CHUNK = 500;

interface ResumenImport {
  creadas: number;
  actualizadas: number;
  duplicadasEnArchivo: number;
  invalidas: FilaInvalida[];
}

function ImportarClavesModal({
  onClose,
  onImportado,
}: {
  onClose: () => void;
  onImportado: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState('');
  const [validas, setValidas] = useState<FilaImport[]>([]);
  const [invalidas, setInvalidas] = useState<FilaInvalida[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resumen, setResumen] = useState<ResumenImport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dedup global por clave (la última gana) para que el conteo sea exacto.
  const unicas = useMemo(() => {
    const m = new Map<string, FilaImport>();
    for (const f of validas) m.set(f.claveProdServ, f);
    return [...m.values()];
  }, [validas]);
  const dupEnArchivo = validas.length - unicas.length;

  async function onArchivo(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResumen(null);
    setLeyendo(true);
    setNombre(file.name);
    try {
      const { validas: v, invalidas: inv } = await leerLayout(file);
      setValidas(v);
      setInvalidas(inv);
      if (v.length === 0 && inv.length === 0)
        setError('El archivo no tiene filas para importar.');
    } catch {
      setValidas([]);
      setInvalidas([]);
      setError('No se pudo leer el archivo. Verifica que sea el layout en formato Excel.');
    } finally {
      setLeyendo(false);
    }
  }

  async function importar() {
    setImportando(true);
    setError(null);
    setProgreso(0);
    try {
      let creadas = 0;
      let actualizadas = 0;
      for (let i = 0; i < unicas.length; i += CHUNK) {
        const lote = unicas.slice(i, i + CHUNK).map((f) => ({
          claveProdServ: f.claveProdServ,
          descripcion: f.descripcion,
          retieneIVA: f.retieneIVA,
          retieneISR: f.retieneISR,
        }));
        const r = await clavesSatApi.importar(lote);
        creadas += r.creadas;
        actualizadas += r.actualizadas;
        setProgreso(Math.min(i + CHUNK, unicas.length));
      }
      setResumen({ creadas, actualizadas, duplicadasEnArchivo: dupEnArchivo, invalidas });
      onImportado();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Falló la importación.');
    } finally {
      setImportando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-gray-800">Importar claves SAT</h2>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {!resumen && (
          <>
            <p className="text-sm text-gray-500">
              Descarga el layout, captúralo y súbelo aquí. Las claves nuevas se crean y las que
              ya existan se actualizan (y quedan activas).
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => void onArchivo(e.target.files?.[0])}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={leyendo || importando}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-[#3f5b87] hover:bg-gray-50 disabled:opacity-50"
            >
              {leyendo ? 'Leyendo…' : nombre ? `📄 ${nombre} — clic para cambiar` : 'Seleccionar archivo Excel (.xlsx)'}
            </button>

            {(validas.length > 0 || invalidas.length > 0) && !leyendo && (
              <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Filas a importar</span>
                  <span className="font-semibold text-emerald-700">{unicas.length}</span>
                </div>
                {dupEnArchivo > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Repetidas en el archivo (se unifican)</span>
                    <span className="text-gray-500">{dupEnArchivo}</span>
                  </div>
                )}
                {invalidas.length > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-700">Con problema (no se importan)</span>
                    <span className="text-amber-700">{invalidas.length}</span>
                  </div>
                )}
                {invalidas.length > 0 && (
                  <div className="max-h-32 overflow-auto rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    {invalidas.slice(0, 50).map((f, i) => (
                      <div key={i}>
                        Fila {f.fila}: {f.motivo}
                        {f.valor ? ` ("${f.valor}")` : ''}
                      </div>
                    ))}
                    {invalidas.length > 50 && <div>…y {invalidas.length - 50} más.</div>}
                  </div>
                )}
              </div>
            )}

            {importando && (
              <div className="text-center text-sm text-gray-500">
                Importando… {progreso}/{unicas.length}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={importando}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={importar}
                disabled={importando || leyendo || unicas.length === 0}
                className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
              >
                {importando ? 'Importando…' : `Importar ${unicas.length}`}
              </button>
            </div>
          </>
        )}

        {resumen && (
          <>
            <div className="space-y-2 rounded-lg bg-emerald-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Claves creadas</span>
                <span className="font-semibold text-emerald-700">{resumen.creadas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Claves actualizadas</span>
                <span className="font-semibold text-[#1f2a4d]">{resumen.actualizadas}</span>
              </div>
              {resumen.duplicadasEnArchivo > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Repetidas en el archivo (unificadas)</span>
                  <span className="text-gray-500">{resumen.duplicadasEnArchivo}</span>
                </div>
              )}
              {resumen.invalidas.length > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-amber-700">Con problema (no importadas)</span>
                  <span className="text-amber-700">{resumen.invalidas.length}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039]"
              >
                Listo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ClaveModal({
  clave,
  onClose,
  onGuardada,
}: {
  clave: ClaveSat | null;
  onClose: () => void;
  onGuardada: () => void;
}) {
  const esEdicion = !!clave;
  const [claveProdServ, setClaveProdServ] = useState(clave?.claveProdServ ?? '');
  const [descripcion, setDescripcion] = useState(clave?.descripcion ?? '');
  const [retieneIVA, setRetieneIVA] = useState(clave?.retieneIVA ?? false);
  const [retieneISR, setRetieneISR] = useState(clave?.retieneISR ?? false);
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async (): Promise<void> => {
      const dto: ClaveSatInput = {
        claveProdServ: claveProdServ.trim(),
        descripcion: descripcion.trim(),
        retieneIVA,
        retieneISR,
      };
      if (esEdicion) await clavesSatApi.editar(clave!.idClave, dto);
      else await clavesSatApi.crear(dto);
    },
    onSuccess: onGuardada,
    onError: (e) =>
      setError(e instanceof ApiRequestError ? e.message : 'No se pudo guardar.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (claveProdServ.trim()) guardar.mutate();
  }

  const inputCls =
    'mt-1 block w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-gray-800">
          {esEdicion ? 'Editar clave SAT' : 'Nueva clave SAT'}
        </h2>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <label className="block text-xs text-gray-600">
          Clave Producto/Servicio (SAT)
          <input
            value={claveProdServ}
            onChange={(e) => setClaveProdServ(e.target.value)}
            placeholder="Ej. 80101500"
            className={inputCls}
          />
        </label>
        <label className="block text-xs text-gray-600">
          Descripción
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej. Servicios de consultoría"
            className={inputCls}
          />
        </label>
        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Toggle checked={retieneIVA} title="Retiene IVA" onChange={setRetieneIVA} />
            Retiene IVA
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Toggle checked={retieneISR} title="Retiene ISR" onChange={setRetieneISR} />
            Retiene ISR
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardar.isPending}
            className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
