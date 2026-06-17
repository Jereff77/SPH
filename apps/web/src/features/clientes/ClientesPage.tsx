import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clientesApi,
  CHIPS,
  type Cliente,
  type ClienteInput,
  type TipoCliente,
} from './clientes.api';
import { ClienteModal } from './ClienteModal';
import { SortableTh, THEAD_STICKY, THEAD_TR } from '@/components/tabla/SortableTh';
import { useSort, type Accessors } from '@/components/tabla/useSort';
import { FiltroColumnaOpciones } from '@/components/tabla/FiltroColumnaOpciones';

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

const ACCESSORS: Accessors<Cliente> = {
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

/** Banderas de tipo preseleccionadas al crear, según el chip activo. */
const PRESET: Record<TipoCliente, Partial<ClienteInput>> = {
  inversionistas: { inversionista: true },
  arrendatarios: { arrendatario: true },
  ticket: { ticket: true },
  usuarioFinal: { usuarioFinal: true },
  papelera: {},
};

export function ClientesPage() {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoCliente>('inversionistas');
  const [busca, setBusca] = useState('');
  const [editar, setEditar] = useState<Cliente | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [persSel, setPersSel] = useState<Set<string>>(new Set());

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes', tipo],
    queryFn: () => clientesApi.listar(tipo),
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['clientes'] });

  const optPers = useMemo(
    () =>
      [...new Set(clientes.map((c) => c.personalidad ?? '').filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true }),
      ),
    [clientes],
  );

  const filtrados = useMemo(() => {
    const q = norm(busca.trim());
    return clientes.filter((c) => {
      if (persSel.size > 0 && !persSel.has(c.personalidad ?? '')) return false;
      if (!q) return true;
      return [c.razonsocial, c.nombre, c.apellido1, c.apellido2, c.RFC, c.CURP, c.correo, c.telefono]
        .filter(Boolean)
        .some((v) => norm(String(v)).includes(q));
    });
  }, [clientes, busca, persSel]);

  const { ordenados, sortKey, dir, toggle } = useSort(filtrados, ACCESSORS, {
    key: 'razonsocial',
    dir: 'asc',
  });

  async function papelera(c: Cliente) {
    if (!window.confirm(`¿Mover a la papelera a "${c.razonsocial ?? c.nombre ?? ''}"?`)) return;
    setEliminando(c.idInversionista);
    try {
      await clientesApi.moverPapelera(c.idInversionista);
      await refrescar();
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

      {/* Chips + buscador */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setTipo(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                tipo === c.id
                  ? 'border-[#1f2a4d] bg-[#1f2a4d] text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nombre, razón social, RFC…"
          className="w-72 rounded border px-2 py-1.5 text-sm"
        />
        <span className="text-xs text-gray-400">{ordenados.length} registros</span>
      </div>

      <div className="overflow-auto rounded-xl border bg-white" style={{ maxHeight: '64vh' }}>
        <table className="min-w-full border-collapse text-sm">
          <thead className={THEAD_STICKY}>
            <tr className={THEAD_TR}>
              <th className="px-3 py-3 text-center">Opciones</th>
              <SortableTh
                campo="personalidad"
                sortKey={sortKey}
                dir={dir}
                onSort={toggle}
                filtro={
                  <FiltroColumnaOpciones
                    etiqueta="Personalidad"
                    opciones={optPers}
                    seleccion={persSel}
                    onChange={setPersSel}
                  />
                }
              >
                Personalidad
              </SortableTh>
              <SortableTh campo="idContpac" sortKey={sortKey} dir={dir} onSort={toggle}>
                idContpac
              </SortableTh>
              <SortableTh campo="razonsocial" sortKey={sortKey} dir={dir} onSort={toggle}>
                Razón Social
              </SortableTh>
              <SortableTh campo="nombre" sortKey={sortKey} dir={dir} onSort={toggle}>
                Nombre
              </SortableTh>
              <SortableTh campo="apellido1" sortKey={sortKey} dir={dir} onSort={toggle}>
                Apellido 1
              </SortableTh>
              <SortableTh campo="apellido2" sortKey={sortKey} dir={dir} onSort={toggle}>
                Apellido 2
              </SortableTh>
              <SortableTh campo="fecNacimiento" sortKey={sortKey} dir={dir} onSort={toggle}>
                Fecha nac.
              </SortableTh>
              <SortableTh campo="telefono" sortKey={sortKey} dir={dir} onSort={toggle}>
                Teléfono
              </SortableTh>
              <SortableTh campo="correo" sortKey={sortKey} dir={dir} onSort={toggle}>
                Correo
              </SortableTh>
              <SortableTh campo="rfc" sortKey={sortKey} dir={dir} onSort={toggle}>
                RFC
              </SortableTh>
              <SortableTh campo="curp" sortKey={sortKey} dir={dir} onSort={toggle}>
                CURP
              </SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : ordenados.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-400">
                  Sin clientes en esta vista.
                </td>
              </tr>
            ) : (
              ordenados.map((c) => (
                <tr key={c.idInversionista} className="hover:bg-gray-50">
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
                    </div>
                  </td>
                  <td className="px-3 py-2">{c.personalidad ?? '—'}</td>
                  <td className="px-3 py-2">{c.idContpac || '—'}</td>
                  <td className="px-3 py-2">{c.razonsocial ?? '—'}</td>
                  <td className="px-3 py-2">{c.nombre ?? '—'}</td>
                  <td className="px-3 py-2">{c.apellido1 || '—'}</td>
                  <td className="px-3 py-2">{c.apellido2 || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fechaCorta(c.fecNacimiento)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{c.telefono || '—'}</td>
                  <td className="px-3 py-2">{c.correo ?? '—'}</td>
                  <td className="px-3 py-2">{c.RFC || '—'}</td>
                  <td className="px-3 py-2">{c.CURP || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {nuevo && (
        <ClienteModal
          preset={PRESET[tipo]}
          onClose={() => setNuevo(false)}
          onGuardado={refrescar}
        />
      )}
      {editar && (
        <ClienteModal
          cliente={editar}
          onClose={() => setEditar(null)}
          onGuardado={refrescar}
        />
      )}
    </div>
  );
}
