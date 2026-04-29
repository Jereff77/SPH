import { createClient } from '@/lib/supabase/client'

export interface LeadFormCatalog {
  id: number
  titulo: string
}

export interface RcOption {
  uid: string
  nombre: string
}

export interface LeadFormCatalogs {
  origenes: LeadFormCatalog[]
  tiposCliente: LeadFormCatalog[]
  tiposOperacion: LeadFormCatalog[]
  tiposVenta: LeadFormCatalog[]
  etapas: (LeadFormCatalog & { orden: number })[]
  campanias: LeadFormCatalog[]
  rcs: RcOption[]
}

export async function getLeadFormCatalogs(): Promise<LeadFormCatalogs> {
  const supabase = createClient()

  const [origenes, tiposCliente, tiposOperacion, tiposVenta, etapas, campanias, rcs] = await Promise.all([
    supabase.from('crm_Origen').select('id, titulo').eq('status', true).order('titulo'),
    supabase.from('crm_tipoCliente').select('id, titulo').eq('status', true).order('titulo'),
    supabase.from('crm_tipoOperaciones').select('id, titulo').eq('status', true).order('titulo'),
    supabase.from('crm_tipoVenta').select('id, titulo').eq('status', true).order('titulo'),
    supabase.from('crm_Etapas').select('id, titulo, orden').eq('status', true).order('orden'),
    supabase.from('crm_campania').select('id, titulo').eq('status', true).order('titulo'),
    supabase.from('catUsers').select('uid, nombre').order('nombre'),
  ])

  return {
    origenes:      (origenes.data      ?? []) as LeadFormCatalog[],
    tiposCliente:  (tiposCliente.data  ?? []) as LeadFormCatalog[],
    tiposOperacion:(tiposOperacion.data?? []) as LeadFormCatalog[],
    tiposVenta:    (tiposVenta.data    ?? []) as LeadFormCatalog[],
    etapas:        (etapas.data        ?? []) as (LeadFormCatalog & { orden: number })[],
    campanias:     (campanias.data     ?? []) as LeadFormCatalog[],
    rcs:           (rcs.data           ?? []) as RcOption[],
  }
}
