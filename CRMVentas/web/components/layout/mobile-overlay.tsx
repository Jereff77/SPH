'use client'

import { useUiStore } from '@/lib/stores/ui.store'

export function MobileOverlay() {
  const { mobileSidebarOpen, closeMobileSidebar } = useUiStore()

  if (!mobileSidebarOpen) return null

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 md:hidden"
      onClick={closeMobileSidebar}
      aria-hidden
    />
  )
}
