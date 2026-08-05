/** Captura lista para adjuntar al mensaje (JPEG base64 como data URL). */
export interface CapturaSoporte {
  dataUrl: string;
  nombre: string;
}

/**
 * Captura la pantalla actual de la app (el `<main>`, NUNCA el panel del agente)
 * a una imagen, para que el Agente de Soporte pueda "ver" lo que el usuario
 * tiene enfrente.
 *
 * Usa `html-to-image` (renderiza el DOM a canvas) — sin el diálogo de
 * "compartir pantalla" del navegador: captura solo el ERP, en silencio. Luego
 * redimensiona a ≤1024px y exporta JPEG. La imagen va inline al modelo y NO se
 * persiste (en BD solo queda un marcador de texto).
 *
 * El panel del agente vive FUERA de `<main>` (hermano en el AppShell), así que
 * no se auto-captura. Privacidad: se excluyen los campos de contraseña y todo
 * nodo marcado con `data-soporte-exclude-capture="true"`.
 *
 * ⚠️ Limitación conocida (heredada de html-to-image): el DOM normal (tablas,
 * formularios, texto, layout) sale bien, pero gráficas en canvas/WebGL o
 * imágenes de otros dominios pueden salir en blanco.
 */
const LADO_MAX = 1024;
const CALIDAD = 0.8;

export async function capturarPantalla(): Promise<CapturaSoporte> {
  const objetivo = document.querySelector('main');
  if (!(objetivo instanceof HTMLElement)) {
    throw new Error('No pude capturar la pantalla.');
  }

  // Import dinámico (patrón del proyecto: DesgloseModal, ChartBlockIA) para no
  // cargar la librería hasta la primera captura.
  const { toCanvas } = await import('html-to-image');
  const origen = await toCanvas(objetivo, {
    backgroundColor: '#ffffff',
    pixelRatio: 1,
    cacheBust: true,
    filter: (node) => {
      if (node instanceof HTMLInputElement && node.type === 'password') return false;
      if (node instanceof HTMLElement && node.dataset?.soporteExcludeCapture === 'true')
        return false;
      return true;
    },
  });

  const escala = Math.min(1, LADO_MAX / Math.max(origen.width, origen.height));
  const ancho = Math.max(1, Math.round(origen.width * escala));
  const alto = Math.max(1, Math.round(origen.height * escala));

  const salida = document.createElement('canvas');
  salida.width = ancho;
  salida.height = alto;
  const ctx = salida.getContext('2d');
  if (!ctx) throw new Error('No pude procesar la captura.');
  ctx.drawImage(origen, 0, 0, ancho, alto);

  return { dataUrl: salida.toDataURL('image/jpeg', CALIDAD), nombre: 'pantalla.jpg' };
}
