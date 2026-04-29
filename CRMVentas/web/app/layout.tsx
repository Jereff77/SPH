import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryProvider } from '@/lib/providers/query-provider'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'SPH CRM Ventas',
  description: 'Sistema de gestión de leads y pipeline comercial — SPH Bienes Raíces',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        <QueryProvider>
          <TooltipProvider delay={300}>
            {children}
            <Toaster position="top-right" richColors />
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
