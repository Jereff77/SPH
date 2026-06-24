/**
 * Construye la FIRMA HTML corporativa que se anexa a cada respuesta de Soporte a
 * Inquilinos (desafío 2). Incluye logotipo de la empresa + datos del usuario que
 * responde (nombre, cargo/rol, teléfono) + el correo de contacto y datos de SPH.
 *
 * Se mantiene como HTML inline (sin clases CSS) porque los clientes de correo no
 * cargan hojas de estilo externas. El logo usa una URL pública del bucket
 * `branding` (los clientes de correo descargan la imagen al abrir el mensaje).
 */

export interface DatosFirma {
  /** Nombre completo del usuario que responde. */
  nombre: string | null;
  /** Cargo / rol del usuario (no hay campo "puesto" dedicado; se usa el rol). */
  cargo: string | null;
  /** Teléfono directo del usuario. */
  telefono: string | null;
  /** Correo de la cuenta de soporte (contacto@portal.gruposph.mx). */
  correoContacto: string | null;
  /** URL pública del logotipo (fondo claro) o null. */
  logoUrl: string | null;
}

const AZUL = '#1f2a4d';
const GRIS = '#6b7280';
const EMPRESA = 'Grupo SPH Bienes Raíces';

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Devuelve el bloque <table> de la firma listo para concatenar al cuerpo HTML. */
export function construirFirmaHtml(d: DatosFirma): string {
  const nombre = d.nombre?.trim() || 'Equipo de Operaciones';
  const filas: string[] = [];

  if (d.cargo?.trim()) {
    filas.push(
      `<div style="font-size:12px;color:${GRIS};margin:1px 0">${escapar(d.cargo.trim())}</div>`,
    );
  }
  filas.push(
    `<div style="font-size:12px;color:${GRIS};margin:1px 0">${escapar(EMPRESA)}</div>`,
  );
  if (d.telefono?.trim()) {
    filas.push(
      `<div style="font-size:12px;color:${GRIS};margin:1px 0">Tel: ${escapar(d.telefono.trim())}</div>`,
    );
  }
  if (d.correoContacto?.trim()) {
    const correo = escapar(d.correoContacto.trim());
    filas.push(
      `<div style="font-size:12px;margin:1px 0"><a href="mailto:${correo}" style="color:${AZUL};text-decoration:none">${correo}</a></div>`,
    );
  }

  const logo = d.logoUrl
    ? `<td style="padding-right:14px;border-right:2px solid ${AZUL};vertical-align:middle">
         <img src="${escapar(d.logoUrl)}" alt="${escapar(EMPRESA)}" style="max-height:56px;max-width:160px;display:block" />
       </td>`
    : '';

  return `
<div style="margin-top:22px;padding-top:14px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif">
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
    <tr>
      ${logo}
      <td style="${logo ? 'padding-left:14px;' : ''}vertical-align:middle">
        <div style="font-size:14px;font-weight:bold;color:${AZUL};margin:1px 0">${escapar(nombre)}</div>
        ${filas.join('\n        ')}
      </td>
    </tr>
  </table>
</div>`.trim();
}
