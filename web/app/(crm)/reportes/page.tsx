import { redirect } from 'next/navigation';
import { ReportesListClient } from './reportes-list-client';
import { getReportes } from '@/lib/reportes/actions';

export default async function ReportesListPage() {
  try {
    // Cargar reportes desde Supabase (Server Component)
    const reportes = await getReportes();
    return <ReportesListClient initialReportes={reportes} />;
  } catch (error) {
    // Si el error es por falta de autenticación, redirigir al login
    if (error instanceof Error && error.message.includes('autenticado')) {
      redirect('/login');
    }
    throw error;
  }
}

export const metadata = {
  title: 'Mis Reportes - SPH CRM Ventas',
  description: 'Listado de reportes y dashboards del CRM Ventas SPH Bienes Raíces'
};
