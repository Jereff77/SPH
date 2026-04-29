import { createClient } from '@/lib/supabase/server'
import type { ActivityHistory, ActivityDoc } from '@/lib/types'

export interface LeadDetail {
  id: string
  nombreLead: string
  telefono?: string
  correo?: string
  Etapa: string
  idEtapa: number
  nomRC: string
  uidRC?: string
  valor: number
  Origen: string
  tipoCliente?: string
  tipoOperacion?: string
  tipoVenta?: string
  idCampania?: number
  mensaje?: string
  fc: string
  heatLevel: number
}

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('leads')
    .select('id, nombreLead, telefono, correo, Etapa, idEtapa, nomRC, uidRC, valor, Origen, tipoCliente, tipoOperacion, tipoVenta, idCampania, mensaje, fc')
    .eq('id', id)
    .single()

  if (!data) return null

  // Última actividad para heat level
  const { data: act } = await supabase
    .from('activity_history')
    .select('heat_level')
    .eq('lead_id', id)
    .order('activity_date', { ascending: false })
    .limit(1)
    .single()

  return { ...data, valor: data.valor ?? 0, heatLevel: act?.heat_level ?? 1 }
}

export async function getLeadActivities(leadId: string): Promise<ActivityHistory[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('activity_history')
    .select('id, lead_id, type, message, activity_date, heat_level, fechaAgenda, uidr, docs')
    .eq('lead_id', leadId)
    .order('activity_date', { ascending: false })

  if (!data?.length) return []

  // Enriquecer con nombre del RC
  const uids = [...new Set(data.map(a => a.uidr).filter(Boolean))]
  const { data: users } = await supabase
    .from('catUsers')
    .select('uid, nombre')
    .in('uid', uids)

  const userMap: Record<string, string> = {}
  for (const u of users ?? []) userMap[u.uid] = u.nombre

  // Generar signed URLs para docs (bucket privado, expiran en 1h)
  const allDocPaths = data.flatMap(a => (a.docs as ActivityDoc[] ?? []).map(d => d.path))
  const urlMap: Record<string, string> = {}
  if (allDocPaths.length > 0) {
    const signedResults = await Promise.all(
      allDocPaths.map(path => supabase.storage.from('crmDocs').createSignedUrl(path, 3600))
    )
    signedResults.forEach((result, i) => {
      if (result.data?.signedUrl) urlMap[allDocPaths[i]] = result.data.signedUrl
    })
  }

  return data.map(a => ({
    ...a,
    nomRC: a.uidr ? userMap[a.uidr] : undefined,
    docs: (a.docs as ActivityDoc[] ?? []).map(d => ({ ...d, url: urlMap[d.path] ?? '' })),
  }))
}
