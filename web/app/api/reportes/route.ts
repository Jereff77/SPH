import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, descripcion, visibilidad } = body;

    console.log('🔵 API /api/reportes - Inicio:', { nombre, visibilidad });

    // Crear cliente de Supabase con acceso a cookies
    const supabase = await createClient();
    console.log('🔵 Cliente Supabase creado');

    // Obtener usuario autenticado
    const { data: authData, error: authError } = await supabase.auth.getUser();
    console.log('🔵 Auth response:', {
      user: authData?.user ? 'EXISTS' : 'NULL',
      userId: authData?.user?.id || 'NO ID',
      authError: authError?.message || 'NONE'
    });

    // Verificar autenticación - regla de negocio
    if (authError || !authData?.user?.id) {
      console.error('❌ Usuario no autenticado intentando crear reporte:', {
        authError: authError?.message,
        hasUser: !!authData?.user,
        userId: authData?.user?.id
      });
      return NextResponse.json(
        { error: 'Debes estar autenticado para crear reportes' },
        { status: 401 }
      );
    }

    const user = authData.user;
    console.log('✅ Usuario autenticado:', user.id);

    console.log('📊 Insertando reporte:', { nombre, visibilidad, userId: user.id });

    const { data, error } = await supabase
      .from('crm_reports')
      .insert({
        nombre,
        descripcion: descripcion || '',
        visibilidad,
        creado_por: user.id // ✅ Garantizado no null por validación anterior
      })
      .select()
      .single();

    console.log('📍 Supabase response - error:', error);
    console.log('📍 Supabase response - data:', data);
    console.log('📍 Supabase response - data.id:', data?.id);

    if (error) {
      console.error('❌ Error insertando reporte:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data || !data.id) {
      console.error('❌ Reporte creado sin ID:', data);
      return NextResponse.json({ error: 'Reporte creado sin ID' }, { status: 500 });
    }

    console.log('✅ Reporte creado exitosamente, ID:', data.id);
    console.log('📦 Enviando respuesta al cliente:', JSON.stringify(data));
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error en API /api/reportes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
