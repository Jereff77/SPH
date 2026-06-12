// =============================================================================
// Edge Function: soporte-chat  ·  Agente de IA de Soporte (v2)
// -----------------------------------------------------------------------------
// Proxy delgado a OpenRouter. Su ÚNICA razón de ser es custodiar el secreto
// OPENROUTER_API_KEY fuera del backend y del bundle del frontend (igual que la
// edge `ia-chat` de Montse).
//
// Contrato:
//   Entrada (POST, JSON):  { messages: {role, content}[], model: string }
//     + headers: Authorization: Bearer <JWT del usuario>, apikey: <anon>
//   Salida (JSON):         { respuesta: string, tokens: { entrada, salida } }
//
// Seguridad:
//   - Verifica que el JWT del usuario sea válido (auth.getUser) antes de gastar.
//   - El prompt (system con la KB y el perfil) lo ARMA el backend; aquí solo se
//     reenvía a OpenRouter. Esta función NO accede a datos de negocio ni escribe.
//   - El agente solo informa: no hay herramientas de escritura.
//
// Despliegue:
//   supabase functions deploy soporte-chat
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface Mensaje {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELO_DEFAULT = 'openai/gpt-4o-mini';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  // 1) Autenticación: el JWT del usuario debe ser válido.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'No autenticado' }, 401);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401);
  } catch (_e) {
    return json({ error: 'No autenticado' }, 401);
  }

  // 2) Cuerpo.
  let body: { messages?: Mensaje[]; model?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return json({ error: 'Faltan mensajes' }, 400);
  const model = body.model || MODELO_DEFAULT;

  // 3) OpenRouter.
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY ausente');
    return json({ error: 'OPENROUTER_API_KEY no configurada' }, 500);
  }
  console.log('OpenRouter req model=', model, 'keyLen=', apiKey.length, 'msgs=', messages.length);

  let orRes: Response;
  try {
    orRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Atribución recomendada por OpenRouter (opcional).
        'HTTP-Referer': 'https://gruposph.mx',
        'X-Title': 'SPH ERP - Agente de Soporte',
      },
      body: JSON.stringify({ model, messages, temperature: 0.2 }),
    });
  } catch (e) {
    console.error('fetch OpenRouter fallo:', String(e));
    return json({ error: `No se pudo contactar OpenRouter: ${String(e)}` }, 502);
  }

  if (!orRes.ok) {
    const detalle = await orRes.text();
    console.error('OpenRouter ERROR status=', orRes.status, 'detalle=', detalle);
    return json({ error: `OpenRouter ${orRes.status}`, detalle }, 502);
  }

  const data = await orRes.json();
  const respuesta: string =
    data?.choices?.[0]?.message?.content ?? 'No obtuve respuesta del modelo.';
  const tokens = {
    entrada: data?.usage?.prompt_tokens ?? null,
    salida: data?.usage?.completion_tokens ?? null,
  };

  return json({ respuesta, tokens });
});
