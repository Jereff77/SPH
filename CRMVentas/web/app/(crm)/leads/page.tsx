import { Suspense } from 'react'
import { LeadsTable } from '@/components/leads/leads-table'
import { NuevoLeadSheet } from '@/components/leads/nuevo-lead-sheet'
import { NuevoPreLeadSheet } from '@/components/leads/nuevo-prelead-sheet'
import { getLeads, getLeadsFilterOptions } from '@/lib/queries/leads'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  searchParams: Promise<{
    search?: string; etapa?: string; rc?: string
    origen?: string; page?: string
  }>
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page     = Math.max(1, parseInt(params.page ?? '1'))
  const search   = params.search ?? ''
  const idEtapa  = params.etapa ? parseInt(params.etapa) : undefined
  const uidRC    = params.rc ?? ''
  const Origen   = params.origen ?? ''

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const [{ leads, total }, filterOptions, perm322, perm323] = await Promise.all([
    getLeads({ search, idEtapa, uidRC: uidRC || undefined, Origen: Origen || undefined, page }),
    getLeadsFilterOptions(),
    authUser
      ? supabase.from('segModulosUsuarios').select('clave')
          .eq('uid', authUser.id).eq('clave', 322).eq('acceso', true).maybeSingle()
      : Promise.resolve({ data: null }),
    authUser
      ? supabase.from('segModulosUsuarios').select('clave')
          .eq('uid', authUser.id).eq('clave', 323).eq('acceso', true).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const canCreateLead    = !!perm322?.data
  const canCreatePreLead = !!perm323?.data

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Leads</h2>
          <p className="text-sm text-muted-foreground">Gestión del pipeline de prospectos</p>
        </div>

        {(canCreateLead || canCreatePreLead) && (
          <div className="flex items-center gap-2 shrink-0">
            {canCreateLead    && <NuevoLeadSheet />}
            {canCreatePreLead && <NuevoPreLeadSheet />}
          </div>
        )}
      </div>

      <Suspense>
        <LeadsTable
          leads={leads}
          total={total}
          page={page}
          pageSize={50}
          search={search}
          filterOptions={filterOptions}
          selectedEtapa={params.etapa ?? ''}
          selectedRC={uidRC}
          selectedOrigen={Origen}
        />
      </Suspense>
    </div>
  )
}
