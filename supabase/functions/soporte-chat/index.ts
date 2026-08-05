// =============================================================================
// Edge Function: soporte-chat  ·  Agente de IA de Soporte (v2)
// -----------------------------------------------------------------------------
// Proxy delgado a OpenRouter. Su ÚNICA razón de ser es custodiar el secreto
// OPENROUTER_API_KEY fuera del backend y del bundle del frontend (igual que la
// edge `ia-chat` de Montse).
//
// Contrato:
//   Entrada (POST, JSON):  { messages: any[], model: string, tools?: any[] }
//     + headers: Authorization: Bearer <JWT del usuario>, apikey: <anon>
//   Salida (JSON):         { respuesta: string, message: {...}, tokens: { entrada, salida } }
//     - `message` es el mensaje crudo del modelo (incluye `tool_calls` cuando el
//       modelo decide llamar una herramienta de diagnóstico). El TOOL-LOOP (ejecutar
//       la herramienta y reenviar el resultado) vive en el BACKEND, que es quien
//       tiene acceso a datos, RBAC y auditoría. Esta función solo reenvía a OpenRouter.
//
// Seguridad:
//   - Verifica que el JWT del usuario sea válido (auth.getUser) antes de gastar.
//   - El prompt (system con la KB y el perfil) lo ARMA el backend; aquí solo se
//     reenvía a OpenRouter. Esta función NO accede a datos de negocio ni escribe.
//   - Las herramientas son de SOLO LECTURA y se EJECUTAN en el backend, no aquí.
//
// Despliegue:
//   supabase functions deploy soporte-chat
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

// El backend puede enviar mensajes con roles assistant/tool y `tool_calls`; aquí se
// reenvían tal cual a OpenRouter (no se inspeccionan).
type Mensaje = Record<string, unknown>;

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
  let body: { messages?: Mensaje[]; model?: string; tools?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return json({ error: 'Faltan mensajes' }, 400);
  const model = body.model || MODELO_DEFAULT;
  const tools = Array.isArray(body.tools) ? body.tools : undefined;

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
      body: JSON.stringify({
        model,
        messages,
        // ⚠️ Sin `temperature` (ni otros sampling params): los modelos nuevos
        // (Sonnet 5 / familia Opus 4.7+) los RECHAZAN con 400 → era la causa del 502.
        // El modelo usa su default, suficiente para soporte. Alineado con `ia-chat`.
        // `max_tokens` acotado: sin él, OpenRouter RESERVA el máximo del modelo
        // (65k en Sonnet 5) contra el saldo y devuelve 402 con crédito bajo,
        // aunque la respuesta real cueste centavos. 4096 sobra para soporte.
        max_tokens: 4096,
        ...(tools ? { tools, tool_choice: 'auto' } : {}),
      }),
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
  const message = data?.choices?.[0]?.message ?? null;
  const respuesta: string = message?.content ?? 'No obtuve respuesta del modelo.';
  const tokens = {
    entrada: data?.usage?.prompt_tokens ?? null,
    salida: data?.usage?.completion_tokens ?? null,
  };

  // `message` se devuelve completo para que el backend lea `tool_calls` y orqueste
  // el tool-loop; `respuesta` se conserva por compatibilidad.
  return json({ respuesta, message, tokens });
});
