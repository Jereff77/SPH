import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/mailer'

export async function POST(request: Request) {
  try {
    const { leadId, tipo, autorizadorNombre, motivo } = await request.json()

    const supabase = await createClient()

    // Obtener datos del lead y del registrante
    const { data: lead } = await supabase
      .from('leads_porAprobar')
      .select('nombreLead, uidr')
      .eq('id', leadId)
      .single()

    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

    // Buscar email del registrante
    const { data: registrante } = await supabase
      .from('catUsers')
      .select('correo, nomCompleto')
      .eq('uid', lead.uidr)
      .single()

    if (!registrante?.correo) {
      return NextResponse.json({ error: 'Registrante sin correo configurado' }, { status: 400 })
    }

    const nombre = lead.nombreLead ?? 'Sin nombre'
    let subject: string
    let html: string

    if (tipo === 'aprobado') {
      subject = `✅ Lead aprobado: ${nombre}`
      html = `
        <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <div style="background: #2C2C2C; padding: 20px 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: #C9963A; margin: 0; font-size: 18px;">SPH CRM Ventas</h2>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e2e2e2; border-top: none; border-radius: 0 0 12px 12px;">
            <h3 style="color: #2C2C2C; margin-top: 0;">Lead aprobado ✅</h3>
            <p>Hola <strong>${registrante.nomCompleto ?? 'asesor'}</strong>,</p>
            <p>El lead <strong>${nombre}</strong> que registraste fue <strong style="color: #43A047;">aprobado</strong> por <strong>${autorizadorNombre}</strong> y ya está en el pipeline de ventas.</p>
            <p style="color: #6B6B6B; font-size: 14px;">Puedes dar seguimiento desde el CRM en la sección de Leads.</p>
          </div>
        </div>`
    } else {
      subject = `❌ Lead rechazado: ${nombre}`
      html = `
        <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <div style="background: #2C2C2C; padding: 20px 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: #C9963A; margin: 0; font-size: 18px;">SPH CRM Ventas</h2>
          </div>
          <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e2e2e2; border-top: none; border-radius: 0 0 12px 12px;">
            <h3 style="color: #2C2C2C; margin-top: 0;">Lead rechazado ❌</h3>
            <p>Hola <strong>${registrante.nomCompleto ?? 'asesor'}</strong>,</p>
            <p>El lead <strong>${nombre}</strong> que registraste fue <strong style="color: #E53935;">rechazado</strong> por <strong>${autorizadorNombre}</strong>.</p>
            ${motivo ? `<div style="background: #fff3f3; border-left: 4px solid #E53935; padding: 12px 16px; margin: 16px 0; border-radius: 4px;"><strong>Motivo:</strong><br/>${motivo}</div>` : ''}
            <p style="color: #6B6B6B; font-size: 14px;">Si tienes dudas, contacta a tu supervisor.</p>
          </div>
        </div>`
    }

    await sendNotification(registrante.correo, subject, html)
    return NextResponse.json({ ok: true })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
