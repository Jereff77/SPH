import { createClient } from '@/lib/supabase/server'
import { BandejaAprobacion } from '@/components/aprobar/bandeja-aprobacion'
import type { LeadPorAprobar } from '@/components/aprobar/bandeja-aprobacion'

async function getLeadsPorAprobar(): Promise<LeadPorAprobar[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('leads_porAprobar')
    .select('id, nombreLead, telefono, correo, mensaje, superficie, KVAs, ubicacion, Origen, nomRC, fc')
    .eq('status', true)
    .order('fc', { ascending: false })

  if (!data?.length) return []

  // Detectar similares por teléfono
  const telefonos = data.map(l => l.telefono).filter(Boolean)
  const { data: similares } = await supabase
    .from('leads')
    .select('telefono')
    .in('telefono', telefonos)
    .eq('status', true)

  const telsSimilares = new Set((similares ?? []).map(l => l.telefono))

  return data.map(l => ({
    ...l,
    tieneSimilar: l.telefono ? telsSimilares.has(l.telefono) : false,
  }))
}

export default async function AprobarPage() {
  const leads = await getLeadsPorAprobar()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Aprobar leads</h2>
        <p className="text-sm text-muted-foreground">
          {leads.length} lead{leads.length !== 1 ? 's' : ''} pendiente{leads.length !== 1 ? 's' : ''} de revisión
        </p>
      </div>

      <BandejaAprobacion leads={leads} />
    </div>
  )
}
