export const plantillaCorreoN8N = {
  asunto: "Nuevo Lead Asignado - SPH Bienes Raíces",
  html: `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notificación de Lead Asignado</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                    <!-- Encabezado -->
                    <tr>
                        <td style="background-color: #1a4f8a; padding: 25px 30px; border-radius: 8px 8px 0 0; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">SPH Bienes Raíces</h1>
                            <p style="margin: 10px 0 0; color: #e0e0e0; font-size: 16px;">Notificación de Lead Asignado</p>
                        </td>
                    </tr>
                    
                    <!-- Cuerpo del mensaje -->
                    <tr>
                        <td style="padding: 30px;">
                            <h2 style="margin: 0 0 20px; color: #1a4f8a; font-size: 20px;">Hola {{nombreAsesor}},</h2>
                            <p style="margin: 0 0 25px; color: #333333; font-size: 16px; line-height: 1.5;">Se te ha asignado un nuevo lead. A continuación encontrarás los detalles del contacto:</p>
                            
                            <!-- Información del Lead -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                                <tr>
                                    <td style="background-color: #f8f9fa; padding: 20px; border-radius: 6px;">
                                        <h3 style="margin: 0 0 15px; color: #1a4f8a; font-size: 18px;">Datos del Lead</h3>
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                                                    <strong style="color: #555555; font-size: 14px;">Nombre:</strong>
                                                    <span style="color: #333333; font-size: 14px; margin-left: 10px;">{{nombreLead}}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                                                    <strong style="color: #555555; font-size: 14px;">Correo:</strong>
                                                    <span style="color: #333333; font-size: 14px; margin-left: 10px;">{{correoLead}}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                                                    <strong style="color: #555555; font-size: 14px;">Teléfono:</strong>
                                                    <span style="color: #333333; font-size: 14px; margin-left: 10px;">{{telefonoLead}}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                                                    <strong style="color: #555555; font-size: 14px;">Origen:</strong>
                                                    <span style="color: #333333; font-size: 14px; margin-left: 10px;">{{origenLead}}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                                                    <strong style="color: #555555; font-size: 14px;">Tipo de venta:</strong>
                                                    <span style="color: #333333; font-size: 14px; margin-left: 10px;">{{tipoVenta}}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                                                    <strong style="color: #555555; font-size: 14px;">Tipo de cliente:</strong>
                                                    <span style="color: #333333; font-size: 14px; margin-left: 10px;">{{tipoCliente}}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <strong style="color: #555555; font-size: 14px;">Tipo de operación:</strong>
                                                    <span style="color: #333333; font-size: 14px; margin-left: 10px;">{{tipoOperacion}}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Fechas importantes -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                                <tr>
                                    <td style="background-color: #f8f9fa; padding: 20px; border-radius: 6px;">
                                        <h3 style="margin: 0 0 15px; color: #1a4f8a; font-size: 18px;">Fechas Importantes</h3>
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                                                    <strong style="color: #555555; font-size: 14px;">Fecha de contacto:</strong>
                                                    <span style="color: #333333; font-size: 14px; margin-left: 10px;">{{fechaContacto}}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <strong style="color: #555555; font-size: 14px;">Fecha de registro:</strong>
                                                    <span style="color: #333333; font-size: 14px; margin-left: 10px;">{{fechaRegistro}}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Llamado a la acción -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="{{urlSistema}}" style="background-color: #1a4f8a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: 600; font-size: 16px; display: inline-block;">Contactar Lead</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 25px 0 0; color: #666666; font-size: 14px; line-height: 1.5;">Por favor, contacta a este lead a la brevedad posible para proporcionar la mejor atención y aumentar las probabilidades de conversión.</p>
                        </td>
                    </tr>
                    
                    <!-- Pie de página -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">ID de Asesor: {{uidAsesor}}</p>
                            <p style="margin: 0; color: #666666; font-size: 12px;">© 2025 SPH Bienes Raíces. Todos los derechos reservados.</p>
                            <p style="margin: 10px 0 0; color: #666666; font-size: 12px;">Este es un mensaje automático, por favor no responder a este correo.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
  variables: {
    nombreAsesor: "Juanjereff Lopez",
    uidAsesor: "896f01e5-283f-4bdb-b3f3-11381adedb30",
    nombreLead: "Silvia Avendaño",
    correoLead: "silvia@mess.com.mx",
    telefonoLead: "(442) 219-7255",
    origenLead: "Recompra",
    tipoVenta: "Nave",
    tipoCliente: "Cliente",
    tipoOperacion: "Inversión",
    fechaContacto: "26/11/2025 15:23:09",
    fechaRegistro: "26/11/2025 09:23:08",
    urlSistema: "#"
  }
};

// Función para reemplazar variables en la plantilla
export const generarCorreoConVariables = (plantilla: any, variables: any) => {
  let html = plantilla.html;
  
  // Reemplazar cada variable en el HTML
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, variables[key]);
  });
  
  return {
    asunto: plantilla.asunto,
    html: html
  };
};

// Ejemplo de uso
export const correoGenerado = generarCorreoConVariables(plantillaCorreoN8N, plantillaCorreoN8N.variables);