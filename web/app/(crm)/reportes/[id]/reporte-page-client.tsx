'use client';

import React from 'react';
import { ReportStudio } from '@/components/reportes/studio/report-studio';
import { useReportStudioStore } from '@/lib/reportes/studio-store';

interface ReportePageClientProps {
  reporte: any;
  widgets: any[];
}

export function ReportePageClient({ reporte, widgets }: ReportePageClientProps) {
  const initializeFromSupabase = useReportStudioStore((s) => s.initializeFromSupabase);

  // Inicializar store con datos de Supabase (solo una vez)
  React.useEffect(() => {
    initializeFromSupabase(reporte, widgets);
  }, [reporte, widgets, initializeFromSupabase]);

  return (
    <div
      style={{
        height: '100%',  // ✅ Usar 100% porque el padre (layout.tsx) ya tiene h-screen
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <ReportStudio />
    </div>
  );
}
