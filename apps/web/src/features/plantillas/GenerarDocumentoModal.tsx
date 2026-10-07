import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { Modal } from '@/components/ui/Modal';
import { ApiRequestError } from '@/lib/api';
import { BarraFormato, CLASE_LOGO, HojaDocumento, htmlDeHoja, useEditoresHoja, useZoomHoja, ZoomHoja } from './HojaDocumento';
import { IconImprimir } from './iconos';
import {
  codigoError,
  documentosApi,
  plantillasApi,
  type NaveDoc,
  type VistaPreviaRespuesta,
} from './plantillas.api';

type Nivel = 'BT' | 'MT';

interface FilaNave {
  marcada: boolean;
  /** Texto tal cual lo teclea la persona (puede estar vacío mientras edita). */
  kva: string;
  nivel: Nivel;
}

const ETIQUETA_ROL: Record<NaveDoc['rol'], string> = {
  INVERSIONISTA: 'Inversionista',
  ARRENDATARIO: 'Arrendatario',
  AMBOS: 'Inversionista y arrendatario',
};

const ROL_ETIQUETA = {
  ARRENDATARIO: 'Arrendatario',
  INVERSIONISTA: 'Propietario',
  AMBOS: 'Propietario y arrendatario',
} as const;

const CLASE_CONTROL =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1f2a4d] disabled:bg-gray-50 disabled:text-gray-400';

/** Fila inicial de una nave: KVA y nivel prellenados con su dotación (solo prellena, nunca bloquea). */
function filaInicial(n: NaveDoc): FilaNave {
  const nivel: Nivel = n.dotacionMt > n.dotacionBt ? 'MT' : 'BT';
  const dot = nivel === 'MT' ? n.dotacionMt : n.dotacionBt;
  return { marcada: false, kva: dot > 0 ? String(dot) : '', nivel };
}

/** Valida el KVA tecleado; devuelve el número o el mensaje de error en español. */
function validarKva(texto: string): { valor: number } | { error: string } {
  const t = texto.trim().replace(',', '.');
  if (t === '') return { error: 'Escribe los KVA.' };
  if (!/^\d+(\.\d+)?$/.test(t)) return { error: 'Escribe solo números (por ejemplo 5 o 2.5).' };
  if ((t.split('.')[1] ?? '').length > 2) return { error: 'Máximo 2 decimales.' };
  const v = Number(t);
  if (!(v > 0)) return { error: 'Debe ser mayor que 0.' };
  if (v > 100000) return { error: 'Máximo 100 000 KVA.' };
  return { valor: v };
}

/** Parques → KVA's → «Generar documento»: el servidor llena los campos; no se guarda nada. */
export function GenerarDocumentoModal({
  abierto,
  onCerrar,
  idNaveInicial,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Si se abre desde la ficha de una nave: se precargan su empresa y la nave marcada. */
  idNaveInicial?: string;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Generar documento" ancho="xl" cabeceraAzul>
      <Contenido onCerrar={onCerrar} idNaveInicial={idNaveInicial} />
    </Modal>
  );
}

