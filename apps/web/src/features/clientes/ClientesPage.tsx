import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clientesApi,
  CHIPS,
  OPCIONES_TIPO,
  etiquetasTipo,
  type Cliente,
  type ClienteInput,
  type Dependencia,
  type EtiquetaTipo,
} from './clientes.api';
import { ClienteSheet } from './ClienteSheet';
import { Badge, type BadgeColor } from '@/components/Badge';
import { Paginacion } from '@/components/Paginacion';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';

const POR_PAGINA = 30;
const VACIO: Set<string> = new Set();

const fechaCorta = (iso: string | null): string => {
  if (!iso) return '—';
  const p = (iso.split('T')[0] ?? iso).split('-');
  return p.length === 3 ? `${Number(p[2])}/${Number(p[1])}/${p[0]}` : iso;
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Color de cada etiqueta de tipo (presentación). */
const COLOR_TIPO: Record<EtiquetaTipo, BadgeColor> = {
  Inversionista: 'azul',
  Arrendatario: 'verde',
  Ticket: 'morado',
  'Usuario Final': 'teal',
  'Sin clasificar': 'ambar',
  Papelera: 'gris',
};

/** Al crear con un tipo único filtrado, se premarca esa casilla. */
const PRESET_ETIQUETA: Partial<Record<EtiquetaTipo, Partial<ClienteInput>>> = {
  Inversionista: { inversionista: true },
  Arrendatario: { arrendatario: true },
  Ticket: { ticket: true },
  'Usuario Final': { usuarioFinal: true },
};

/**
 * Columnas de datos (además de Opciones + Tipo). Cada una es ordenable y trae su
 * filtro de columna multi-selección (regla de diseño 7c). `valor` define tanto el
 * texto de la celda como las opciones/agrupación del filtro.
 */
const COLUMNAS: {
  campo: string;
  label: string;
  valor: (c: Cliente) => string;
  thClass?: string;
  nowrap?: boolean;
  ancho?: number;
}[] = [
  { campo: 'personalidad', label: 'Personalidad', valor: (c) => c.personalidad ?? '' },
  { campo: 'idContpac', label: 'idContpac', valor: (c) => c.idContpac ?? '' },
  {
    campo: 'razonsocial',
    label: 'Razón Social',
    valor: (c) => c.razonsocial ?? '',
    thClass: 'min-w-[350px] max-w-[350px]',
    ancho: 350,
  },
  { campo: 'nombre', label: 'Nombre', valor: (c) => c.nombre ?? '' },
  { campo: 'apellido1', label: 'Apellido 1', valor: (c) => c.apellido1 ?? '' },
  { campo: 'apellido2', label: 'Apellido 2', valor: (c) => c.apellido2 ?? '' },
  {
    campo: 'fecNacimiento',
    label: 'Fecha nac.',
    valor: (c) => fechaCorta(c.fecNacimiento),
    nowrap: true,
  },
  { campo: 'telefono', label: 'Teléfono', valor: (c) => c.telefono ?? '', nowrap: true },
  { campo: 'correo', label: 'Correo', valor: (c) => c.correo ?? '' },
  { campo: 'rfc', label: 'RFC', valor: (c) => c.RFC ?? '' },
  { campo: 'curp', label: 'CURP', valor: (c) => c.CURP ?? '' },
];

const ACCESSORS: Accessors<Cliente> = {
  tipo: (c) => etiquetasTipo(c).join(', '),
  personalidad: (c) => c.personalidad,
  idContpac: (c) => c.idContpac,
  razonsocial: (c) => c.razonsocial,
  nombre: (c) => c.nombre,
  apellido1: (c) => c.apellido1,
  apellido2: (c) => c.apellido2,
  fecNacimiento: (c) => c.fecNacimiento,
  telefono: (c) => c.telefono,
  correo: (c) => c.correo,
  rfc: (c) => c.RFC,
  curp: (c) => c.CURP,
};

/** ¿La selección de tipos es exactamente la del chip? (para marcarlo activo). */
const mismoSet = (sel: Set<string>, etiquetas: readonly string[]): boolean =>
  sel.size === etiquetas.length && etiquetas.every((e) => sel.has(e));

export function ClientesPage() {
  const queryClient = useQueryClient();
  const [tipoSel, setTipoSel] = useState<Set<string>>(new Set());
  const [filtros, setFiltros] = useState<Record<string, Set<string>>>({});
  const [busca, setBusca] = useState('');
  const [editar, setEditar] = useState<Cliente | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [avisoDep, setAvisoDep] = useState<{ cliente: Cliente; deps: Dependencia[] } | null>(
    null,
  );

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => clientesApi.listar('todos'),
  });

  // Ids con naves ligadas vivas → resaltar en rosa los de la Papelera (recursos atrapados).
  const { data: idsConVinculos = [] } = useQuery({
    queryKey: ['clientes-con-vinculos'],
    queryFn: () => clientesApi.conVinculos(),
  });
  const setVinculos = useMemo(() => new Set(idsConVinculos), [idsConVinculos]);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['clientes'] });

  const setFiltro = (campo: string, s: Set<string>) =>
    setFiltros((f) => ({ ...f, [campo]: s }));

  /** Valores distintos por columna, para el embudo de cada filtro. */
  const opciones = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const col of COLUMNAS) {
      m[col.campo] = [...new Set(clientes.map((c) => col.valor(c)))].sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true }),
      );
    }
    return m;
  }, [clientes]);

  const filtrados = useMemo(() => {
    const q = norm(busca.trim());
    // La papelera (pruebas=true) se OCULTA en la vista por defecto, pero se
    // incluye al buscar (para encontrar un extraviado) o al pedir el chip Papelera.
    const mostrarPapelera = q.length > 0 || tipoSel.has('Papelera');
    return clientes.filter((c) => {
      if (!mostrarPapelera && c.pruebas) return false;
      if (tipoSel.size > 0 && !etiquetasTipo(c).some((e) => tipoSel.has(e))) return false;
      for (const col of COLUMNAS) {
        const sel = filtros[col.campo];
        if (sel && sel.size > 0 && !sel.has(col.valor(c))) return false;
      }
      if (!q) return true;
      return [c.razonsocial, c.nombre, c.apellido1, c.apellido2, c.RFC, c.CURP, c.correo, c.telefono]
        .filter(Boolean)
        .some((v) => norm(String(v)).includes(q));
    });
  }, [clientes, busca, tipoSel, filtros]);

  const { ordenados, sortKey, dir, toggle } = useSort(filtrados, ACCESSORS, {
    key: 'razonsocial',
    dir: 'asc',
  });

  // La página vuelve a 1 cuando cambia lo que filtra el conjunto.
  useEffect(() => {
    setPagina(1);
  }, [busca, tipoSel, filtros]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visibles = ordenados.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  // Preset del alta: si el filtro está en un tipo único, se premarca esa casilla.
  const etiquetaUnica = tipoSel.size === 1 ? ([...tipoSel][0] as EtiquetaTipo) : null;
  const presetNuevo = (etiquetaUnica && PRESET_ETIQUETA[etiquetaUnica]) || {};

  /** Desde el aviso de duplicado: cierra el alta y abre la edición del existente
   *  (se recarga completo por id, porque la verificación solo trae datos mínimos). */
  const abrirExistente = async (
    id: string,
    tipoSugerido?: 'inversionista' | 'arrendatario' | 'ticket' | 'usuarioFinal',
  ) => {
    const c = await clientesApi.obtener(id);
    setNuevo(false);
    setEditar(tipoSugerido ? { ...c, [tipoSugerido]: true } : c);
  };

  async function papelera(c: Cliente) {
    setEliminando(c.idInversionista);
    try {
      // Guardia: si tiene recursos vivos ligados, no se archiva; se guía a desligarlos.
      const deps = await clientesApi.dependencias(c.idInversionista);
      if (deps.length > 0) {
        setAvisoDep({ cliente: c, deps });
        return;
      }
      if (!window.confirm(`¿Mover a la papelera a "${c.razonsocial ?? c.nombre ?? ''}"?`)) return;
      await clientesApi.moverPapelera(c.idInversionista);
      await refrescar();
    } catch (err) {
      // El backend revalida (409 si cambió entre la consulta y la acción).
      window.alert(err instanceof Error ? err.message : 'No se pudo mover a la papelera.');
    } finally {
      setEliminando(null);
    }
  }

  async function restaurar(c: Cliente) {
    if (
      !window.confirm(
        `¿Sacar de la papelera a "${c.razonsocial ?? c.nombre ?? ''}"? Quedará como "Sin clasificar"; recuerda asignarle un tipo.`,
      )
    )
      return;
    setEliminando(c.idInversionista);
    try {
      await clientesApi.restaurar(c.idInversionista);
      await refrescar();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo restaurar el cliente.');
    } finally {
      setEliminando(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Clientes</h1>
        <button
          type="button"
          onClick={() => setNuevo(true)}
          className="rounded-lg bg-[#1f2a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a376a]"
        >
          + Agregar nuevo
        </button>
      </div>

      {/* Chips (filtro rápido de tipo) + buscador */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {CHIPS.map((c) => {
            const activo = mismoSet(tipoSel, c.etiquetas);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setTipoSel(new Set<string>(c.etiquetas))}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activo
                    ? 'border-[#1f2a4d] bg-[#1f2a4d] text-white'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nombre, razón social, RFC…"
          className="w-72 rounded border px-2 py-1.5 text-sm"
        />
      </div>

      <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '64vh' }}>
        <table className="min-w-full border-collapse text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <th className="px-3 py-3 text-center">Opciones</th>
              <SortableTh
                campo="tipo"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Tipo"
                    opciones={OPCIONES_TIPO}
                    seleccion={tipoSel}
                    onChange={setTipoSel}
                  />
                }
              >
                Tipo
              </SortableTh>
              {COLUMNAS.map((col) => (
                <SortableTh
                  key={col.campo}
                  campo={col.campo}
                  sortKey={sortKey}
                  dir={dir}
                  onSort={toggle}
                  className={col.thClass}
                  filtro={
                    <FiltroColumnaOpciones
                      etiqueta={col.label}
                      opciones={opciones[col.campo] ?? []}
                      seleccion={filtros[col.campo] ?? VACIO}
                      onChange={(s) => setFiltro(col.campo, s)}
                    />
                  }
                >
                  {col.label}
                </SortableTh>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                  Sin clientes en esta vista.
                </td>
              </tr>
            ) : (
              visibles.map((c) => (
                <tr
                  key={c.idInversionista}
                  className={
                    c.pruebas && setVinculos.has(c.idInversionista)
                      ? 'bg-pink-100 hover:bg-pink-200'
                      : 'hover:bg-gray-50'
                  }
                  title={
                    c.pruebas && setVinculos.has(c.idInversionista)
                      ? 'En papelera pero aún tiene naves/propiedades ligadas — desvincúlalas antes de eliminar'
                      : undefined
                  }
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditar(c)}
                        title="Editar"
                        className="text-[#3f5b87] hover:text-[#1f2a4d]"
                        aria-label="Editar"
                      >
                        ✏️
                      </button>
                      {c.pruebas ? (
                        <button
                          type="button"
                          onClick={() => restaurar(c)}
                          disabled={eliminando === c.idInversionista}
                          title="Sacar de la papelera"
                          className="text-green-600 hover:text-green-800 disabled:opacity-40"
                          aria-label="Sacar de la papelera"
                        >
                          {eliminando === c.idInversionista ? '…' : '↩️'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => papelera(c)}
                          disabled={eliminando === c.idInversionista}
                          title="Mover a la papelera"
                          className="text-red-600 hover:text-red-800 disabled:opacity-40"
                          aria-label="Mover a la papelera"
                        >
                          {eliminando === c.idInversionista ? '…' : '🗑'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {etiquetasTipo(c).map((e) => (
                        <Badge key={e} color={COLOR_TIPO[e]}>
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  {COLUMNAS.map((col) => (
                    <td
                      key={col.campo}
                      className={`px-3 py-2 ${col.nowrap ? 'whitespace-nowrap' : ''} ${
                        col.ancho ? 'break-words' : ''
                      }`}
                      style={col.ancho ? { width: col.ancho, maxWidth: col.ancho } : undefined}
                    >
                      {col.valor(c) || '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Paginacion
        pagina={paginaSegura}
        totalPaginas={totalPaginas}
        total={ordenados.length}
        porPagina={POR_PAGINA}
        onCambio={setPagina}
      />

      {nuevo && (
        <ClienteSheet
          preset={presetNuevo}
          onClose={() => setNuevo(false)}
          onGuardado={refrescar}
          onAbrirExistente={abrirExistente}
        />
      )}
      {editar && (
        <ClienteSheet
          cliente={editar}
          onClose={() => setEditar(null)}
          onGuardado={refrescar}
        />
      )}

      {avisoDep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b bg-[#1f2a4d] px-5 py-3 text-white">
              <h2 className="text-base font-semibold">No se puede mandar a la papelera</h2>
              <button
                type="button"
                onClick={() => setAvisoDep(null)}
                className="text-white/80 hover:text-white"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <p className="text-gray-700">
                <span className="font-semibold">
                  {avisoDep.cliente.razonsocial ?? avisoDep.cliente.nombre ?? 'El cliente'}
                </span>{' '}
                todavía tiene recursos ligados. Desvincúlalos primero y vuelve a intentarlo:
              </p>
              <ul className="space-y-1">
                {avisoDep.deps.map((d) => (
                  <li
                    key={d.recurso}
                    className="flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <span className="font-medium text-amber-800">
                      {d.recurso} ({d.cantidad})
                    </span>
                    <span className="text-xs text-amber-700">Desligar en {d.modulo}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end border-t px-5 py-3">
              <button
                type="button"
                onClick={() => setAvisoDep(null)}
                className="rounded-lg bg-[#1f2a4d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2a376a]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
