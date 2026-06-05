import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

/** Recuperación de contraseña (placeholder; el flujo se implementará después). */
export function RecuperarPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-6">
      <Logo fondo="claro" />
      <div className="w-full max-w-sm space-y-3 text-center">
        <h1 className="text-2xl font-semibold text-[#3f5b87]">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-gray-500">
          Esta funcionalidad estará disponible próximamente.
        </p>
        <Link
          to="/login"
          className="inline-block text-sm font-semibold text-[#3f5b87] hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </main>
  );
}
