"""
Módulo de conexión IMAP con Hostinger
"""

import imaplib
import email.message
from email.header import decode_header
from typing import List, Tuple, Optional
import ssl
import re
from .config import Config
from .logger import logger

class EmailClient:
    """Cliente para interactuar con servidor IMAP de Hostinger"""
    
    def __init__(self):
        """Inicializa el cliente de correo"""
        self.imap_server = None
        self.connected = False
        # Dominios de correo considerados como banco
        self.bank_domains = ['@bb.com.mx', '@bb.com']
    
    def connect(self) -> bool:
        """
        Establece conexión con el servidor IMAP
        
        Returns:
            bool: True si la conexión es exitosa, False en caso contrario
        """
        try:
            # Crear contexto SSL
            context = ssl.create_default_context()
            
            # Conectar al servidor IMAP
            self.imap_server = imaplib.IMAP4_SSL(
                Config.IMAP_SERVER, 
                Config.IMAP_PORT,
                ssl_context=context
            )
            
            # Iniciar sesión
            self.imap_server.login(Config.IMAP_USER, Config.IMAP_PASSWORD)
            self.connected = True
            
            logger.info(f"Conexión exitosa al servidor IMAP {Config.IMAP_SERVER}")
            return True
            
        except Exception as e:
            logger.error(f"Error al conectar con servidor IMAP: {str(e)}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Cierra la conexión con el servidor IMAP"""
        try:
            if self.imap_server and self.connected:
                self.imap_server.close()
                self.imap_server.logout()
                self.connected = False
                logger.info("Conexión IMAP cerrada correctamente")
        except Exception as e:
            logger.error(f"Error al cerrar conexión IMAP: {str(e)}")
    
    def select_inbox(self) -> bool:
        """
        Selecciona la bandeja de entrada
        
        Returns:
            bool: True si se seleccionó correctamente, False en caso contrario
        """
        try:
            if not self.connected:
                if not self.connect():
                    return False
            
            status, messages = self.imap_server.select('INBOX')
            if status == 'OK':
                logger.info("Bandeja de entrada seleccionada correctamente")
                return True
            else:
                logger.error(f"Error al seleccionar bandeja de entrada: {status}")
                return False
                
        except Exception as e:
            logger.error(f"Error al seleccionar bandeja de entrada: {str(e)}")
            return False
    
    def get_unread_emails(self) -> List[Tuple[bytes, email.message.Message]]:
        """
        Obtiene correos no leídos de la bandeja de entrada
        
        Returns:
            List de tuplas (uid, message) con los correos no leídos
        """
        try:
            if not self.connected:
                if not self.connect():
                    return []
            
            if not self.select_inbox():
                return []
            
            # Buscar correos no leídos
            status, email_ids = self.imap_server.search(None, 'UNSEEN')
            
            if status != 'OK':
                logger.error("Error al buscar correos no leídos")
                return []
            
            email_list = []
            email_id_list = email_ids[0].split()

            # Invertir el orden para procesar correos más recientes primero
            email_id_list.reverse()

            for email_id in email_id_list:
                try:
                    # Obtener el correo sin marcar como leído (usando PEEK)
                    status, msg_data = self.imap_server.fetch(email_id, '(BODY.PEEK[])')
                    
                    if status == 'OK':
                        # Parsear el correo
                        raw_email = msg_data[0][1]
                        msg = email.message_from_bytes(raw_email)
                        email_list.append((email_id, msg))
                        
                except Exception as e:
                    logger.error(f"Error al procesar correo {email_id}: {str(e)}")
                    continue
            
            logger.info(f"Se encontraron {len(email_list)} correos no leídos")
            return email_list
            
        except Exception as e:
            logger.error(f"Error al obtener correos no leídos: {str(e)}")
            return []
    
    def get_xml_attachments(self, msg: 'email.message.Message') -> List[bytes]:
        """
        Extrae archivos XML adjuntos de un correo
        
        Args:
            msg: Mensaje de correo electrónico
            
        Returns:
            List de bytes con el contenido de los archivos XML
        """
        xml_files = []
        
        try:
            # Recorrer todas las partes del correo
            for part in msg.walk():
                # Verificar si es un archivo adjunto
                if part.get_content_disposition() == 'attachment':
                    filename = part.get_filename()
                    
                    if filename:
                        # Decodificar el nombre del archivo
                        decoded_filename = decode_header(filename)[0][0]
                        if isinstance(decoded_filename, bytes):
                            decoded_filename = decoded_filename.decode()
                        
                        # Verificar si es un archivo XML
                        if decoded_filename.lower().endswith('.xml'):
                            # Obtener el contenido del archivo
                            content = part.get_payload(decode=True)
                            xml_files.append(content)
                            logger.info(f"Archivo XML encontrado: {decoded_filename}")
            
            return xml_files
            
        except Exception as e:
            logger.error(f"Error al extraer archivos XML: {str(e)}")
            return []
    
    def mark_email_as_read(self, email_id: bytes) -> bool:
        """
        Marca un correo como leído
        
        Args:
            email_id: ID del correo a marcar como leído
            
        Returns:
            bool: True si se marcó correctamente, False en caso contrario
        """
        try:
            if not self.connected:
                return False
            
            # Marcar como leído
            self.imap_server.store(email_id, '+FLAGS', '\\Seen')
            logger.debug(f"Correo {email_id} marcado como leído")
            return True
            
        except Exception as e:
            logger.error(f"Error al marcar correo como leído: {str(e)}")
            return False
    
    def is_bank_email(self, msg: 'email.message.Message') -> bool:
        """
        Identifica si un correo proviene del banco basado en el dominio del remitente

        Args:
            msg: Mensaje de correo electrónico

        Returns:
            bool: True si el correo proviene del banco, False en caso contrario
        """
        try:
            # Obtener el remitente del correo
            from_header = msg.get('from', '')
            if not from_header:
                return False

            # Extraer dirección de correo del remitente
            # El formato puede ser "Nombre <correo@dominio.com>" o "correo@dominio.com"
            email_match = re.search(r'<([^>]+)>', from_header)
            if email_match:
                email_addr = email_match.group(1).lower()
            else:
                # Si no hay formato <>, tomar todo el texto como dirección
                email_addr = from_header.lower().strip()

            # Verificar si el dominio coincide con los dominios del banco
            for domain in self.bank_domains:
                if domain in email_addr:
                    logger.info(f"Correo identificado como bancario: {email_addr}")
                    return True

            return False

        except Exception as e:
            logger.error(f"Error al identificar correo bancario: {str(e)}")
            return False

    def get_email_info(self, msg: 'email.message.Message') -> dict:
        """
        Extrae información básica del correo

        Args:
            msg: Mensaje de correo electrónico

        Returns:
            dict: Información del correo (asunto, remitente, es_banco)
        """
        try:
            subject = msg.get('subject', 'Sin asunto')
            from_addr = msg.get('from', 'Remitente desconocido')

            # Decodificar el asunto si es necesario
            if subject:
                decoded_subject = decode_header(subject)[0][0]
                if isinstance(decoded_subject, bytes):
                    subject = decoded_subject.decode('utf-8', errors='ignore')

            return {
                'subject': subject,
                'from': from_addr,
                'is_bank': self.is_bank_email(msg)
            }

        except Exception as e:
            logger.error(f"Error al extraer información del correo: {str(e)}")
            return {
                'subject': 'Error al leer asunto',
                'from': 'Error al leer remitente',
                'is_bank': False
            }

    def create_folder_if_not_exists(self, folder_name: str) -> bool:
        """
        Crea una carpeta si no existe

        Args:
            folder_name: Nombre de la carpeta a crear

        Returns:
            bool: True si se creó o ya existe, False en caso contrario
        """
        try:
            if not self.connected:
                if not self.connect():
                    return False

            # Listar carpetas existentes
            status, folders = self.imap_server.list()
            if status != 'OK':
                logger.error("Error al listar carpetas")
                return False

            # Verificar si la carpeta ya existe
            for folder in folders:
                folder_bytes = folder.decode() if isinstance(folder, bytes) else folder

                # Verificar si es la carpeta que buscamos (con o sin prefijo INBOX.)
                if folder_name.lower() in folder_bytes.lower() and ('INBOX.' in folder_bytes or folder_name.lower() in folder_bytes.split()[-1].lower()):
                    logger.info(f"La carpeta '{folder_name}' ya existe como: '{folder_bytes}'")
                    return True

            # Crear la carpeta
            logger.info(f"Creando carpeta '{folder_name}'...")
            status, result = self.imap_server.create(folder_name)
            if status == 'OK':
                logger.info(f"Carpeta '{folder_name}' creada exitosamente")
                return True
            else:
                logger.error(f"Error al crear carpeta {folder_name}: {result}")
                return False

        except Exception as e:
            logger.error(f"Error al crear carpeta {folder_name}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False

    def move_email_to_folder(self, email_id: bytes, folder_name: str) -> bool:
        """
        Mueve un correo a una carpeta específica

        Args:
            email_id: ID del correo a mover
            folder_name: Nombre de la carpeta destino

        Returns:
            bool: True si se movió correctamente, False en caso contrario
        """
        try:
            import re
            if not self.connected:
                logger.error("No hay conexión IMAP activa para mover correo")
                return False

            # Seleccionar INBOX para asegurar que estamos en la carpeta correcta
            self.imap_server.select('INBOX')

            # Listar carpetas disponibles para debug
            status, folders = self.imap_server.list()
            if status == 'OK':
                available_folders = [f.decode() if isinstance(f, bytes) else f for f in folders]
                logger.info(f"Carpetas disponibles en el servidor: {available_folders}")

                # Verificar si la carpeta existe con diferentes formatos
                folder_found = False
                folder_to_use = folder_name

                # Convertir el nombre buscado al formato INBOX.nombre
                if '/' in folder_name:
                    # Es una subcarpeta (ej: BanBajio/otros -> INBOX.BanBajio.otros)
                    search_pattern = 'INBOX.' + folder_name.replace('/', '.')
                elif not folder_name.startswith('INBOX.'):
                    # Es una carpeta simple (ej: procesados -> INBOX.procesados)
                    search_pattern = 'INBOX.' + folder_name
                else:
                    # Ya tiene formato INBOX.nombre
                    search_pattern = folder_name

                for folder in available_folders:
                    # Buscar coincidencia exacta con el patrón INBOX.nombre
                    if search_pattern.lower() == folder.lower():
                        folder_found = True
                        folder_to_use = folder
                        logger.info(f"Carpeta encontrada con nombre exacto: '{folder_to_use}'")
                        break

                    # También buscar si el patrón está contenido en el string de la carpeta
                    if search_pattern.lower() in folder.lower():
                        folder_found = True
                        # Extraer el nombre INBOX.nombre completo
                        match = re.search(r'INBOX\.[a-zA-Z0-9_/.-]+', folder)
                        if match:
                            folder_to_use = match.group()
                        else:
                            folder_to_use = folder
                        logger.info(f"Carpeta encontrada con patrón: '{folder_to_use}'")
                        break

                if not folder_found:
                    logger.error(f"La carpeta '{folder_name}' no existe en las carpetas disponibles")
                    return False

            # Copiar el correo a la carpeta destino
            logger.info(f"Intentando copiar correo {email_id} a carpeta '{folder_to_use}'")
            status, result = self.imap_server.copy(email_id, folder_to_use)
            if status != 'OK':
                logger.error(f"Error al copiar correo a {folder_to_use}: {result}")
                return False
            logger.info(f"Correo copiado exitosamente a {folder_to_use}")

            # Marcar el correo original para eliminación (\Deleted flag)
            status, result = self.imap_server.store(email_id, '+FLAGS', '\\Deleted')
            if status != 'OK':
                logger.error(f"Error al marcar correo para eliminación: {result}")
                return False
            logger.info(f"Correo marcado para eliminación")

            # Ejecutar la expurgación para eliminar permanentemente el correo original
            status, result = self.imap_server.expunge()
            if status != 'OK':
                logger.warning(f"Advertencia: No se pudo expurgar el correo: {result}")
                # No es crítico, el correo se copió correctamente
            else:
                logger.info(f"Expurgación ejecutada correctamente")

            logger.info(f"Correo movido exitosamente a {folder_to_use}")
            return True

        except Exception as e:
            logger.error(f"Error al mover correo a {folder_name}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False

    def test_connection(self) -> bool:
        """
        Prueba la conexión con el servidor de correo

        Returns:
            bool: True si la conexión es exitosa, False en caso contrario
        """
        try:
            if self.connect():
                if self.select_inbox():
                    logger.info("Prueba de conexión IMAP exitosa")
                    return True
            return False
        except Exception as e:
            logger.error(f"Error en prueba de conexión IMAP: {str(e)}")
            return False