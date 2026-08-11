import { useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/Badge';
import { ApiRequestError } from '@/lib/api';
import { parquesApi } from './parques.api';
import {
  ETIQUETA_ETAPA,
  kvasApi,
  type Acometida,
  type AsignacionKva,
  type DesgloseNivelKva,
  type EtapaKva,
  type FiguraKva,
  type OcupanteTipo,
  type ResumenParqueKva,
} from './kvas.api';
import { NaveKvaModal } from './NaveKvaModal';

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 });

/** Filas del tablero, en el mismo orden que el control operativo en Excel. */
const FILAS: {
  clave: keyof DesgloseNivelKva;
  etiqueta: string;
  nota?: string;
  destacar?: 'cabecera' | 'saldo';
}[] = [
  { clave: 'total', etiqueta: 'Disponibilidad actual del parque', destacar: 'cabecera' },
  { clave: 'dotado', etiqueta: 'Dotado a naves', nota: 'lo que les toca por disposición' },
  { clave: 'sinDotar', etiqueta: 'Sin dotar', nota: 'capacidad sin repartir a ninguna nave' },
  { clave: 'asignado', etiqueta: 'Ya asignados', nota: 'ya hay contrato con CFE' },
  { clave: 'comprometido', etiqueta: 'Comprometidos con inquilinos' },
  { clave: 'porAsignar', etiqueta: 'Por asignar', nota: 'dotado sin dueño todavía' },
  { clave: 'renta', etiqueta: 'Rentados a inquilinos' },
  { clave: 'devuelto', etiqueta: 'Devueltos al parque' },
  { clave: 'disponible', etiqueta: 'Disponibles actualmente', destacar: 'saldo' },
];

/**
 * Parques → KVA's. Tablero de capacidad eléctrica, con la misma lectura que el
 * control operativo en Excel: un bloque por parque con las dos bolsas
 * independientes (Baja y Media) y su saldo.
 *
 * Es de SOLO LECTURA por ahora (asignar/devolver llega en la fase siguiente).
 * Se listan TODOS los parques activos, también los que aún no tienen nada
 * capturado: verlos en ceros es la señal de qué falta por capturar.
 *
 * Un disponible NEGATIVO se pinta en rojo: es un sobregiro real, no un error.
 */
