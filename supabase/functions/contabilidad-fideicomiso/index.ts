import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type',
};

const CONECTOR = `'; const SUPABASE_KEY = (USER_JWT && USER_JWT.startsWith('eyJ')) ? USER_JWT : SUPABASE_ANON_KEY; const CURRENT_UID = '`;

function b64ToStr(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!jwt.startsWith('eyJ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  let uid = '';
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    uid = payload.sub || '';
  } catch (_) {}

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);

  const { data, error } = await sb
    .from('reporte_html_parts')
    .select('nombre, contenido')
    .in('nombre', ['contabilidad_parte1', 'contabilidad_parte3']);

  if (error || !data || data.length < 2) {
    return new Response(`Error al cargar partes del reporte: ${error?.message ?? 'sin datos'}`, { status: 500, headers: CORS });
  }

  const parte1b64 = data.find((r: { nombre: string; contenido: string }) => r.nombre === 'contabilidad_parte1')?.contenido ?? '';
  const parte3b64 = data.find((r: { nombre: string; contenido: string }) => r.nombre === 'contabilidad_parte3')?.contenido ?? '';

  const html = b64ToStr(parte1b64) + jwt + CONECTOR + uid + b64ToStr(parte3b64);

  return new Response(html, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
});