function Contenido({ onCerrar, idNaveInicial }: { onCerrar: () => void; idNaveInicial?: string }) {
  const [idPlantilla, setIdPlantilla] = useState('');
  const [idInversionista, setIdInversionista] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<{ n: number; datos: VistaPreviaRespuesta } | null>(null);
  const [obsoleta, setObsoleta] = useState(false);
  const [errorVista, setErrorVista] = useState<string | null>(null);

  const lista = useQuery({
    queryKey: ['plantillas', 'lista', false],
    queryFn: () => plantillasApi.listar(false),
  });
  // Por ahora solo «Asignación de carga» tiene campos automáticos.
  const activas = (lista.data ?? []).filter((p) => p.status && p.tipo === 'ASIGNACION_CARGA');

  // Desde la ficha de una nave la empresa viene de la nave: no hace falta bajar las 300+ empresas.
  const empresas = useQuery({
    queryKey: ['documentos', 'empresas'],
    queryFn: documentosApi.empresas,
    enabled: !idNaveInicial,
  });
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const todas = empresas.data ?? [];
    return q ? todas.filter((e) => e.razonsocial.toLowerCase().includes(q)) : todas;
  }, [empresas.data, busqueda]);

  const naves = useQuery({
    queryKey: ['documentos', 'naves', idInversionista],
    queryFn: () => documentosApi.navesDeEmpresa(idInversionista),
    enabled: !!idInversionista,
  });

  // Desde la ficha de una nave la empresa NO se elige: viene de la nave (la ocupante primero).
  const desdeNave = !!idNaveInicial;
  const deNave = useQuery({
    queryKey: ['documentos', 'empresas-de-nave', idNaveInicial],
    queryFn: () => documentosApi.empresasDeNave(idNaveInicial!),
    enabled: !!idNaveInicial,
    retry: false, // un 404 («nave sin empresa») es una respuesta, no un fallo a reintentar
  });
  const opcionesNave = deNave.data ?? [];
  useEffect(() => {
    const primera = deNave.data?.[0];
    if (primera) setIdInversionista((actual) => actual || primera.idInversionista);
  }, [deNave.data]);

  const generar = useMutation({ mutationFn: documentosApi.vistaPrevia });

  /** Todo cambio de datos tras «Ver documento» deja el documento visto como desactualizado. */
  const alCambiarDatos = () => {
    setErrorVista(null);
    if (vista) setObsoleta(true);
  };

  function verDocumento(naveSel: { idNave: string; nivel: Nivel; cantidad: number }[]) {
    setErrorVista(null);
    generar.mutate(
      {
        idPlantilla,
        idInversionista,
        naves: naveSel.map((n) => ({ idNave: n.idNave, kvas: [{ nivel: n.nivel, cantidad: n.cantidad }] })),
      },
      {
        onSuccess: (datos) => {
          setObsoleta(false);
          setVista((v) => ({ n: (v?.n ?? 0) + 1, datos }));
        },
        onError: (e) => setErrorVista(mensajeError(e)),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Plantilla
          <select
            aria-label="Plantilla"
            value={idPlantilla}
            onChange={(e) => {
              setIdPlantilla(e.target.value);
              alCambiarDatos();
            }}
            disabled={lista.isLoading}
            className={CLASE_CONTROL}
          >
            <option value="">{lista.isLoading ? 'Cargando…' : 'Elige una plantilla'}</option>
            {activas.map((p) => (
              <option key={p.idPlantilla} value={p.idPlantilla}>
                {p.nombre} · v{p.versionActual}
              </option>
            ))}
          </select>
        </label>
        {desdeNave ? (
          <div className="flex flex-col gap-1 text-sm text-gray-700">
            <span id="gd-empresa-nave">Empresa de la nave</span>
            {deNave.isLoading && <p className="py-2 text-gray-400">Cargando…</p>}
            {deNave.error && (
              <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                Esta nave no tiene empresa registrada (ni ocupante ni dueño), por eso no se puede generar un
                documento para ella.
              </p>
            )}
            {opcionesNave.length === 1 && (
              <div
                aria-labelledby="gd-empresa-nave"
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800"
              >
                <span className="min-w-0 truncate font-medium">{opcionesNave[0]!.razonsocial}</span>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-200">
                  {ROL_ETIQUETA[opcionesNave[0]!.rol]}
                </span>
              </div>
            )}
            {opcionesNave.length > 1 && (
              <>
                <select
                  aria-labelledby="gd-empresa-nave"
                  value={idInversionista}
                  onChange={(e) => {
                    setIdInversionista(e.target.value);
                    alCambiarDatos();
                  }}
                  className={CLASE_CONTROL}
                >
                  {opcionesNave.map((e) => (
                    <option key={e.idInversionista} value={e.idInversionista}>
                      {e.razonsocial} · {ROL_ETIQUETA[e.rol]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Esta nave tiene más de una empresa; elige a nombre de cuál va el documento.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1 text-sm text-gray-700">
            <label htmlFor="gd-busca-empresa">Empresa</label>
            <input
              id="gd-busca-empresa"
              type="search"
              aria-label="Buscar empresa por nombre"
              placeholder="Buscar empresa por nombre…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              disabled={empresas.isLoading}
              className={CLASE_CONTROL}
            />
            <select
              aria-label="Empresa"
              value={idInversionista}
              onChange={(e) => {
                setIdInversionista(e.target.value);
                alCambiarDatos();
              }}
              disabled={empresas.isLoading}
              className={CLASE_CONTROL}
            >
              <option value="">{empresas.isLoading ? 'Cargando…' : `Elige una empresa (${visibles.length})`}</option>
              {visibles.map((e) => (
                <option key={e.idInversionista} value={e.idInversionista}>
                  {e.razonsocial} · {e.totalNaves} {e.totalNaves === 1 ? 'nave' : 'naves'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {lista.error && <Alerta>No pudimos cargar las plantillas. Reintenta.</Alerta>}
      {empresas.error && <Alerta>No pudimos cargar las empresas. Reintenta.</Alerta>}
      {!lista.isLoading && !lista.error && activas.length === 0 && (
        <p className="text-sm text-gray-500">No hay plantillas activas con campos automáticos.</p>
      )}

      {!idInversionista && !(desdeNave && deNave.error) && (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Elige una plantilla y una empresa para ver sus naves.
        </p>
      )}
      {idInversionista && naves.isLoading && <p className="text-sm text-gray-400">Cargando naves…</p>}
      {idInversionista && naves.error && <Alerta>No pudimos cargar las naves de la empresa. Reintenta.</Alerta>}
      {idInversionista && naves.data && naves.data.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
          Esta empresa no tiene naves.
        </p>
      )}
      {idInversionista && naves.data && naves.data.length > 0 && (
        <SeleccionNaves
          key={idInversionista}
          naves={naves.data}
          naveInicial={idNaveInicial}
          puedeVer={!!idPlantilla}
          generando={generar.isPending}
          onCambio={alCambiarDatos}
          onVer={verDocumento}
        />
      )}

      {errorVista && <Alerta>{errorVista}</Alerta>}

      {vista && (
        <Documento
          key={vista.n}
          datos={vista.datos}
          obsoleta={obsoleta}
          onCerrar={onCerrar}
        />
      )}
    </div>
  );
}

function mensajeError(e: unknown): string {
  if (e instanceof ApiRequestError) {
    const cod = codigoError(e.body) ?? '';
    if (cod.includes('NAVE_NO_ELEGIBLE'))
      return 'Alguna de las naves elegidas no pertenece a esta empresa. Vuelve a elegir la empresa y marca sus naves.';
    if (cod.includes('PLANTILLA_DE_BAJA')) return 'Esta plantilla está dada de baja. Elige otra.';
    if (cod.includes('PLANTILLA_SIN_CAMPOS')) return 'Esta plantilla no admite campos automáticos. Elige otra.';
    if (e.status === 404) return 'La plantilla ya no existe. Elige otra.';
    if (e.status === 403) return 'No tienes permiso para generar documentos.';
  }
  return 'No pudimos generar el documento. Reintenta.';
}

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

/** Naves de la empresa agrupadas por parque: casilla + KVA + nivel por nave. */
function SeleccionNaves({
  naves,
  naveInicial,
  puedeVer,
  generando,
  onCambio,
  onVer,
}: {
  naves: NaveDoc[];
  /** Nave que llega marcada (cuando se abre desde su ficha). */
  naveInicial?: string;
  puedeVer: boolean;
  generando: boolean;
  onCambio: () => void;
  onVer: (sel: { idNave: string; nivel: Nivel; cantidad: number }[]) => void;
}) {
  const [filas, setFilas] = useState<Record<string, FilaNave>>(() =>
    Object.fromEntries(
      naves.map((n) => [n.idNave, { ...filaInicial(n), marcada: n.idNave === naveInicial }]),
    ),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});

  const grupos = useMemo(() => {
    const m = new Map<string, { nombre: string; naves: NaveDoc[] }>();
    for (const n of naves) {
      const g = m.get(n.idParque) ?? { nombre: n.nomParque, naves: [] };
      g.naves.push(n);
      m.set(n.idParque, g);
    }
    return [...m.values()];
  }, [naves]);

  const marcadas = naves.filter((n) => filas[n.idNave]?.marcada);
  const todas = marcadas.length === naves.length;

  function cambiar(id: string, parche: Partial<FilaNave>) {
    setFilas((f) => ({ ...f, [id]: { ...f[id]!, ...parche } }));
    if (parche.kva !== undefined) setErrores((e) => ({ ...e, [id]: '' }));
    onCambio();
  }

  function marcarTodas(valor: boolean) {
    setFilas((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { ...v, marcada: valor }])));
    onCambio();
  }

  function ver() {
    const errs: Record<string, string> = {};
    const sel: { idNave: string; nivel: Nivel; cantidad: number }[] = [];
    for (const n of marcadas) {
      const f = filas[n.idNave]!;
      const r = validarKva(f.kva);
      if ('error' in r) errs[n.idNave] = r.error;
      else sel.push({ idNave: n.idNave, nivel: f.nivel, cantidad: r.valor });
    }
    setErrores(errs);
    if (Object.keys(errs).length === 0 && sel.length > 0) onVer(sel);
  }

  return (
    <section aria-label="Naves de la empresa" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">
          Naves ({marcadas.length} de {naves.length} marcadas)
        </h3>
        <button
          type="button"
          onClick={() => marcarTodas(!todas)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          {todas ? 'Desmarcar todas' : 'Marcar todas'}
        </button>
      </div>

      {grupos.map((g) => (
        <fieldset key={g.nombre} className="rounded-lg border border-gray-200">
          <legend className="ml-3 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Parque {g.nombre}
          </legend>
          <ul className="divide-y divide-gray-100">
            {g.naves.map((n) => {
              const f = filas[n.idNave]!;
              const err = errores[n.idNave];
              return (
                <li key={n.idNave} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                  <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      aria-label={`Nave ${n.numNave} del parque ${n.nomParque}`}
                      checked={f.marcada}
                      onChange={(e) => cambiar(n.idNave, { marcada: e.target.checked })}
                      className="h-4 w-4 accent-[#1f2a4d]"
                    />
                    <span className="font-medium">Nave {n.numNave}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                      {ETIQUETA_ROL[n.rol]}
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    KVA
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`KVA de la nave ${n.numNave}`}
                      aria-invalid={!!err}
                      value={f.kva}
                      disabled={!f.marcada}
                      onChange={(e) => cambiar(n.idNave, { kva: e.target.value.replace(/[^\d.,]/g, '') })}
                      className={`${CLASE_CONTROL} w-28 !py-1 ${err ? '!border-red-400' : ''}`}
                    />
                  </label>
                  <select
                    aria-label={`Nivel de tensión de la nave ${n.numNave}`}
                    value={f.nivel}
                    disabled={!f.marcada}
                    onChange={(e) => cambiar(n.idNave, { nivel: e.target.value === 'MT' ? 'MT' : 'BT' })}
                    className={`${CLASE_CONTROL} !py-1`}
                  >
                    <option value="BT">Baja tensión</option>
                    <option value="MT">Media tensión</option>
                  </select>
                  {err && (
                    <p role="alert" className="basis-full pl-6 text-xs text-red-600">
                      Nave {n.numNave}: {err}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!puedeVer && <span className="text-xs text-gray-500">Elige una plantilla para continuar.</span>}
        <button
          type="button"
          onClick={ver}
          disabled={!puedeVer || marcadas.length === 0 || generando}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3869] disabled:opacity-40"
        >
          {generando ? 'Generando…' : 'Ver documento'}
        </button>
      </div>
    </section>
  );
}

function Documento({
  datos,
  obsoleta,
  onCerrar,
}: {
  datos: VistaPreviaRespuesta;
  obsoleta: boolean;
  onCerrar: () => void;
}) {
  const hoja = useEditoresHoja(datos.contenido, !obsoleta);
  const [zoom, setZoom] = useZoomHoja();
  const [impresion, setImpresion] = useState<{ encabezado: string; cuerpo: string; pie: string } | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    raiz.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!impresion) return;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [impresion]);

  return (
    <div ref={raiz} className="flex flex-col gap-3">
      <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <span aria-hidden>⚠</span>
        Versión preliminar: no se guarda en el expediente. Lo que edites aquí no modifica la plantilla.
      </div>
      {datos.advertencias.length > 0 && (
        <div role="status" aria-label="Advertencias del documento" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="mb-1 font-medium">Revisa antes de imprimir:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {datos.advertencias.map((a, i) => (
              <li key={`${a.codigo}-${i}`}>{a.mensaje}</li>
            ))}
          </ul>
        </div>
      )}
      {obsoleta && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Cambiaste la plantilla, la empresa o las naves: este documento ya no corresponde. Pulsa «Ver documento»
          para generarlo de nuevo (se perderán los ajustes que hiciste a mano).
        </div>
      )}
      <div className={`overflow-hidden rounded-lg border border-gray-200 ${obsoleta ? 'opacity-50' : ''}`}>
        <BarraFormato editor={hoja.activo} habilitada={!obsoleta} zoom={zoom} onZoom={setZoom} />
        <div className="scrollbar-hide max-h-[55vh] overflow-auto bg-gray-50 p-4">
          <ZoomHoja zoom={zoom}>
            <HojaDocumento hoja={hoja} editable={!obsoleta} />
          </ZoomHoja>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCerrar} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700">
          Cerrar
        </button>
        <button
          type="button"
          disabled={obsoleta}
          onClick={() => {
            setImpresion(null);
            setTimeout(() => setImpresion(htmlDeHoja(hoja)), 0);
          }}
          className="flex items-center gap-2 rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3869] disabled:opacity-40"
        >
          <IconImprimir width={16} height={16} /> Imprimir / guardar PDF
        </button>
      </div>
      {impresion &&
        createPortal(
          <div className="solo-impresion hoja-doc">
            <div className="impresion-membrete">
              <div style={{ width: hoja.logoAncho, maxWidth: '100%', flexShrink: 0 }}>
                <Logo className={CLASE_LOGO} />
              </div>
              <div className="ProseMirror" style={{ width: 270, fontSize: 10 }} dangerouslySetInnerHTML={{ __html: impresion.encabezado }} />
            </div>
            <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: impresion.cuerpo }} />
            <div className="impresion-pie ProseMirror" dangerouslySetInnerHTML={{ __html: impresion.pie }} />
          </div>,
          document.body,
        )}
    </div>
  );
}
