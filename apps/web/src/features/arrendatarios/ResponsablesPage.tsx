import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { incrementosApi } from './incrementos.api';
import { ApiRequestError } from '@/lib/api';

const QKEY = ['arre-responsables'];

/**
 * Arrendatarios · Responsables (permiso 212). Asigna la gerente del módulo y
 * los responsables de cada parque: son los destinatarios del correo de
 * incrementos de renta por INPC (cada responsable recibe sus parques; la
 * gerente recibe todo y cubre los parques sin responsable). Solo usuarios
 * activos con correo son asignables (el backend lo revalida).
 */
export function ResponsablesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [gerenteSel, setGerenteSel] = useState('');
  const [agregandoEn, setAgregandoEn] = useState<string | null>(null);
  const [usuarioSel, setUsuarioSel] = useState('');

  const { data, isLoading } = useQuery({ queryKey: QKEY, queryFn: () => incrementosApi.responsables() });
  const { data: usuarios = [] } = useQuery({
    queryKey: ['arre-responsables-usuarios'],
    queryFn: () => incrementosApi.usuariosElegibles(),
  });

  const invalidar = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: QKEY });
  };
  const onError = (e: unknown) =>
    setError(e instanceof ApiRequestError ? e.message : 'Ocurrió un error.');

  const setGerente = useMutation({
    mutationFn: (uid: string | null) => incrementosApi.setGerente(uid),
    onSuccess: () => {
      setGerenteSel('');
      invalidar();
    },
    onError,
  });
  const agregar = useMutation({
    mutationFn: (v: { idParque: string; uid: string }) =>
      incrementosApi.agregarResponsable(v.idParque, v.uid),
    onSuccess: () => {
      setAgregandoEn(null);
      setUsuarioSel('');
      invalidar();
    },
    onError,
  });
  const quitar = useMutation({
    mutationFn: (id: string) => incrementosApi.quitarResponsable(id),
    onSuccess: invalidar,
    onError,
  });

  const selectCls =
    'rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3f5b87]/30';

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1f2a4d]">Arrendatarios · Responsables</h1>
        <p className="mt-1 text-sm text-gray-500">
          Destinatarios del correo de incrementos de renta (INPC): cada responsable recibe los
          planes de sus parques; la gerente recibe todos y cubre los parques sin responsable.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* ===================== Gerente del módulo ===================== */}
      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Gerente de Arrendatarios</h2>
        {data?.gerente ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                data.gerente.valido ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-700'
              }`}
            >
              👤 {data.gerente.nombre}
              <span className="text-xs opacity-70">{data.gerente.email ?? 'sin correo'}</span>
              {!data.gerente.valido && (
                <span className="text-xs font-semibold">⚠️ inactivo o sin correo — reemplázala</span>
              )}
            </span>
            <button
              onClick={() => setGerente.mutate(null)}
              disabled={setGerente.isPending}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Quitar
            </button>
          </div>
        ) : (
          <p className="mb-2 text-sm text-amber-700">
            ⚠️ Sin gerente asignada: los incrementos de parques sin responsable no se notificarán a
            nadie.
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <select
            value={gerenteSel}
            onChange={(e) => setGerenteSel(e.target.value)}
            className={selectCls}
          >
            <option value="">— Seleccionar usuario —</option>
            {usuarios.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.nomCompleto ?? u.uid} ({u.email})
              </option>
            ))}
          </select>
          <button
            onClick={() => gerenteSel && setGerente.mutate(gerenteSel)}
            disabled={!gerenteSel || setGerente.isPending}
            className="rounded-lg bg-[#1f2a4d] px-3 py-2 text-sm font-medium text-white hover:bg-[#172039] disabled:opacity-50"
          >
            {data?.gerente ? 'Cambiar gerente' : 'Asignar gerente'}
          </button>
        </div>
      </section>

      {/* ===================== Responsables por parque ===================== */}
      <section className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Responsables por parque</h2>
          {data && data.parquesSinResponsable > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              ⚠️ {data.parquesSinResponsable} parque(s) sin responsable (los cubre la gerente)
            </span>
          )}
        </div>
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Cargando…</p>
        ) : (
          <ul className="divide-y">
            {data?.parques.map((p) => (
              <li key={p.idParque} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="w-40 shrink-0 text-sm font-medium text-gray-800">
                  {p.nomParque}
                </span>
                {p.responsables.map((r) => (
                  <span
                    key={r.id}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                      r.valido ? 'bg-gray-100 text-gray-700' : 'bg-red-50 text-red-700'
                    }`}
                    title={r.email ?? 'sin correo'}
                  >
                    {r.nombre}
                    {!r.valido && <span title="Inactivo o sin correo">⚠️</span>}
                    <button
                      onClick={() => quitar.mutate(r.id)}
                      disabled={quitar.isPending}
                      className="ml-0.5 font-bold text-gray-400 hover:text-red-600"
                      aria-label={`Quitar a ${r.nombre}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {agregandoEn === p.idParque ? (
                  <span className="inline-flex items-center gap-2">
                    <select
                      value={usuarioSel}
                      onChange={(e) => setUsuarioSel(e.target.value)}
                      className={`${selectCls} py-1 text-xs`}
                      autoFocus
                    >
                      <option value="">— Usuario —</option>
                      {usuarios
                        .filter((u) => !p.responsables.some((r) => r.uid === u.uid))
                        .map((u) => (
                          <option key={u.uid} value={u.uid}>
                            {u.nomCompleto ?? u.uid}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() =>
                        usuarioSel && agregar.mutate({ idParque: p.idParque, uid: usuarioSel })
                      }
                      disabled={!usuarioSel || agregar.isPending}
                      className="rounded-lg bg-[#1f2a4d] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Agregar
                    </button>
                    <button
                      onClick={() => {
                        setAgregandoEn(null);
                        setUsuarioSel('');
                      }}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setAgregandoEn(p.idParque);
                      setUsuarioSel('');
                    }}
                    className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500 hover:border-[#3f5b87] hover:text-[#3f5b87]"
                  >
                    + Agregar responsable
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
