import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/types';

/**
 * Firma de documentos de CxP guardados en Storage.
 *
 * Los buckets de CxP (`cxp` = comprobantes, `CFDIproveedores` = facturas) pasan a
 * ser PRIVADOS. El front no puede usar URLs públicas: el backend genera **URLs
 * firmadas** al vuelo en cada lectura.
 *
 * Compatibilidad: el valor guardado en la BD puede ser una **URL pública vieja**
 * (datos históricos) o un **path** directo. `refDeDocumento` normaliza ambos a
 * `{bucket, path}`, así NO hace falta migrar datos.
 */

const MARKER_PUBLICO = '/storage/v1/object/public/';
/** Expiración de las URLs firmadas (2 h: cómoda para la sesión de trabajo). */
export const EXPIRA_DOC_SEGUNDOS = 7200;

export interface RefDoc {
  bucket: string;
  path: string;
}

/**
 * Extrae `{bucket, path}` de un valor guardado: URL pública de Supabase Storage
 * o path directo (`<bucket>/...` no; path relativo dentro de un bucket conocido).
 * Devuelve `null` si está vacío o si es una URL no-pública (firmada/externa), que
 * no debe re-firmarse.
 */
export function refDeDocumento(
  valor: string | null | undefined,
  bucketPorDefecto?: string,
): RefDoc | null {
  if (!valor) return null;
  const v = valor.trim();
  if (!v) return null;

  const i = v.indexOf(MARKER_PUBLICO);
  if (i >= 0) {
    const resto = v.slice(i + MARKER_PUBLICO.length);
    const slash = resto.indexOf('/');
    if (slash < 0) return null;
    return {
      bucket: resto.slice(0, slash),
      path: decodeURIComponent(resto.slice(slash + 1)),
    };
  }

  // Cualquier otra URL absoluta (firmada/externa): no la tocamos.
  if (/^https?:\/\//i.test(v)) return null;

  // Path relativo dentro del bucket por defecto del contexto.
  if (bucketPorDefecto) return { bucket: bucketPorDefecto, path: v.replace(/^\/+/, '') };
  return null;
}

/**
 * Firma en lote una lista de valores guardados (URLs públicas o paths). Agrupa
 * por bucket y usa `createSignedUrls` para no penalizar listados grandes.
 * Devuelve un `Map` del valor ORIGINAL → URL firmada; los valores que no se
 * puedan resolver no aparecen en el mapa.
 */
export async function firmarDocumentos(
  admin: SupabaseClient<Database>,
  valores: (string | null | undefined)[],
  bucketPorDefecto?: string,
  expira: number = EXPIRA_DOC_SEGUNDOS,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const porBucket = new Map<string, { path: string; original: string }[]>();
  const vistos = new Set<string>();

  for (const v of valores) {
    if (!v || vistos.has(v)) continue; // de-dup por valor original
    vistos.add(v);
    const ref = refDeDocumento(v, bucketPorDefecto);
    if (!ref) continue;
    const arr = porBucket.get(ref.bucket) ?? [];
    arr.push({ path: ref.path, original: v });
    porBucket.set(ref.bucket, arr);
  }

  for (const [bucket, items] of porBucket) {
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrls(items.map((it) => it.path), expira);
    if (error || !data) continue;
    data.forEach((d, idx) => {
      const original = items[idx]?.original;
      if (original && d.signedUrl && !d.error) out.set(original, d.signedUrl);
    });
  }

  return out;
}

/** Conveniencia: firma un único valor (URL pública o path). */
export async function firmarDocumento(
  admin: SupabaseClient<Database>,
  valor: string | null | undefined,
  bucketPorDefecto?: string,
  expira: number = EXPIRA_DOC_SEGUNDOS,
): Promise<string | null> {
  if (!valor) return null;
  const mapa = await firmarDocumentos(admin, [valor], bucketPorDefecto, expira);
  return mapa.get(valor) ?? null;
}
