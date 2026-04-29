import { NextResponse } from 'next/server';

/**
 * Endpoint de Health Check para EasyPanel
 * GET /api/health
 *
 * Verifica que el CRM Ventas esté funcionando correctamente
 * y que la configuración de Supabase esté presente.
 */
export async function GET() {
  try {
    // Verificar conexión con Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Missing Supabase configuration',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Health check exitoso
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'crm-ventas',
      version: '1.0.0',
      supabase: {
        configured: true,
        url: supabaseUrl.replace(/\/\/.*@/, '//***@'), // Ocultar credenciales
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
