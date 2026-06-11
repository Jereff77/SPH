import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import {
  SortableTh,
  THEAD_STICKY,
  THEAD_TR,
} from '@/components/tabla/SortableTh';
import { useSort } from '@/components/tabla/useSort';
import { cronApi, duracion, fechaHora } from './cron.api';
import type { CronJobBd, TareaBackend } from './types';

/** Etiqueta de estado con color (éxito/error/corriendo/otros). */
function EstadoBadge({ estado }: { estado: string | null }) {
  const e = (estado ?? '').toLowerCase();
  const exito = e === 'succeeded' || e === 'exito' || e === 'success';
  const error = e === 'failed' || e === 'error';
  const corriendo = e === 'running' || e === 'starting' || e === 'sending';
  const cls = exito
    ? 'bg-green-100 text-green-800'
    : error
      ? 'bg-red-100 text-red-800'
      : corriendo
        ? 'bg-blue-100 text-blue-800'
        : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {estado ?? '—'}
    </span>
  );
}

export function CronPage() {
  const { esSoporte } = useAuth();

  if (!esSoporte) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Esta sección está restringida al personal de soporte.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Cron — Tareas programadas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitoreo de las tareas automáticas del sistema y su historial de
          ejecuciones. Solo visible para soporte.
        </p>
      </header>

      <SeccionPgCron />
      <SeccionBackend />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sección 1: pg_cron (tareas en la base de datos)
// ---------------------------------------------------------------------------

function SeccionPgCron() {
  const [expandido, setExpandido] = useState<number | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['cron', 'jobs'],
    queryFn: cronApi.jobs,
    staleTime: 30_000,
  });

  const accessors = {
    jobname: (j: CronJobBd) => j.jobname,
    schedule: (j: CronJobBd) => j.schedule,
    active: (j: CronJobBd) => j.active,
    ultima: (j: CronJobBd) => j.ultimaEjecucion,
    estado: (j: CronJobBd) => j.ultimoEstado,
    total: (j: CronJobBd) => j.totalEjecuciones,
  };
  const { ordenados, sortKey, dir, toggle } = useSort(data ?? [], accessors, {
    key: 'jobname',
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Tareas de base de datos (pg_cron)
          </h2>
          <p className="text-xs text-gray-500">
            Jobs programados en Supabase. Historial real de ejecuciones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-red-600">No se pudieron cargar los jobs.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-gray-200 max-h-[60vh]">
          <table className="min-w-full text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={THEAD_TR}>
                <SortableTh campo="jobname" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Tarea
                </SortableTh>
                <SortableTh campo="schedule" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Programación
                </SortableTh>
                <SortableTh campo="active" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                  Activo
                </SortableTh>
                <SortableTh campo="ultima" sortKey={sortKey} dir={dir} onSort={toggle}>
                  Última ejecución
                </SortableTh>
                <SortableTh campo="estado" sortKey={sortKey} dir={dir} onSort={toggle} align="center">
                  Estado
                </SortableTh>
                <SortableTh campo="total" sortKey={sortKey} dir={dir} onSort={toggle} align="right">
                  Ejecuciones
                </SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenados.map((j) => (
                <FilasJobBd
                  key={j.jobid}
                  job={j}
                  abierto={expandido === j.jobid}
                  onToggle={() =>
                    setExpandido((id) => (id === j.jobid ? null : j.jobid))
                  }
                />
              ))}
              {ordenados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No hay jobs programados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FilasJobBd({
  job,
  abierto,
  onToggle,
}: {
  job: CronJobBd;
  abierto: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
        title="Ver historial de ejecuciones"
      >
        <td className="px-4 py-2.5 font-medium text-gray-900">
          <span className="mr-2 inline-block text-gray-400">
            {abierto ? '▾' : '▸'}
          </span>
          {job.jobname}
        </td>
        <td className="px-4 py-2.5">
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            {job.schedule}
          </code>
        </td>
        <td className="px-4 py-2.5 text-center">
          {job.active ? (
            <span className="text-green-600">●</span>
          ) : (
            <span className="text-gray-300">●</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-gray-700">{fechaHora(job.ultimaEjecucion)}</td>
        <td className="px-4 py-2.5 text-center">
          <EstadoBadge estado={job.ultimoEstado} />
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
          {job.totalEjecuciones}
        </td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-4 py-3">
            <HistorialJobBd jobid={job.jobid} />
          </td>
        </tr>
      )}
    </>
  );
}

function HistorialJobBd({ jobid }: { jobid: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cron', 'jobs', jobid, 'ejecuciones'],
    queryFn: () => cronApi.ejecucionesJob(jobid, 50),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-sm text-gray-500">Cargando historial…</p>;
  if (isError) return <p className="text-sm text-red-600">No se pudo cargar el historial.</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-gray-500">Sin ejecuciones registradas.</p>;

  return (
    <div className="overflow-auto rounded border border-gray-200 bg-white max-h-72">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-100 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2">Inicio</th>
            <th className="px-3 py-2">Fin</th>
            <th className="px-3 py-2">Duración</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Mensaje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((r) => (
            <tr key={r.runid}>
              <td className="whitespace-nowrap px-3 py-1.5">{fechaHora(r.startTime)}</td>
              <td className="whitespace-nowrap px-3 py-1.5">{fechaHora(r.endTime)}</td>
              <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                {duracion(r.duracionMs)}
              </td>
              <td className="px-3 py-1.5">
                <EstadoBadge estado={r.status} />
              </td>
              <td className="px-3 py-1.5 text-gray-600">{r.returnMessage ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sección 2: schedulers NestJS (tareas del backend)
// ---------------------------------------------------------------------------

function SeccionBackend() {
  const [expandido, setExpandido] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['cron', 'backend'],
    queryFn: cronApi.backend,
    staleTime: 15_000,
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Tareas del backend (NestJS)
          </h2>
          <p className="text-xs text-gray-500">
            Procesos programados dentro del servidor. Puedes dispararlos manualmente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-red-600">No se pudieron cargar las tareas.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-gray-200 max-h-[60vh]">
          <table className="min-w-full text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={THEAD_TR}>
                <th className="px-4 py-3 text-left">Tarea</th>
                <th className="px-4 py-3 text-left">Programación</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Próxima</th>
                <th className="px-4 py-3 text-left">Última (en memoria)</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data ?? []).map((t) => (
                <FilasTareaBackend
                  key={t.nombre}
                  tarea={t}
                  abierto={expandido === t.nombre}
                  onToggle={() =>
                    setExpandido((n) => (n === t.nombre ? null : t.nombre))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FilasTareaBackend({
  tarea,
  abierto,
  onToggle,
}: {
  tarea: TareaBackend;
  abierto: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const ejecutar = useMutation({
    mutationFn: () => cronApi.ejecutar(tarea.nombre),
    onSuccess: () => {
      setMensaje('Ejecutada correctamente.');
      qc.invalidateQueries({ queryKey: ['cron', 'backend'] });
      qc.invalidateQueries({
        queryKey: ['cron', 'backend', tarea.nombre, 'ejecuciones'],
      });
    },
    onError: (e: unknown) => {
      setMensaje(`Error: ${(e as Error).message}`);
    },
  });

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-start gap-2 text-left"
            title="Ver historial de ejecuciones"
          >
            <span className="mt-0.5 text-gray-400">{abierto ? '▾' : '▸'}</span>
            <span>
              <span className="font-medium text-gray-900">{tarea.etiqueta}</span>
              <span className="block text-xs text-gray-500">{tarea.descripcion}</span>
            </span>
          </button>
        </td>
        <td className="px-4 py-2.5">
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            {tarea.expresion ?? '—'}
          </code>
        </td>
        <td className="px-4 py-2.5 text-center">
          {!tarea.activa ? (
            <EstadoBadge estado="inactiva" />
          ) : tarea.corriendo ? (
            <EstadoBadge estado="running" />
          ) : (
            <EstadoBadge estado="exito" />
          )}
        </td>
        <td className="px-4 py-2.5 text-gray-700">{fechaHora(tarea.proximaEjecucion)}</td>
        <td className="px-4 py-2.5 text-gray-700">
          {fechaHora(tarea.ultimaEjecucionMemoria)}
        </td>
        <td className="px-4 py-2.5 text-right">
          <button
            type="button"
            disabled={ejecutar.isPending || !tarea.manualDisponible}
            onClick={() => {
              setMensaje(null);
              ejecutar.mutate();
            }}
            className="rounded-md bg-[#1f2a4d] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2a386a] disabled:opacity-50"
          >
            {ejecutar.isPending ? 'Ejecutando…' : 'Ejecutar ahora'}
          </button>
          {mensaje && (
            <span
              className={`ml-2 text-xs ${
                mensaje.startsWith('Error') ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {mensaje}
            </span>
          )}
        </td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-4 py-3">
            <HistorialBackend tarea={tarea.nombre} />
          </td>
        </tr>
      )}
    </>
  );
}

function HistorialBackend({ tarea }: { tarea: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cron', 'backend', tarea, 'ejecuciones'],
    queryFn: () => cronApi.ejecucionesBackend(tarea, 50),
    staleTime: 15_000,
  });

  if (isLoading) return <p className="text-sm text-gray-500">Cargando historial…</p>;
  if (isError) return <p className="text-sm text-red-600">No se pudo cargar el historial.</p>;
  if (!data || data.length === 0)
    return <p className="text-sm text-gray-500">Sin ejecuciones registradas todavía.</p>;

  return (
    <div className="overflow-auto rounded border border-gray-200 bg-white max-h-72">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-100 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2">Inicio</th>
            <th className="px-3 py-2">Origen</th>
            <th className="px-3 py-2">Duración</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Mensaje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-1.5">{fechaHora(r.inicio)}</td>
              <td className="px-3 py-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    r.origen === 'manual'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {r.origen}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                {duracion(r.duracionMs)}
              </td>
              <td className="px-3 py-1.5">
                <EstadoBadge estado={r.estado} />
              </td>
              <td className="px-3 py-1.5 text-gray-600">{r.mensaje ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
