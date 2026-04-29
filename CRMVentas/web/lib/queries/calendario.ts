import { createClient } from '@/lib/supabase/server'
import type { CalendarEvent } from '@/lib/types'

const actColor: Record<string, string> = {
  'Llamada':  'var(--act-llamada)',
  'WhatsApp': 'var(--act-whatsapp)',
  'Visita':   'var(--act-visita)',
  'Reunión':  'var(--act-reunion)',
  'Correo':   'var(--act-correo)',
  'Agendar':  'var(--act-agendar)',
}

const actColorHex: Record<string, string> = {
  'Llamada':  '#3B82F6',
  'WhatsApp': '#10B981',
  'Visita':   '#8B5CF6',
  'Reunión':  '#F59E0B',
  'Correo':   '#6B7280',
  'Agendar':  '#EC4899',
  'Otro':     '#6B7280',
}

export interface CalendarEventRaw {
  id: string
  leadId: string
  leadNombre: string
  type: string
  start: string
  rcName: string
  color: string
}

export async function getCalendarEvents(uidRC?: string): Promise<CalendarEventRaw[]> {
  const supabase = await createClient()

  let query = supabase
    .from('activity_history')
    .select('id, lead_id, type, activity_date, fechaAgenda, uidr')
    .not('fechaAgenda', 'is', null)
    .order('fechaAgenda', { ascending: true })

  if (uidRC) query = query.eq('uidr', uidRC)

  const { data: actividades } = await query
  if (!actividades?.length) return []

  // Leads nombres
  const leadIds = [...new Set(actividades.map(a => a.lead_id).filter(Boolean))]
  const { data: leads } = await supabase
    .from('leads')
    .select('id, nombreLead')
    .in('id', leadIds)

  const leadMap: Record<string, string> = {}
  for (const l of leads ?? []) leadMap[l.id] = l.nombreLead

  // RC nombres
  const uids = [...new Set(actividades.map(a => a.uidr).filter(Boolean))]
  const { data: users } = await supabase
    .from('catUsers')
    .select('uid, nombre')
    .in('uid', uids)

  const userMap: Record<string, string> = {}
  for (const u of users ?? []) userMap[u.uid] = u.nombre

  return actividades
    .filter(a => a.fechaAgenda && a.lead_id)
    .map(a => ({
      id: a.id,
      leadId: a.lead_id,
      leadNombre: leadMap[a.lead_id] ?? 'Lead',
      type: a.type ?? 'Otro',
      start: a.fechaAgenda!,
      rcName: a.uidr ? (userMap[a.uidr] ?? '') : '',
      color: actColorHex[a.type ?? ''] ?? actColorHex['Otro'],
    }))
}

export async function getRCsCalendario() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('activity_history')
    .select('uidr')
    .not('fechaAgenda', 'is', null)
    .not('uidr', 'is', null)

  const uids = [...new Set((data ?? []).map(a => a.uidr).filter(Boolean))]
  if (!uids.length) return []

  const { data: users } = await supabase
    .from('catUsers')
    .select('uid, nombre')
    .in('uid', uids)

  return (users ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre))
}
