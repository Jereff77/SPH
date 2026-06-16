# Edge Function: `comprobante-extraer`

Proxy delgado a **OpenRouter** para la lectura de **comprobantes de pago** (CxP).
Su única responsabilidad es custodiar el secreto `OPENROUTER_API_KEY` fuera del
backend y del frontend (mismo patrón que `soporte-chat` e `ia-chat`).

Es el **fallback** de la lectura de comprobantes: el backend
(`apps/api/src/modules/cxp/pagos.service.ts → analizarComprobante`) primero
intenta un **parser determinista local** (`comprobantes.parser.ts`); solo cuando
el formato no se reconoce, invoca esta función con el **texto ya extraído** del
PDF para que el modelo lo estructure. Reemplaza al antiguo webhook de N8N.

## Contrato

- **Entrada** (POST, JSON): `{ texto: string, model?: string }`
- **Salida** (JSON): `{ datos: Record<string,string>, tokens: { entrada, salida } }`

Las claves de `datos` son las mismas que mapea el backend: `FechadeOperacion`,
`HoradeOperacion`, `NombredelOrdenante`, `CuentaDestino`, `BancoDestino`,
`NombreBeneficiario`, `Importe`, `ConceptodePago`, `Referencia`,
`NoAutorizacion`, `ClaveRastreo`.

## Despliegue

```bash
supabase functions deploy comprobante-extraer

# Secreto del proveedor de IA (compartido con soporte-chat/ia-chat;
# solo hace falta si aún no está puesto en el proyecto):
supabase secrets set OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxx
```

## Seguridad

- La invoca el **backend** con el `service_role` (el `verify_jwt` del gateway
  valida el token del proyecto). El backend ya autenticó al usuario y verificó
  el permiso de pago antes de llegar aquí.
- No accede a datos de negocio ni escribe nada: solo estructura el texto.
- Recibe **texto**, nunca el PDF ni una URL pública (no expone el documento).
