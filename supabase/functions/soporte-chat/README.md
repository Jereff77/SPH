# Edge Function: `soporte-chat`

Proxy delgado a **OpenRouter** para el **Agente de IA de Soporte** (v2). Su única
responsabilidad es custodiar el secreto `OPENROUTER_API_KEY` fuera del backend y
del frontend (mismo patrón que la edge `ia-chat` de Montse AI).

## Qué hace
1. Verifica el **JWT del usuario** (`auth.getUser`) — no gasta tokens sin sesión válida.
2. Reenvía los `messages` (system + historial + pregunta, **armados por el backend**)
   a OpenRouter con el `model` indicado.
3. Devuelve `{ respuesta, tokens: { entrada, salida } }`.

No accede a datos de negocio ni escribe nada: el agente **solo informa**. El
contexto (KB + perfil del usuario) lo arma el backend (`SoporteService`), que
además persiste la conversación con escrituras controladas y auditadas.

## Despliegue
```bash
# Desde version2/ (requiere Supabase CLI y proyecto vinculado):
supabase functions deploy soporte-chat

# Secreto del proveedor de IA (NO va en la BD ni en el backend):
supabase secrets set OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxx
```

`SUPABASE_URL` y `SUPABASE_ANON_KEY` ya están disponibles como variables del
runtime de Edge Functions.

## Contrato
- **Entrada** (`POST`, JSON): `{ messages: {role,content}[], model: string }`
  - Headers: `Authorization: Bearer <JWT usuario>`, `apikey: <anon>`
- **Salida** (JSON): `{ respuesta: string, tokens: { entrada, salida } }`

## Modelo
El `model` lo decide el backend leyendo `SPHConfiguraciones.SOPORTE_IA_MODELO`
(por defecto `openai/gpt-4o-mini`). Cámbialo sin redeploy editando ese parámetro.
