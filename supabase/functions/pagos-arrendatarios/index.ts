import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type',
};

function b64ToStr(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

Deno.serve(async (req) => {
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
    .select('contenido')
    .eq('nombre', 'pagos_arrendatarios')
    .single();

  if (error || !data) {
    return new Response(
      `Error al cargar el reporte: ${error?.message ?? 'sin datos'}`,
      { status: 500, headers: CORS }
    );
  }

  const html = b64ToStr(data.contenido)
    .replace("const USER_JWT = '';", `const USER_JWT = '${jwt}';`)
    .replace("const CURRENT_UID = '';", `const CURRENT_UID = '${uid}';`);

  return new Response(html, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
});
