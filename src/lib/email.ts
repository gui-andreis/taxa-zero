import type { Settings } from '../env'
import { emailReady } from './settings'
import { escapeHtml } from './markdown'

/**
 * E-mails via Resend (plano grátis: 3.000 e-mails/mês). Se não estiver configurado, o envio é ignorado
 * e o site continua funcionando normalmente (o aluno vê tudo na tela).
 */
export async function sendEmail(s: Settings, to: string, subject: string, paragraphs: string[], button?: { label: string; url: string }) {
  if (!emailReady(s) || !to) return false
  const accent = s.accent_color || '#6d4aff'
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(p)}</p>`).join('')
  const btn = button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(button.url)}" style="background:${accent};color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>`
    : ''
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a2e">
    <p style="font-weight:700;font-size:18px;margin:0 0 20px">${escapeHtml(s.store_name)}</p>${body}${btn}
    <p style="color:#888;font-size:12px;margin-top:32px">${escapeHtml(s.support_contact || '')}</p></div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.resend_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${s.store_name} <${s.email_from}>`, to: [to], subject, html }),
    })
    if (!res.ok) console.error('Falha ao enviar e-mail', res.status, await res.text())
    return res.ok
  } catch (err) {
    console.error('Erro ao enviar e-mail', err)
    return false
  }
}
