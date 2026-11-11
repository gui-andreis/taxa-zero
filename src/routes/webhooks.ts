import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { getPayment, validWebhookSignature } from '../lib/mercadopago'
import { applyMpPayment, getOrder } from '../lib/orders'
import { origin } from './public'

/**
 * Aviso automático do Mercado Pago ("webhook"): é GRÁTIS, faz parte da conta do vendedor.
 * Segurança: não confiamos no que vem no aviso. Pegamos só o ID e perguntamos ao Mercado Pago
 * (com o token secreto do vendedor) qual é o status real. Um aviso falso não libera nada.
 */
const app = new Hono<AppEnv>()

app.post('/mercadopago', async (c) => {
  const s = c.get('settings')
  if (!s.mp_access_token) return c.text('not configured', 200)

  const body = (await c.req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } }
  const type = body.type ?? c.req.query('type') ?? c.req.query('topic')
  const id = String(body.data?.id ?? c.req.query('data.id') ?? c.req.query('id') ?? '')
  if (type !== 'payment' || !/^\d+$/.test(id)) return c.text('ignored', 200)

  if (s.mp_webhook_secret) {
    const ok = await validWebhookSignature(s.mp_webhook_secret, c.req.header('x-signature'), c.req.header('x-request-id'), c.req.query('data.id') ?? id)
    if (!ok) return c.text('invalid signature', 401)
  }

  try {
    const payment = await getPayment(s.mp_access_token, id)
    if (!payment.external_reference) return c.text('ok', 200)
    const order = await getOrder(c.env.DB, payment.external_reference)
    if (order) await applyMpPayment(c.env, s, origin(c), order, payment)
  } catch (err) {
    console.error('Webhook Mercado Pago', err)
    return c.text('retry', 500) // o Mercado Pago tenta de novo depois
  }
  return c.text('ok', 200)
})

export default app
