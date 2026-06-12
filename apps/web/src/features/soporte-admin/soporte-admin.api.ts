import { api } from '@/lib/api';
import type {
  ConversacionAdmin,
  EstadoTicket,
  SesionAdmin,
  TicketAdmin,
} from './types';

export const soporteAdminApi = {
  // --- Conversaciones (auditoría) ---
  sesiones: (eliminadas = false) =>
    api.get<SesionAdmin[]>(`/soporte/admin/sesiones?eliminadas=${eliminadas}`),
  conversacion: (sessionId: string) =>
    api.get<ConversacionAdmin>(`/soporte/admin/sesiones/${sessionId}`),

  // --- Tickets (atención) ---
  tickets: (estado?: EstadoTicket) =>
    api.get<TicketAdmin[]>(
      `/soporte/admin/tickets${estado ? `?estado=${estado}` : ''}`,
    ),
  atender: (ticketId: string, estado: EstadoTicket) =>
    api.patch<{ ok: true }>(`/soporte/admin/tickets/${ticketId}`, { estado }),
};

// --- Helpers de formato (regla 7b: fecha dd/mm/aaaa) ------------------------

/** Fecha + hora en formato MX `dd/mm/aaaa hh:mm` (24 h). */
export const fechaHora = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  });
};
