import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fideicomisoApi, type DispersionPlanFila, type DispersionResumen } from './fideicomiso.api';
import { moneda } from './format';

const num = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ahoraMX(): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
}

function sanitiza(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_');
}

/** Rendimiento Anual $ = monto × (tasa / 100). */
const rendAnual = (f: DispersionPlanFila) => (f.monto_pago ?? 0) * ((f.tasa_rendimiento ?? 0) / 100);

/**
 * Desglose Detallado de una adhesión en un periodo (réplica de la pantalla del
 * WebView de v1). Tabla por pago + Resumen Total, con exportación a **PNG**
 * (imagen idéntica al contenido, sin los botones) y a **CSV**.
 */
export function DesgloseModal({
  idFide,
  noAdhesion,
  noDispersion,
  razonSocial,
  fideicomisoTitulo,
  periodoLabel,
  onClose,
}: {
  idFide: string;
  noAdhesion: string;
  noDispersion: string;
  razonSocial: string;
  fideicomisoTitulo: string;
  periodoLabel: string;
  onClose: () => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [genPng, setGenPng] = useState(false);
  const generado = useMemo(() => ahoraMX(), []);

  const { data: detalle = [], isLoading } = useQuery({
    queryKey: ['fide-desglose-plan', idFide, noAdhesion, noDispersion],
    queryFn: () => fideicomisoApi.dispersionPlan(idFide, noAdhesion, noDispersion),
  });
  const { data: resumenArr = [] } = useQuery({
    queryKey: ['fide-desglose-resumen', idFide, noAdhesion, noDispersion],
    queryFn: () => fideicomisoApi.dispersionResumenAdhesion(idFide, noAdhesion, noDispersion),
  });
  const resumen: DispersionResumen | undefined = resumenArr[0];

  // Totales: del RPC de resumen si está; si no, suma del detalle.
  const totales = useMemo(() => {
    if (resumen) {
      return {
        inversion: resumen.monto_total_pagos ?? 0,
        renta: resumen.rendimiento_bruto_total ?? 0,
        retencion: resumen.retencion_isr_total ?? 0,
        dispersion: resumen.dispersion_neta_total ?? 0,
      };
    }
    return detalle.reduce(
      (a, f) => {
        a.inversion += f.monto_pago ?? 0;
        a.renta += f.rendimiento_bruto ?? 0;
        a.retencion += f.retencion_isr ?? 0;
        a.dispersion += f.dispersion_neta ?? 0;
        return a;
      },
      { inversion: 0, renta: 0, retencion: 0, dispersion: 0 },
    );
  }, [resumen, detalle]);

  async function descargarPNG() {
    if (!captureRef.current) return;
    setGenPng(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(captureRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `desglose-${sanitiza(razonSocial)}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      window.alert('No se pudo generar la imagen. Intenta nuevamente.');
    } finally {
      setGenPng(false);
    }
  }

  function descargarCSV() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let csv = '';
    csv += `${esc(razonSocial)}\n`;
    csv += `${esc(fideicomisoTitulo)}\n`;
    csv += `${esc('Período: ' + periodoLabel)}\n`;
    csv += `${esc('No. Adhesión: ' + noAdhesion)}\n`;
    csv += `${esc('Generado: ' + generado)}\n\n`;
    csv += [
      'Monto Inversión', 'Fecha Pago', 'Días Efectivos', 'Rendimiento Anual %',
      'Rendimiento Anual $', 'Renta del Trimestre', 'Retención de ISR', 'Dispersión Trimestral',
    ].map(esc).join(',') + '\n';
    for (const f of detalle) {
      csv += [
        f.monto_pago, f.fecha_pago, f.dias_periodo, (f.tasa_rendimiento ?? 0).toFixed(2),
        num(rendAnual(f)), num(f.rendimiento_bruto), num(f.retencion_isr), num(f.dispersion_neta),
      ].map(esc).join(',') + '\n';
    }
    csv += '\n' + esc('RESUMEN TOTALES') + '\n';
    csv += `${esc('Total Inversión')},${esc(num(totales.inversion))}\n`;
    csv += `${esc('Total Renta')},${esc(num(totales.renta))}\n`;
    csv += `${esc('Total Retención')},${esc(num(totales.retencion))}\n`;
    csv += `${esc('Total Dispersión')},${esc(num(totales.dispersion))}\n`;

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `desglose-${sanitiza(razonSocial)}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 bg-[#1f2a4d] px-5 py-3 text-white">
          <h2 className="truncate text-base font-semibold">Desglose Detallado - {razonSocial}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={descargarPNG} disabled={genPng}
              className="rounded-lg bg-[#4299e1] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {genPng ? '⏳ Generando…' : '🖼️ Descargar PNG'}
            </button>
            <button onClick={descargarCSV}
              className="rounded-lg bg-[#48bb78] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
              📊 Descargar CSV
            </button>
            <button onClick={onClose} className="px-1 text-2xl leading-none text-white/80 hover:text-white" aria-label="Cerrar">×</button>
          </div>
        </div>

        <div className="overflow-auto p-5">
          {/* Área capturable (sin botones) */}
          <div ref={captureRef} className="bg-white p-5">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-800">Desglose Detallado - {razonSocial}</div>
              <div className="mt-1 text-sm text-gray-500">{fideicomisoTitulo} - {periodoLabel}</div>
            </div>
            <div className="mt-2 border-t pt-2 text-right text-xs text-gray-400">Generado el: {generado}</div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 text-left">Monto Inversión</th>
                    <th className="px-3 py-2 text-center">Fecha Pago</th>
                    <th className="px-3 py-2 text-center">Días Efectivos</th>
                    <th className="px-3 py-2 text-center">Rendimiento Anual %</th>
                    <th className="px-3 py-2 text-center">Rendimiento Anual $</th>
                    <th className="px-3 py-2 text-center">Renta del Trimestre</th>
                    <th className="px-3 py-2 text-center">Retención de ISR</th>
                    <th className="px-3 py-2 text-center">Dispersión Trimestral</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Cargando desglose…</td></tr>
                  ) : detalle.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Sin datos para este periodo.</td></tr>
                  ) : (
                    detalle.map((f, i) => (
                      <tr key={i} className="text-[#3f5b87]">
                        <td className="px-3 py-2 text-left tabular-nums">{moneda(f.monto_pago)}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{f.fecha_pago}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{f.dias_periodo}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{(f.tasa_rendimiento ?? 0).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneda(rendAnual(f))}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneda(f.rendimiento_bruto)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneda(f.retencion_isr)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{moneda(f.dispersion_neta)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumen Total */}
            <div className="mt-5 rounded-lg bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">Resumen Total</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tarjeta label="Total Inversión" valor={moneda(totales.inversion)} />
                <Tarjeta label="Total Renta" valor={moneda(totales.renta)} />
                <Tarjeta label="Total Retención" valor={moneda(totales.retencion)} />
                <Tarjeta label="Total Dispersión" valor={moneda(totales.dispersion)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tarjeta({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border-l-4 border-[#1f2a4d] bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-gray-800 tabular-nums">{valor}</div>
    </div>
  );
}
