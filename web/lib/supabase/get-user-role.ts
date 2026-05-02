import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'

export async function getUserRole(supabase: SupabaseClient, uid: string): Promise<UserRole> {
  const { data } = await supabase
    .from('segModulosUsuarios')
    .select('clave')
    .eq('uid', uid)
    .eq('acceso', true)
    .in('clave', [325, 326])

  const claves = (data ?? []).map((r: { clave: number }) => r.clave)

  if (claves.includes(326)) return 'admin'
  if (claves.includes(325)) return 'gerente'
  return 'rc'
}

export async function getUserName(supabase: SupabaseClient, uid: string): Promise<string> {
  const { data } = await supabase
    .from('catUsers')
    .select('nombre')
    .eq('uid', uid)
    .single()

  return data?.nombre ?? 'Usuario'
}
