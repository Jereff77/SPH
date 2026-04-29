import { NextResponse } from 'next/server'
import { createTransport, type SmtpConfig } from '@/lib/mailer'

export async function POST(request: Request) {
  try {
    const config: SmtpConfig = await request.json()
    const transport = await createTransport(config)
    await transport.verify()
    return NextResponse.json({ ok: true, mensaje: 'Conexión SMTP exitosa.' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error de conexión'
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }
}
