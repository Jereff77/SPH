import { notFound, redirect } from 'next/navigation';
import { getReporteById } from '@/lib/reportes/actions';
import { ReportePageClient } from './reporte-page-client';

interface ReportePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ReportePage({ params }: ReportePageProps) {
  const { id } = await params;

  try {
    // Cargar reporte y widgets desde Supabase
    const { reporte, widgets } = await getReporteById(id);

    return <ReportePageClient reporte={reporte} widgets={widgets} />;
  } catch (error) {
    console.error('Error cargando reporte:', error);

    // Si el error es por falta de autenticación, redirigir al login
    if (error instanceof Error && error.message.includes('autenticado')) {
      redirect('/login');
    }

    // Si el error es por permisos, mostrar 404
    if (error instanceof Error && error.message.includes('permiso')) {
      return notFound();
    }

    return notFound();
  }
}

export const metadata = {
  title: 'Report Studio - SPH CRM Ventas',
  description: 'Constructor de reportes y dashboards para el CRM Ventas SPH Bienes Raíces'
};
