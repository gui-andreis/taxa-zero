import { hmacSha256Hex, safeEqual } from './crypto'

/**
 * Integração com o Mercado Pago, usando a conta do PRÓPRIO vendedor.
 * O dinheiro cai na conta Mercado Pago dele. O número do cartão nunca passa por este site:
 * o cartão é digitado na página segura do Mercado Pago (Checkout Pro).
 */
const API = 'https://api.mercadopago.com'

export type MpPayment = {
  id: number
  status: string // approved, pending, in_process, rejected, cancelled, refunded, charged_back, in_mediation
  status_detail?: string
  transaction_amount: number
  currency_id: string
  external_reference: string | null
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } }
}

async function mp<T>(token: string, path: string, init: RequestInit = {}, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey
  const res = await fetch(API + path, { ...init, headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text) as T
}

export function createPixPayment(
  token: string,
  o: { orderId: string; amountCents: number; description: string; email: string; name: string; notificationUrl?: string },
) {
  return mp<MpPayment>(
    token,
    '/v1/payments',
    {
      method: 'POST',
      body: JSON.stringify({
        transaction_amount: o.amountCents / 100,
        description: o.description.slice(0, 200),
        payment_method_id: 'pix',
        external_reference: o.orderId,
        notification_url: o.notificationUrl,
        date_of_expiration: new Date(Date.now() + 24 * 3600 * 1000).toISOString().replace('Z', '-00:00'),
        payer: { email: o.email, first_name: o.name.split(' ')[0] },
      }),
    },
    `pix-${o.orderId}`,
  )
}

export async function createCardCheckout(
  token: string,
  o: { orderId: string; amountCents: number; title: string; email: string; name: string; baseUrl: string; notificationUrl?: string; maxInstallments: number },
) {
  const back = `${o.baseUrl}/pedido/${o.orderId}`
  const pref = await mp<{ id: string; init_point: string }>(token, '/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ id: o.orderId, title: o.title.slice(0, 250), quantity: 1, unit_price: o.amountCents / 100, currency_id: 'BRL' }],
      payer: { email: o.email, name: o.name },
      external_reference: o.orderId,
      notification_url: o.notificationUrl,
      back_urls: { success: back, pending: back, failure: back },
      auto_return: 'approved',
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
        installments: Math.max(1, Math.min(12, o.maxInstallments)),
      },
    }),
  })
  return pref.init_point
}

export function getPayment(token: string, id: string | number) {
  return mp<MpPayment>(token, `/v1/payments/${encodeURIComponent(String(id))}`)
}

/** Procura o pagamento mais recente de um pedido (usado no cartão, onde o ID só aparece depois). */
export async function findPaymentByOrder(token: string, orderId: string): Promise<MpPayment | null> {
  const r = await mp<{ results: MpPayment[] }>(
    token,
    `/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc`,
  )
  const list = r.results ?? []
  return list.find((p) => p.status === 'approved') ?? list[0] ?? null
}

export function refundPayment(token: string, id: string | number) {
  return mp<unknown>(token, `/v1/payments/${encodeURIComponent(String(id))}/refunds`, { method: 'POST', body: '{}' }, `refund-${id}`)
}

/**
 * Confere a assinatura do webhook (x-signature), quando o vendedor configurou a "assinatura secreta".
 * Mesmo sem ela o site é seguro: nunca confiamos no conteúdo do aviso; sempre perguntamos
 * ao Mercado Pago o status real do pagamento.
 */
export async function validWebhookSignature(secret: string, xSignature: string | undefined, xRequestId: string | undefined, dataId: string) {
  if (!xSignature) return false
  const parts = Object.fromEntries(xSignature.split(',').map((p) => p.trim().split('=') as [string, string]))
  if (!parts.ts || !parts.v1) return false
  let manifest = `id:${dataId.toLowerCase()};`
  if (xRequestId) manifest += `request-id:${xRequestId};`
  manifest += `ts:${parts.ts};`
  return safeEqual(await hmacSha256Hex(secret, manifest), parts.v1)
}
