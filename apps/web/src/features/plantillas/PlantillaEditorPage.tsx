import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/features/auth/useAuth';
import { ApiRequestError } from '@/lib/api';
import { contenidoInicial, docSinTexto } from './contenido-inicial';
import { BarraFormato, HojaDocumento, useEditoresHoja, useZoomHoja, ZoomHoja, type EditoresHoja } from './HojaDocumento';
import { HistorialVersiones } from './HistorialVersiones';
import { IconRayo, IconVolver } from './iconos';
import {
  codigoError,
  datosConflicto,
  ETIQUETA_TIPO,
  plantillasApi,
  type ContenidoPlantilla,
  type GrupoCampo,
  type PlantillaDetalle,
  type TipoPlantilla,
} from './plantillas.api';

/** Parques → Plantillas → editor (nueva o existente). */
export default function PlantillaEditorPage() {
  const { idPlantilla } = useParams();
  const [sp] = useSearchParams();
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const esNueva = idPlantilla === 'nueva';
  const puedeVer = tienePermiso(730) || tienePermiso(731) || tienePermiso(721);
  const puedeEditar = tienePermiso(731);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['plantillas', 'detalle', idPlantilla],
    queryFn: () => plantillasApi.obtener(idPlantilla!),
    enabled: !esNueva && puedeVer,
    staleTime: 0,
    gcTime: 0,
  });

  if (!puedeVer) {
    return <div className="p-6 text-sm text-gray-500">No tienes permiso para ver las plantillas.</div>;
  }

  if (!esNueva && isLoading) {
    return (
      <div className="flex h-full flex-col gap-3 bg-gray-50 p-4" aria-busy="true">
        <div className="h-10 animate-pulse rounded-lg bg-gray-200" />
        <div className="mx-auto h-[600px] w-[660px] max-w-full animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (!esNueva && (error || !data)) {
    const noExiste = error instanceof ApiRequestError && error.status === 404;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-600">
        <p>{noExiste ? 'Esta plantilla no existe o fue eliminada.' : 'No pudimos abrir la plantilla.'}</p>
        <div className="flex gap-2">
          {!noExiste && (
            <button type="button" onClick={() => void refetch()} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5">
              Reintentar
            </button>
          )}
          <button type="button" onClick={() => navigate('/parques/plantillas')} className="rounded-lg bg-[#1f2a4d] px-3 py-1.5 text-white">
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const tipoNuevo: TipoPlantilla = sp.get('tipo') === 'DEVOLUCION' ? 'DEVOLUCION' : 'ASIGNACION_CARGA';
  return (
    <Editor
      key={esNueva ? 'nueva' : `${data!.idPlantilla}-${data!.versionActual}`}
      detalle={esNueva ? null : data!}
      tipoNuevo={tipoNuevo}
      nombreNuevo={sp.get('nombre') ?? ''}
      puedeEditar={puedeEditar}
    />
  );
}

function Editor({
  detalle,
  tipoNuevo,
  nombreNuevo,
  puedeEditar,
}: {
  detalle: PlantillaDetalle | null;
  tipoNuevo: TipoPlantilla;
  nombreNuevo: string;
  puedeEditar: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const esNueva = !detalle;
  const deBaja = !!detalle && !detalle.status;
  const editable = puedeEditar && !deBaja;
  const tipo = detalle?.tipo ?? tipoNuevo;

  const [nombre, setNombre] = useState(detalle?.nombre ?? nombreNuevo);
  const [version, setVersion] = useState(detalle?.versionActual ?? 0);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salir, setSalir] = useState(false);
  const [historial, setHistorial] = useState(false);
  const { tienePermiso } = useAuth();
  const puedeHistorial = tienePermiso(730) || tienePermiso(731);
  const [conflicto, setConflicto] = useState<{
    versionActual: number;
    contenido: ContenidoPlantilla;
  } | null>(null);

  const [zoom, setZoom] = useZoomHoja();
  const hoja = useEditoresHoja(detalle?.contenido ?? contenidoInicial(tipo === 'ASIGNACION_CARGA'), editable && !guardando, () => {
    setSucio(true);
    setAviso(null);
  });

  useEffect(() => {
    if (!sucio) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [sucio]);

  function volver() {
    if (sucio) setSalir(true);
    else navigate('/parques/plantillas');
  }

  async function guardar(versionBase = version) {
    setError(null);
    const contenido = hoja.leer();
    if (!contenido) return;
    if (!nombre.trim()) {
      setError('Escribe un nombre para la plantilla.');
      return;
    }
    if (docSinTexto(contenido.cuerpo)) {
      setError('La plantilla no tiene texto.');
      return;
    }
    if (JSON.stringify(contenido).length > 60000) {
      setError('El texto es demasiado largo (máximo 20 000 caracteres entre encabezado, cuerpo y pie).');
      return;
    }
    setGuardando(true);
    try {
      if (esNueva) {
        const r = await plantillasApi.crear({ tipo, nombre: nombre.trim(), contenido });
        void qc.invalidateQueries({ queryKey: ['plantillas'] });
        setSucio(false);
        navigate(`/parques/plantillas/${r.idPlantilla}`, { replace: true });
        return;
      }
      const r = await plantillasApi.actualizar(detalle.idPlantilla, {
        nombre: nombre.trim(),
        contenido,
        versionBase,
      });
      void qc.invalidateQueries({ queryKey: ['plantillas'] });
      setVersion(r.version);
      setSucio(false);
      setConflicto(null);
      setAviso(`Se guardó la versión ${r.version}.`);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) {
        const cod = codigoError(e.body) ?? e.message;
        if (cod.includes('VERSION_DESACTUALIZADA')) {
          const d = datosConflicto(e.body);
          if (d) {
            setConflicto(d);
            return;
          }
        }
        if (cod.includes('NOMBRE_DUPLICADO')) {
          setError('Ya existe una plantilla activa con ese nombre.');
          return;
        }
        if (cod.includes('PLANTILLA_DE_BAJA')) {
          setError('Esta plantilla está dada de baja y ya no se puede editar.');
          return;
        }
      }
      setError('No se pudo guardar. Tus cambios siguen aquí; reintenta.');
    } finally {
      setGuardando(false);
    }
  }

  /** Restaura una versión anterior como versión nueva. Devuelve un mensaje de error o null. */
  async function restaurar(n: number): Promise<string | null> {
    if (!detalle) return null;
    try {
      const r = await plantillasApi.restaurar(detalle.idPlantilla, { version: n, versionBase: version });
      const v = await plantillasApi.version(detalle.idPlantilla, r.version);
      hoja.cargar(v.contenido);
      setVersion(r.version);
      setSucio(false);
      setError(null);
      setConflicto(null);
      setAviso(`Se restauró la versión ${n} como versión ${r.version}.`);
      setHistorial(false);
      // No se invalida 'detalle': cambiaría la `key` del Editor y lo remontaría perdiendo el aviso
      // (el editor ya quedó con el contenido nuevo vía hoja.cargar).
      void qc.invalidateQueries({ queryKey: ['plantillas', 'lista'] });
      void qc.invalidateQueries({ queryKey: ['plantillas', 'versiones'] });
      return null;
    } catch (e) {
      if (e instanceof ApiRequestError) {
        const cod = codigoError(e.body) ?? e.message;
        if (e.status === 409 && cod.includes('VERSION_DESACTUALIZADA')) {
          const d = datosConflicto(e.body);
          if (d) {
            setHistorial(false);
            setConflicto(d);
            return null;
          }
          return 'Otra persona guardó una versión nueva. Cierra el historial, recarga la plantilla y reintenta.';
        }
        if (e.status === 409 && cod.includes('PLANTILLA_DE_BAJA')) {
          return 'Esta plantilla está dada de baja y ya no se puede restaurar.';
        }
        if (e.status === 404) return 'Esa versión o la plantilla ya no existe.';
      }
      return 'No se pudo restaurar la versión. Reintenta.';
    }
  }

  return (
    // Alto propio = ventana − barra superior (3.5rem) − relleno de <main> (3rem): así solo
    // scrollea la hoja y la barra del nombre, la de formato y el panel de campos quedan fijos.
    <div className="flex h-[calc(100vh-6.5rem)] min-h-[420px] flex-col overflow-hidden bg-gray-50">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
        <button
          type="button"
          onClick={volver}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
        >
          <IconVolver width={16} height={16} /> Volver
        </button>
        <input
          aria-label="Nombre de la plantilla"
          value={nombre}
          maxLength={120}
          disabled={!editable}
          onChange={(e) => {
            setNombre(e.target.value);
            setSucio(true);
          }}
          placeholder="Nombre de la plantilla"
          className="min-w-[180px] flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-gray-800 outline-none hover:border-gray-200 focus:border-[#1f2a4d] focus:bg-white disabled:text-gray-600"
        />
        <Badge color="azul">{ETIQUETA_TIPO[tipo]}</Badge>
        <span className="text-sm tabular-nums text-gray-500">{esNueva ? 'Nueva' : `v${version}`}</span>
        {sucio && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Cambios sin guardar
          </span>
        )}
        {puedeHistorial && !esNueva && (
          <button
            type="button"
            onClick={() => setHistorial(true)}
            title="Ver el historial de versiones"
            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Historial
          </button>
        )}
        {editable && (
          <>
            <button
              type="button"
              onClick={volver}
              className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={guardando || (!sucio && !esNueva)}
              onClick={() => void guardar()}
              className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a3869] disabled:opacity-40"
            >
              {guardando ? 'Guardando…' : esNueva ? 'Guardar plantilla' : 'Guardar nueva versión'}
            </button>
          </>
        )}
      </div>

      {!puedeEditar && (
        <div className="bg-gray-100 px-4 py-1.5 text-xs text-gray-600">
          Solo lectura: no tienes permiso para editar plantillas.
        </div>
      )}
      {deBaja && (
        <div className="bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          Esta plantilla está dada de baja. Para reutilizarla, duplícala desde el listado.
        </div>
      )}
      {error && (
        <div role="alert" className="bg-red-50 px-4 py-1.5 text-sm text-red-700">
          {error}
        </div>
      )}
      {aviso && (
        <div role="status" className="bg-green-50 px-4 py-1.5 text-sm text-green-700">
          {aviso}
        </div>
      )}

      <BarraFormato editor={hoja.activo} habilitada={editable && !guardando} zoom={zoom} onZoom={setZoom} />

      <div className="flex min-h-0 flex-1">
        <div className="scrollbar-hide min-w-0 flex-1 overflow-auto p-6">
          <ZoomHoja zoom={zoom}>
            <HojaDocumento hoja={hoja} editable={editable} />
          </ZoomHoja>
        </div>
        <PanelCampos tipo={tipo} hoja={hoja} habilitado={editable && !guardando} />
      </div>

      {historial && detalle && (
        <HistorialVersiones
          idPlantilla={detalle.idPlantilla}
          versionVigente={version}
          puedeRestaurar={editable}
          hayCambios={sucio}
          onCerrar={() => setHistorial(false)}
          onRestaurar={restaurar}
        />
      )}

      {/* Salir con cambios */}
      <Modal
        abierto={salir}
        onCerrar={() => setSalir(false)}
        titulo="Cambios sin guardar"
        ancho="sm"
        pie={
          <>
            <button type="button" onClick={() => setSalir(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
              Seguir editando
            </button>
            <button
              type="button"
              onClick={() => {
                setSucio(false);
                navigate('/parques/plantillas');
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
            >
              Salir sin guardar
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Tienes cambios sin guardar. ¿Salir sin guardar?</p>
      </Modal>

      {/* Conflicto de versión */}
      <Modal
        abierto={!!conflicto}
        onCerrar={() => setConflicto(null)}
        titulo="Otra persona guardó una versión"
        ancho="md"
        pie={
          <>
            <button type="button" onClick={() => setConflicto(null)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
              Seguir editando
            </button>
            <button
              type="button"
              onClick={() => {
                if (!conflicto) return;
                hoja.cargar(conflicto.contenido);
                setVersion(conflicto.versionActual);
                setSucio(false);
                setConflicto(null);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm"
            >
              Cargar la versión nueva
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={() => conflicto && void guardar(conflicto.versionActual)}
              className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Guardar la mía como versión {conflicto ? conflicto.versionActual + 1 : ''}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Otra persona guardó la versión {conflicto?.versionActual} mientras editabas. Tu texto sigue en
          pantalla: puedes guardarlo encima de esa versión, o cargar la nueva (se reemplaza lo que
          escribiste).
        </p>
      </Modal>
    </div>
  );
}

const GRUPOS_CAMPOS: { grupo: GrupoCampo; titulo: string }[] = [
  { grupo: 'INVERSIONISTAS', titulo: 'Inversionistas' },
  { grupo: 'PARQUES', titulo: 'Parques' },
  { grupo: 'PROPIEDADES', titulo: 'Propiedades' },
  { grupo: 'SISTEMA', titulo: 'Sistema' },
];

/** Panel derecho de 300 px: un clic inserta el campo en el editor activo. */
function PanelCampos({ tipo, hoja, habilitado }: { tipo: TipoPlantilla; hoja: EditoresHoja; habilitado: boolean }) {
  const admiteCampos = tipo === 'ASIGNACION_CARGA';
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['plantillas', 'catalogo', tipo],
    queryFn: () => plantillasApi.catalogo(tipo),
    enabled: admiteCampos,
    staleTime: 5 * 60 * 1000,
  });
  const campos = data?.campos ?? [];

  function insertar(clave: string) {
    const ed = hoja.activo;
    if (!ed || !habilitado) return;
    ed.chain().focus().insertContent({ type: 'campo', attrs: { clave } }).run();
  }

  return (
    <aside
      aria-label="Campos automáticos"
      className="scrollbar-hide hidden w-[300px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4 lg:block"
    >
      <h2 className="mb-1 text-sm font-semibold text-gray-800">Campos automáticos</h2>
      {!admiteCampos ? (
        <p className="text-xs text-gray-500">Este tipo aún no tiene campos.</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-gray-500">
            Haz clic en un campo para insertarlo donde está el cursor. Al generar el documento se llena solo.
          </p>
          {isLoading && <p className="text-xs text-gray-400">Cargando campos…</p>}
          {error && (
            <div className="text-xs text-red-600">
              No pudimos cargar los campos.{' '}
              <button type="button" onClick={() => void refetch()} className="underline">
                Reintentar
              </button>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {GRUPOS_CAMPOS.map((g) => {
              const delGrupo = campos.filter((c) => c.grupo === g.grupo);
              if (delGrupo.length === 0) return null;
              return (
                <section key={g.grupo}>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.titulo}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {delGrupo.map((c) => (
                      <button
                        key={c.clave}
                        type="button"
                        disabled={!habilitado}
                        title={`Insertar «${c.etiqueta}». Ejemplo: ${c.ejemplo}`}
                        aria-label={`Insertar campo ${c.etiqueta}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertar(c.clave)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#8DBE2F] bg-[#ecfccb] px-2.5 py-1 text-xs text-[#3f6212] transition-colors hover:bg-[#d9f99d] disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <IconRayo width={11} height={11} /> {c.etiqueta}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
