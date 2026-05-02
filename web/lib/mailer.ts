import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase/server'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('crm_config')
    .select('valor')
    .eq('id', 'smtp_notif')
    .single()

  if (!data?.valor) return null
  try {
    return JSON.parse(data.valor) as SmtpConfig
  } catch {
    return null
  }
}

export async function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })
}

export async function sendNotification(to: string, subject: string, html: string) {
  const config = await getSmtpConfig()
  if (!config) throw new Error('SMTP no configurado. Ve a Catálogos → Configuración.')

  const transport = await createTransport(config)
  await transport.sendMail({ from: config.from, to, subject, html })
}
