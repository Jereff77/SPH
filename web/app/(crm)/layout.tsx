import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileOverlay } from '@/components/layout/mobile-overlay'
import { RealtimeNotifications } from '@/components/layout/realtime-notifications'
import { SessionHydrator } from '@/components/layout/session-hydrator'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/get-user-role'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user: sbUser } } = await supabase.auth.getUser()

  const [{ count }, permConfig] = await Promise.all([
    supabase.from('leads_porAprobar').select('*', { count: 'exact', head: true }).eq('status', true),
    sbUser
      ? supabase.from('segModulosUsuarios').select('clave')
          .eq('uid', sbUser.id).eq('clave', 340).eq('acceso', true).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const role = sbUser ? await getUserRole(supabase, sbUser.id) : 'rc'
  const isAdmin   = role === 'admin'
  const canConfig = !!permConfig?.data
  const pendingCount = count ?? 0

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <MobileOverlay />
      <Sidebar pendingCount={pendingCount} isAdmin={isAdmin} canConfig={canConfig} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {children}
        </main>
        <RealtimeNotifications />
        <SessionHydrator />
      </div>
    </div>
  )
}
