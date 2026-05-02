'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Reporte {
  id: string;
  nombre: string;
  descripcion?: string;
  visibilidad: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface ReportesListClientProps {
  initialReportes: Reporte[];
}

export function ReportesListClient({ initialReportes }: ReportesListClientProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [reportes, setReportes] = useState<Reporte[]>(initialReportes);

  const handleCreateReporte = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      console.log('📄 Creando reporte via API...');

      const response = await fetch('/api/reportes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: 'Mi Reporte',
          descripcion: 'Creado automáticamente',
          visibilidad: 'privado'
        })
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear reporte');
      }

      const nuevoReporte = await response.json();

      console.log('✅ Reporte creado (cliente):', nuevoReporte);
      console.log('🔍 Tipo de dato:', typeof nuevoReporte);
      console.log('🔍 Tiene ID?', 'id' in nuevoReporte);
      console.log('🔍 Valor de ID:', nuevoReporte?.id);
      console.log('🔍 Claves del objeto:', Object.keys(nuevoReporte || {}));

      if (!nuevoReporte || !nuevoReporte.id) {
        console.error('❌ Validación falló: reporte sin ID');
        throw new Error('El reporte no se creó correctamente o no tiene ID');
      }

      console.log('🔀 Redirigiendo a:', `/reportes/${nuevoReporte.id}`);
      router.push(`/reportes/${nuevoReporte.id}`);
    } catch (error) {
      console.error('❌ Error creando reporte:', error);
      alert(`Error al crear reporte: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      setIsCreating(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f2f4f8',
        padding: '40px 20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1200,
          display: 'flex',
          flexDirection: 'column',
          gap: 32
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: '#1b2d5e',
                marginBottom: 8
              }}
            >
              📊 Mis Reportes
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#7a84a0'
              }}
            >
              Gestiona tus reportes y dashboards personalizados
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12
            }}
          >
            <button
              onClick={handleCreateReporte}
              disabled={isCreating}
              style={{
                padding: '12px 24px',
                background: isCreating ? '#a0a0a0' : '#7dc244',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                color: '#ffffff',
                fontWeight: 600,
                cursor: isCreating ? 'not-allowed' : 'pointer',
                opacity: isCreating ? 0.7 : 1
              }}
            >
              {isCreating ? 'Creando...' : '+ Crear nuevo reporte'}
            </button>

            <Link
              href="/dashboard"
              style={{
                padding: '12px 24px',
                background: '#ffffff',
                border: '1px solid #e2e6ef',
                borderRadius: 6,
                fontSize: 14,
                color: '#1b2d5e',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              Volver al dashboard
            </Link>
          </div>
        </div>

        {/* Lista de reportes */}
        {reportes.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e6ef'
            }}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: 16
              }}
            >
              📊
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#1b2d5e',
                marginBottom: 8
              }}
            >
              No tienes reportes aún
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#7a84a0',
                marginBottom: 24
              }}
            >
              Crea tu primer reporte personalizado con Report Studio
            </div>
            <button
              onClick={handleCreateReporte}
              disabled={isCreating}
              style={{
                padding: '12px 24px',
                background: isCreating ? '#a0a0a0' : '#7dc244',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                color: '#ffffff',
                fontWeight: 600,
                cursor: isCreating ? 'not-allowed' : 'pointer',
                opacity: isCreating ? 0.7 : 1
              }}
            >
              {isCreating ? 'Creando...' : '+ Crear mi primer reporte'}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16
            }}
          >
            {reportes.map((reporte) => (
              <Link
                key={reporte.id}
                href={`/reportes/${reporte.id}`}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e6ef',
                  borderRadius: 8,
                  padding: 20,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#7dc244';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(125, 194, 68, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e6ef';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#1b2d5e',
                    marginBottom: 8
                  }}
                >
                  {reporte.nombre}
                </div>
                {reporte.descripcion && (
                  <div
                    style={{
                      fontSize: 13,
                      color: '#7a84a0',
                      marginBottom: 12
                    }}
                  >
                    {reporte.descripcion}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 11,
                    color: '#7a84a0'
                  }}
                >
                  <span>
                    {new Date(reporte.fecha_actualizacion).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      background: reporte.visibilidad === 'publico' ? '#e8f5e9' : '#fff3e0',
                      color: reporte.visibilidad === 'publico' ? '#2e7d32' : '#f57c00',
                      borderRadius: 4,
                      fontWeight: 600
                    }}
                  >
                    {reporte.visibilidad === 'publico' ? 'Público' : 'Privado'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
