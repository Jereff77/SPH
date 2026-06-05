import { configuracionApi } from './configuracion.api';
import { LogoUploader } from './LogoUploader';
import { FaviconUploader } from './FaviconUploader';
import { ListaAutorizados } from './ListaAutorizados';

/**
 * Configuraciones > Sistema. Logotipos + favicon, dominios autorizados y correos
 * específicos autorizados (excepciones), persistidos en SPHConfiguraciones.
 */
export function SistemaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">
          Sistema
        </h1>
        <p className="text-sm text-gray-500">Configuración general del ERP.</p>
      </div>

      {/* Logotipos + favicon */}
      <section className="max-w-3xl rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Logotipos</h2>
        <p className="mt-1 text-sm text-gray-500">
          Dos versiones según el fondo. PNG, JPG, SVG o WEBP (máx. 2 MB). Puedes
          ajustar el ancho y alto (px); deja vacío para automático.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <LogoUploader
            fondo="claro"
            titulo="Logo para fondo claro"
            descripcion="Login, recuperación y contenido (letras oscuras)."
          />
          <LogoUploader
            fondo="oscuro"
            titulo="Logo para fondo oscuro"
            descripcion="Barra lateral (letras claras/blancas)."
          />
        </div>
        <div className="mt-4">
          <FaviconUploader />
        </div>
      </section>

      {/* Dominios autorizados */}
      <ListaAutorizados
        titulo="Dominios autorizados"
        descripcion="Los usuarios inician sesión con su nombre de usuario; el sistema completa el correo con uno de estos dominios."
        placeholder="nuevodominio.com"
        queryKey="dominios"
        prefijo="@"
        minimo={1}
        normalizar={(v) => v.trim().toLowerCase().replace(/^@/, '')}
        listar={() => configuracionApi.getDominios().then((r) => r.dominios)}
        agregar={(v) =>
          configuracionApi.agregarDominio(v).then((r) => r.dominios)
        }
        quitar={(v) => configuracionApi.quitarDominio(v).then((r) => r.dominios)}
      />

      {/* Correos específicos autorizados (excepciones) */}
      <ListaAutorizados
        titulo="Correos autorizados (excepciones)"
        descripcion="Cuentas específicas permitidas aunque su dominio no esté autorizado (p. ej. correos de Gmail individuales)."
        placeholder="persona@gmail.com"
        queryKey="correos"
        textoVacio="Sin correos específicos."
        normalizar={(v) => v.trim().toLowerCase()}
        listar={() => configuracionApi.getCorreos().then((r) => r.correos)}
        agregar={(v) => configuracionApi.agregarCorreo(v).then((r) => r.correos)}
        quitar={(v) => configuracionApi.quitarCorreo(v).then((r) => r.correos)}
      />
    </div>
  );
}
