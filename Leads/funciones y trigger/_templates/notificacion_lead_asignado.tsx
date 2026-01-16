--[Fecha y Hora]: 01/12/2025 07:12:00
--[Descripción]: Plantilla de correo HTML para notificación de lead asignado
--
--[Uso]: Utilizada por la función leads_notificar_cambio_uidrc
--
--[Estilo]: Profesional con branding de SPH Bines Raíces
--
--[Variables de plantilla]:
--   - {{ leadName }}: Nombre completo del lead
--   - {{ responsibleName }}: Nombre del responsable comercial
--   - {{ responsibleEmail }}: Correo del responsable
--   - {{ actionType }}: Tipo de acción (nuevo_lead_asignado, lead_modificado)
--   - {{ actionDescription }}: Descripción amigable de la acción
--   - {{ timestamp }}: Fecha y hora del cambio
--   - {{ siteUrl }}: URL del sistema SPH

interface NotificacionLeadProps {
  leadName: string;
  responsibleName: string;
  responsibleEmail: string;
  actionType: string;
  actionDescription: string;
  timestamp: string;
  siteUrl: string;
}

export const NotificacionLeadAsignado = ({ 
  leadName, 
  responsibleName, 
  responsibleEmail, 
  actionType, 
  actionDescription, 
  timestamp, 
  siteUrl 
}: NotificacionLeadProps) => {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'nuevo_lead_asignado':
        return '👤';
      case 'lead_modificado':
        return '✏️';
      default:
        return '📋';
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'nuevo_lead_asignado':
        return '#28a745';
      case 'lead_modificado':
        return '#ff9800';
      default:
        return '#666';
    }
  };

  const getActionText = (type: string) => {
    switch (type) {
      case 'nuevo_lead_asignado':
        return 'Nuevo Lead Asignado';
      case 'lead_modificado':
        return 'Lead Modificado';
      default:
        return 'Actualización de Lead';
    }
  };

  return (
    <Html>
      <Head>
        <Title>{actionType === 'nuevo_lead_asignado' ? '🔔 Nuevo Lead Asignado - SPH Bines Raíces' : '📝 Lead Modificado - SPH Bines Raíces'}</Title>
        <style>
          {`
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
              color: #333;
              line-height: 1.5;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              padding: 20px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              background: {getActionColor(actionType)};
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0;
              font-weight: bold;
              font-size: 24px;
            }
            .content {
              padding: 30px;
            }
            .icon {
              font-size: 48px;
              margin-right: 15px;
              vertical-align: middle;
            }
            h1 {
              color: #333;
              margin-bottom: 20px;
              font-size: 24px;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .lead-info {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 120px 1fr;
              gap: 15px;
              margin-bottom: 20px;
            }
            .info-item {
              display: flex;
              align-items: center;
              padding: 10px 0;
            }
            .info-label {
              font-weight: bold;
              color: #555;
              margin-bottom: 5px;
              text-align: right;
            }
            .info-value {
              color: #333;
              word-break: break-word;
            }
            h2 {
              color: #333;
              margin-bottom: 15px;
              font-size: 20px;
            }
            .action-details {
              background-color: #e8f4fd;
              padding: 15px;
              border-radius: 5px;
              margin-bottom: 15px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 12px;
              color: #666;
              padding: 20px;
              background-color: #f8f9fa;
              border-radius: 0 0 8px;
            }
          }
        </style>
      </Head>
      <Body>
        <div class="container">
          <div class="header">
            <div style="display: flex; align-items: center; gap: 15px;">
              <div class="icon">{getActionIcon(actionType)}</div>
              <h1>{getActionText(actionType)}</h1>
            </div>
          </div>
          
          <div class="content">
            <h2>📋 Información del Lead</h2>
            
            <div class="lead-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Nombre:</span>
                  <span class="info-value">{leadName}</span>
                </div>
                
                <div class="info-item">
                  <span class="info-label">Teléfono:</span>
                  <span class="info-value">{leadName}</span>
                </div>
                
                <div class="info-item">
                  <span class="info-label">Correo:</span>
                  <span class="info-value">{leadName}</span>
                </div>
                
                <div class="info-item">
                  <span class="info-label">Responsable:</span>
                  <span class="info-value">{responsibleName}</span>
                </div>
              </div>
            
            <h2>📅 Detalles del Cambio</h2>
            
            <div class="action-details">
              <div class="info-item">
                <span class="info-label">Tipo de acción:</span>
                <span class="info-value">{getActionText(actionType)}</span>
              </div>
              
              <div class="info-item">
                <span class="info-label">Fecha y hora:</span>
                <span class="info-value">{timestamp}</span>
              </div>
              
              <div class="info-item">
                <span class="info-label">Descripción:</span>
                <span class="info-value">{actionDescription}</span>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p><small>Este es un mensaje automático del sistema SPH Bines Raíces. Por favor no responder a este correo.</small></p>
            <p><small>Enviado el: {timestamp}</small></p>
            <p>
              <a href="{siteUrl}" style="color: #2c3e50; text-decoration: none; margin-top: 10px;">
                Acceder al Sistema SPH
              </a>
            </p>
          </div>
        </div>
      </Body>
    </Html>
  );
};

export default NotificacionLeadAsignado;