export default function KvasPage() {
  const [expandido, setExpandido] = useState<string | null>(null);

  const {
    data: resumen,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['kvas', 'resumen'],
    queryFn: kvasApi.resumen,
  });

  const parques = useMemo<ResumenParqueKva[]>(() => {
    if (!resumen) return [];
    return [...resumen.acometidas.flatMap((a) => a.parques), ...resumen.sinAcometida];
  }, [resumen]);

  const totales = useMemo(() => {
    const sumar = (sel: (p: ResumenParqueKva) => DesgloseNivelKva) => ({
      total: parques.reduce((s, p) => s + sel(p).total, 0),
      asignado: parques.reduce((s, p) => s + sel(p).asignado, 0),
      disponible: parques.reduce((s, p) => s + sel(p).disponible, 0),
    });
    return { bt: sumar((p) => p.bt), mt: sumar((p) => p.mt) };
  }, [parques]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <header>
        <h1 className="text-lg font-semibold text-gray-800">KVA's</h1>
        <p className="text-xs text-gray-500">
          Capacidad eléctrica contratada con CFE y su reparto entre naves. Baja y media
          son bolsas independientes.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cargar el tablero:{' '}
          {error instanceof ApiRequestError ? error.message : 'error inesperado'}.
        </p>
      )}

      {isLoading && <p className="text-sm text-gray-400">Cargando…</p>}

      {!isLoading && !error && parques.length === 0 && (
        <p className="text-sm text-gray-400">No hay parques activos registrados.</p>
      )}

      {parques.length > 0 && (
        <>
          {/* Totales de todos los parques (el bloque "TOTALES" del Excel). */}
          <section className="grid gap-3 sm:grid-cols-2">
            <TarjetaTotal titulo="Baja tensión" {...totales.bt} />
            <TarjetaTotal titulo="Media tensión" {...totales.mt} />
          </section>

          {resumen?.acometidas.map((a) => (
            <GrupoAcometida
              key={a.idAcometida}
              acometida={a}
              expandido={expandido}
              onExpandir={setExpandido}
            />
          ))}

          {(resumen?.sinAcometida.length ?? 0) > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-700">Sin acometida asignada</h2>
              <div className="grid gap-3 xl:grid-cols-2">
                {resumen!.sinAcometida.map((p) => (
                  <BloqueParque
                    key={p.idParque}
                    parques={[p]}
                    abierto={expandido === p.idParque}
                    onToggle={() =>
                      setExpandido(expandido === p.idParque ? null : p.idParque)
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaTotal({
  titulo,
  total,
  asignado,
  disponible,
}: {
  titulo: string;
  total: number;
  asignado: number;
  disponible: number;
}) {
  return (
    <article className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">Totales · {titulo}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Dato etiqueta="Capacidad" valor={total} />
        <Dato etiqueta="Con CFE" valor={asignado} />
        <Dato etiqueta="Disponibles" valor={disponible} resaltar />
      </div>
    </article>
  );
}

function Dato({
  etiqueta,
  valor,
  resaltar,
}: {
  etiqueta: string;
  valor: number;
  resaltar?: boolean;
}) {
  const color = valor < 0 ? 'text-red-600' : resaltar ? 'text-amber-700' : 'text-[#1f2a4d]';
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{etiqueta}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{fmt(valor)}</p>
    </div>
  );
}

function GrupoAcometida({
  acometida,
  expandido,
  onExpandir,
}: {
  acometida: Acometida;
  expandido: string | null;
  onExpandir: (id: string | null) => void;
}) {
  const excedido =
    acometida.repartidoMt > acometida.capacidadMt ||
    acometida.repartidoBt > acometida.capacidadBt;

  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-xl border bg-[#1f2a4d]/5 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700">
          Acometida: {acometida.nombre}
          {acometida.tensionKv ? ` · ${fmt(acometida.tensionKv)} kV` : ''}
          {acometida.folioCfe ? ` · CFE ${acometida.folioCfe}` : ''}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Contratado {fmt(acometida.capacidadBt)} baja / {fmt(acometida.capacidadMt)} media ·
          repartido a parques {fmt(acometida.repartidoBt)} / {fmt(acometida.repartidoMt)}
          {excedido && (
            <span className="ml-2 font-semibold text-red-600">
              ⚠️ El reparto excede lo contratado
            </span>
          )}
        </p>
      </div>

      {acometida.parques.length === 0 ? (
        <p className="px-1 text-xs text-gray-400">Sin parques vinculados a esta acometida.</p>
      ) : (
        /*
          ⛔ Los parques que COMPARTEN acometida se presentan en UN SOLO bloque
          (Spartek I & II, 2026-08-04): el negocio los opera como un solo pool y
          verlos partidos confundía — además, el reparto por parque es artificial
          y hacía aparecer un disponible negativo que no existe en la realidad.
        */
        <div className="grid gap-3 xl:grid-cols-2">
          <BloqueParque
            parques={acometida.parques}
            abierto={expandido === acometida.idAcometida}
            onToggle={() =>
              onExpandir(expandido === acometida.idAcometida ? null : acometida.idAcometida)
            }
          />
        </div>
      )}
    </section>
  );
}

/** Suma varias bolsas del mismo nivel en una sola (pool combinado). */
function sumarBolsas(bolsas: DesgloseNivelKva[]): DesgloseNivelKva {
  const s = (k: keyof DesgloseNivelKva) => bolsas.reduce((acc, b) => acc + b[k], 0);
  return {
    total: s('total'),
    dotado: s('dotado'),
    sinDotar: s('sinDotar'),
    asignado: s('asignado'),
    comprometido: s('comprometido'),
    porAsignar: s('porAsignar'),
    venta: s('venta'),
    renta: s('renta'),
    devuelto: s('devuelto'),
    consumido: s('consumido'),
    disponible: s('disponible'),
    naves: s('naves'),
  };
}

/**
 * Un bloque de la tabla Carga × (Baja, Media) del Excel.
 *
 * Recibe UNO o VARIOS parques: cuando comparten acometida se muestran juntos,
 * con ambos nombres en el encabezado y las cifras sumadas, porque el negocio
 * los maneja como un solo parque.
 */
function BloqueParque({
  parques,
  abierto,
  onToggle,
}: {
  parques: ResumenParqueKva[];
  abierto: boolean;
  onToggle: () => void;
}) {
  const bt = useMemo(() => sumarBolsas(parques.map((p) => p.bt)), [parques]);
  const mt = useMemo(() => sumarBolsas(parques.map((p) => p.mt)), [parques]);

  const titulo = parques.map((p) => p.nomParque ?? p.idParque).join(' & ');
  const idsParque = parques.map((p) => p.idParque);
  const parque = { bt, mt };

  const vacio =
    parque.bt.total === 0 &&
    parque.mt.total === 0 &&
    parque.bt.consumido === 0 &&
    parque.mt.consumido === 0;

  return (
    <article className="overflow-hidden rounded-xl border bg-white shadow-sm">
      {/*
        Verde de marca con el nombre en BLANCO (decisión de Jereff, 2026-08-04).
        El blanco sobre este verde queda en ~2:1 de contraste, así que se le
        añade una sombra sutil: no cambia el color pedido y despega el texto del
        fondo lo suficiente para que se lea.
      */}
      <header className="flex items-center justify-between gap-2 bg-[#8DBE2F] px-4 py-2.5">
        <div className="min-w-0">
          <h3
            className="truncate text-xl font-bold text-white"
            title={titulo}
            style={{ textShadow: '0 1px 2px rgba(31,42,77,.45)' }}
          >
            {titulo}
          </h3>
          <p className="text-[11px] font-medium text-white/90">
            {vacio
              ? 'Sin información capturada'
              : `${parque.bt.naves + parque.mt.naves} asignaciones a naves`}
            {parques.length > 1 && ` · ${parques.length} parques en un solo pool`}
          </p>
        </div>
        <button
          onClick={onToggle}
          className="shrink-0 rounded-lg bg-white/90 px-2.5 py-1 text-xs font-medium text-[#1f2a4d] hover:bg-white"
        >
          {abierto ? 'Ocultar naves' : 'Ver naves'}
        </button>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1f2a4d] text-left text-xs uppercase tracking-wide text-white">
            <th className="px-3 py-1.5 font-medium">Carga</th>
            <th className="w-24 px-3 py-1.5 text-right font-medium">Baja</th>
            <th className="w-24 px-3 py-1.5 text-right font-medium">Media</th>
          </tr>
        </thead>
        <tbody>
          {FILAS.map((f) => (
            <FilaCarga key={f.clave} fila={f} bt={parque.bt} mt={parque.mt} />
          ))}
        </tbody>
      </table>

      {abierto && <NavesDelBloque idsParque={idsParque} />}
    </article>
  );
}

function FilaCarga({
  fila,
  bt,
  mt,
}: {
  fila: (typeof FILAS)[number];
  bt: DesgloseNivelKva;
  mt: DesgloseNivelKva;
}) {
  const vBt = bt[fila.clave];
  const vMt = mt[fila.clave];
  // Las filas informativas (renta, devueltos) se ocultan si no hay nada que
  // decir: el tablero se lee mejor sin ceros que nunca cambian.
  const opcional = fila.clave === 'renta' || fila.clave === 'devuelto';
  if (opcional && vBt === 0 && vMt === 0) return null;

  // «Dotado» y «Sin dotar» son el reparto de la capacidad, no movimientos:
  // van con sangría y en gris para que no compitan con las filas de negocio.
  const estructural = fila.clave === 'dotado' || fila.clave === 'sinDotar';

  const fondo =
    fila.destacar === 'cabecera'
      ? 'bg-emerald-50/60 font-medium'
      : fila.destacar === 'saldo'
        ? 'bg-amber-50 font-semibold'
        : estructural
          ? 'text-gray-500'
          : '';
  const color = (v: number) => (v < 0 ? 'text-red-600' : 'text-gray-800');

  return (
    <tr className={`border-t ${fondo}`}>
      <td className={`px-3 py-1.5 ${estructural ? 'pl-6 text-gray-500' : 'text-gray-700'}`}>
        {fila.etiqueta}
        {fila.nota && <span className="ml-1 text-[11px] text-gray-400">({fila.nota})</span>}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${color(vBt)}`}>{fmt(vBt)}</td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${color(vMt)}`}>{fmt(vMt)}</td>
    </tr>
  );
}



/** Una nave del parque con sus KVA ya resumidos por bolsa. */
interface FilaNave {
  idNave: string;
  /** Su parque real: en un bloque combinado hay naves de más de uno. */
  idParque: string;
  etiqueta: string;
  numNave: number;
  ocupante: string | null;
  ocupanteTipo: OcupanteTipo | null;
  bt: number;
  mt: number;
  /** Figura/etapa si todas sus asignaciones coinciden; `null` si están mezcladas. */
  figura: FiguraKva | null;
  etapa: EtapaKva | null;
  docsTotal: number;
  docsTitulos: string[];
}

/** Texto del tooltip al pasar el cursor sobre el número de nave. */
function tooltip(f: FilaNave): string {
  const docs =
    f.docsTotal === 0
      ? 'Sin documentos.'
      : `${f.docsTotal} documento${f.docsTotal === 1 ? '' : 's'}:\n${f.docsTitulos
          .map((t) => `• ${t}`)
          .join('\n')}${
          f.docsTotal > f.docsTitulos.length
            ? `\n…y ${f.docsTotal - f.docsTitulos.length} más`
            : ''
        }`;
  return `${docs}\n\nClic para ver sus KVA y documentos.`;
}

/**
 * Detalle del bloque: **todas** las naves de sus parques, tengan KVA o no.
 *
 * Listar también las vacías es a propósito — es como se lee el control
 * operativo (una columna por nave, aunque esté en blanco) y es la única vía
 * para asignarle KVA a una nave que todavía no tiene nada.
 *
 * Recibe VARIOS parques cuando comparten acometida (Spartek I & II): sus naves
 * van en una sola lista, porque el negocio las opera como un solo conjunto.
 */
function NavesDelBloque({ idsParque }: { idsParque: string[] }) {
  const [abierta, setAbierta] = useState<FilaNave | null>(null);
  const qc = useQueryClient();

  const asignaciones = useQueries({
    queries: idsParque.map((id) => ({
      queryKey: ['kvas', 'parque', id],
      queryFn: () => kvasApi.porParque(id),
    })),
  });
  const naves = useQueries({
    queries: idsParque.map((id) => ({
      queryKey: ['parques', id, 'naves'],
      queryFn: () => parquesApi.naves(id),
    })),
  });

  const cargando = [...asignaciones, ...naves].some((q) => q.isLoading);
  const fallo = [...asignaciones, ...naves].some((q) => q.error);

  // `useQueries` devuelve un array nuevo en cada render, así que la dependencia
  // del memo es el sello de tiempo de los datos, no el array.
  const selloAsignaciones = asignaciones.map((q) => q.dataUpdatedAt).join();
  const selloNaves = naves.map((q) => q.dataUpdatedAt).join();

  const filas = useMemo<FilaNave[]>(() => {
    const vivas = asignaciones.flatMap((q) => q.data ?? []).filter((a) => a.status);
    const porNave = new Map<string, AsignacionKva[]>();
    for (const a of vivas) porNave.set(a.idNave, [...(porNave.get(a.idNave) ?? []), a]);

    const unico = <T,>(vals: T[]): T | null =>
      vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0]! : null;

    return naves
      .flatMap((q) => q.data ?? [])
      .map((n) => {
        const suyas = porNave.get(n.idNave) ?? [];
        const primera = suyas[0];
        return {
          idNave: n.idNave,
          idParque: n.idParque ?? idsParque[0]!,
          etiqueta: n.numNaveNAME ?? String(n.numNave ?? ''),
          numNave: n.numNave ?? 0,
          ocupante: primera?.ocupante ?? null,
          ocupanteTipo: primera?.ocupanteTipo ?? null,
          bt: suyas.filter((a) => a.nivel === 'BT').reduce((s, a) => s + a.cantKvas, 0),
          mt: suyas.filter((a) => a.nivel === 'MT').reduce((s, a) => s + a.cantKvas, 0),
          figura: unico(suyas.map((a) => a.figura)),
          etapa: unico(suyas.map((a) => a.etapa)),
          docsTotal: primera?.docsTotal ?? 0,
          docsTitulos: primera?.docsTitulos ?? [],
        };
      })
      /*
        Se ordena por el número que SE VE (`numNaveNAME`), no por `numNave`.
        Son distintos: `numNaveNAME` es la numeración corrida del control
        operativo y `numNave` reinicia en 1 por parque — al juntar Spartek I & II
        ordenar por el interno intercalaba las naves de los dos parques.
        `numNaveNAME` es TEXTO, así que se compara su valor numérico. Las que no
        son número (Cafetería, PTAR, Caseta…) van PRIMERO y en orden alfabético:
        son las áreas comunes, y el control operativo también las lleva al
        principio, antes de las naves numeradas.
      */
      .sort((x, y) => {
        const nx = Number.parseInt(x.etiqueta, 10);
        const ny = Number.parseInt(y.etiqueta, 10);
        const xNum = Number.isFinite(nx);
        const yNum = Number.isFinite(ny);
        if (xNum && yNum) return nx - ny || x.etiqueta.localeCompare(y.etiqueta);
        if (xNum) return 1;
        if (yNum) return -1;
        return x.etiqueta.localeCompare(y.etiqueta, 'es');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selloAsignaciones, selloNaves]);

  const totalBt = filas.reduce((s, f) => s + f.bt, 0);
  const totalMt = filas.reduce((s, f) => s + f.mt, 0);

  function refrescarTablero() {
    void qc.invalidateQueries({ queryKey: ['kvas', 'resumen'] });
    for (const id of idsParque)
      void qc.invalidateQueries({ queryKey: ['kvas', 'parque', id] });
  }

  if (cargando)
    return <p className="px-4 py-3 text-xs text-gray-400">Cargando naves…</p>;
  if (fallo)
    return (
      <p className="px-4 py-3 text-xs text-red-600">
        No se pudo cargar el detalle de naves.
      </p>
    );
  if (filas.length === 0)
    return <p className="px-4 py-3 text-xs text-gray-400">Este parque no tiene naves.</p>;

  return (
    <div className="max-h-80 overflow-auto border-t">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50 text-left uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-1.5">Nave / ocupante</th>
            <th className="w-16 px-3 py-1.5 text-right">Baja</th>
            <th className="w-16 px-3 py-1.5 text-right">Media</th>
            <th className="px-3 py-1.5">Situación</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const sinKva = f.bt === 0 && f.mt === 0;
            return (
              <tr
                key={f.idNave}
                onClick={() => setAbierta(f)}
                title={tooltip(f)}
                className={`cursor-pointer border-t hover:bg-gray-50 ${
                  sinKva ? 'text-gray-400' : ''
                }`}
              >
                <td className="px-3 py-1.5">
                  <span
                    className={`font-medium ${sinKva ? 'text-gray-400' : 'text-[#1f2a4d]'}`}
                  >
                    {f.etiqueta}
                  </span>
                  {f.docsTotal > 0 && (
                    <span className="ml-1 rounded bg-[#1f2a4d]/10 px-1 text-[10px] font-semibold text-[#1f2a4d]">
                      📎 {f.docsTotal}
                    </span>
                  )}
                  {f.ocupante && (
                    <>
                      <span className="ml-2 text-gray-500">{f.ocupante}</span>
                      {f.ocupanteTipo === 'INVERSIONISTA' && (
                        <span className="ml-1 text-[10px] uppercase tracking-wide text-gray-400">
                          (propietario)
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {f.bt > 0 ? fmt(f.bt) : '—'}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {f.mt > 0 ? fmt(f.mt) : '—'}
                </td>
                <td className="px-3 py-1.5">
                  {sinKva ? (
                    <span className="text-gray-400">Sin KVA asignados</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1">
                      <Badge color={f.figura === 'RENTA' ? 'azul' : 'ambar'}>
                        {f.figura === 'VENTA'
                          ? 'Vendido'
                          : f.figura === 'RENTA'
                            ? 'Rentado'
                            : 'Mixto'}
                      </Badge>
                      <span className="text-gray-500">
                        {f.etapa ? ETIQUETA_ETAPA[f.etapa] : 'Varias etapas'}
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        {/*
          Suma de lo repartido a naves. Debe cuadrar con «Asignados contratos
          venta» + «Rentados» del bloque de arriba; si no cuadra, hay
          asignaciones apuntando a naves que ya no existen en el parque.
        */}
        <tfoot className="sticky bottom-0 border-t-2 border-[#1f2a4d] bg-gray-50 font-semibold text-gray-800">
          <tr>
            <td className="px-3 py-1.5">
              Total repartido a naves
              <span className="ml-1 font-normal text-[11px] text-gray-400">
                ({filas.filter((f) => f.bt > 0 || f.mt > 0).length} de {filas.length} naves)
              </span>
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">{fmt(totalBt)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{fmt(totalMt)}</td>
            <td className="px-3 py-1.5"></td>
          </tr>
        </tfoot>
      </table>

      {abierta && (
        <NaveKvaModal
          idParque={abierta.idParque}
          idNave={abierta.idNave}
          nave={abierta.etiqueta}
          ocupante={abierta.ocupante}
          arrendada={abierta.ocupanteTipo === 'ARRENDATARIO'}
          onClose={() => setAbierta(null)}
          onCambio={refrescarTablero}
        />
      )}
    </div>
  );
}
