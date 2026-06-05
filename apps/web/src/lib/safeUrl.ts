/**
 * Valida que una URL destinada a `<img src>` / `<link href>` use un esquema
 * seguro. Aunque los datos de branding provienen del backend (no del usuario),
 * validar el esquema es defensa en profundidad: evita que un valor inesperado
 * como `javascript:...` llegue a un atributo de URL. Se permiten http(s), las
 * URLs relativas y los blobs/data de imagen (previsualización local de subidas).
 */
export function esUrlImagenSegura(url: string | null | undefined): url is string {
  if (!url) return false;
  const v = url.trim();
  if (v === '') return false;
  // Relativa (mismo origen) o protocolo-relativa: segura.
  if (v.startsWith('/') || v.startsWith('./') || v.startsWith('../')) return true;
  const lower = v.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) return true;
  if (lower.startsWith('blob:')) return true;
  if (lower.startsWith('data:image/')) return true;
  return false;
}

/** Devuelve la URL si es segura para usarse como imagen; si no, `null`. */
export function urlImagenSegura(url: string | null | undefined): string | null {
  return esUrlImagenSegura(url) ? url : null;
}
