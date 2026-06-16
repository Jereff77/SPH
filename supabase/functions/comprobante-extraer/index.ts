// =============================================================================
// Edge Function: comprobante-extraer  ·  Lectura de comprobantes con IA (v2)
// -----------------------------------------------------------------------------
// Proxy delgado a OpenRouter. Su ÚNICA razón de ser es custodiar el secreto
// OPENROUTER_API_KEY fuera del backend y del frontend (mismo patrón que las
// edges `soporte-chat` y `ia-chat`).
//
// Es el FALLBACK de la lectura de comprobantes de pago: el backend primero
// intenta un parser determinista local (`comprobantes.parser.ts`); solo cuando
// el formato no se reconoce, llama a esta función con el TEXTO ya extraído del
// PDF (nunca el PDF ni una URL pública) para que el modelo lo estructure.
//
// Contrato:
//   Entrada (POST, JSON):  { texto: string, model?: string }
//   Salida (JSON):         { datos: Record<string,string>, tokens: {entrada,salida} }
//
// Seguridad:
//   - La invoca el BACKEND con el service_role (verify_jwt del gateway valida el
//     token del proyecto). El backend ya autenticó al usuario (JwtAuthGuard) y
//     verificó el permiso de pago antes de llegar aquí.
//   - Esta función NO accede a datos de negocio ni escribe nada.
//
// Despliegue:
//   supabase functions deploy comprobante-extraer
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...   (si aún no está puesto)
// =============================================================================

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELO_DEFAULT = 'openai/gpt-4o-mini';

const SYSTEM_PROMPT = `Eres un experto en extracción de datos de comprobantes de transferencia/pago bancarios mexicanos.
Extrae la información del texto y devuélvela como un objeto JSON con EXACTAMENTE estas claves (todas de tipo string):
"TipoOperacion", "FechadeOperacion", "HoradeOperacion", "CuentaOrigen", "NombredelOrdenante", "CuentaDestino", "BancoDestino", "NombreBeneficiario", "Importe", "ConceptodePago", "Referencia", "NoAutorizacion", "ClaveRastreo".
Si desconoces el valor de una clave, déjala como cadena vacía "".

Reglas de formato (OBLIGATORIAS):
- Las fechas SIEMPRE en formato dd/mm/aaaa. Ejemplo: "11-Feb-2025" -> "11/02/2025".
- Los montos (Importe) solo con dígitos y punto decimal, SIN símbolo de moneda ni comas de miles. Ejemplo: "$4,556.24 MN" -> "4556.24".
- Responde ÚNICAMENTE con el JSON, sin texto adicional ni explicaciones.`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  // Cuerpo.
  let body: { texto?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const texto = (body.texto ?? '').trim();
  if (!texto) return json({ error: 'Falta el texto del comprobante' }, 400);
  const model = body.model || MODELO_DEFAULT;

  // OpenRouter.
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY ausente');
    return json({ error: 'OPENROUTER_API_KEY no configurada' }, 500);
  }

  let orRes: Response;
  try {
    orRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gruposph.mx',
        'X-Title': 'SPH ERP - Lector de comprobantes',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: texto },
        ],
      }),
    });
  } catch (e) {
    console.error('fetch OpenRouter falló:', String(e));
    return json({ error: `No se pudo contactar OpenRouter: ${String(e)}` }, 502);
  }

  if (!orRes.ok) {
    const detalle = await orRes.text();
    console.error('OpenRouter ERROR status=', orRes.status, 'detalle=', detalle);
    return json({ error: `OpenRouter ${orRes.status}`, detalle }, 502);
  }

  const data = await orRes.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(content);
  } catch {
    console.error('Respuesta del modelo no es JSON válido:', content);
    return json({ error: 'El modelo no devolvió JSON válido', content }, 502);
  }

  const tokens = {
    entrada: data?.usage?.prompt_tokens ?? null,
    salida: data?.usage?.completion_tokens ?? null,
  };
  return json({ datos, tokens });
});
