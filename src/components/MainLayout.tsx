import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ChatPage } from './ChatPage'
import { ConfigPage } from './ConfigPage'
import { supabase } from '../lib/supabase'

type Tab = 'chat' | 'config'

interface Props {
  user: User
}

export function MainLayout({ user }: Props) {
  const [tab, setTab] = useState<Tab>('chat')

  const logout = () => supabase.auth.signOut()

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Barra superior */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0">
        {/* Logo + tabs */}
        <div className="flex items-center gap-6">
          <img src="/logo.jpg" alt="SPH" className="h-8 object-contain" />
          <nav className="flex gap-1">
            <TabBtn active={tab === 'chat'} onClick={() => setTab('chat')}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Chat
            </TabBtn>
            <TabBtn active={tab === 'config'} onClick={() => setTab('config')}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Config
            </TabBtn>
          </nav>
        </div>

        {/* Usuario + logout */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:block truncate max-w-[160px]">{user.email}</span>
          <button
            onClick={logout}
            className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Salir
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-hidden flex">
        {tab === 'chat' ? <ChatPage user={user} /> : <ConfigPage />}
      </main>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}
