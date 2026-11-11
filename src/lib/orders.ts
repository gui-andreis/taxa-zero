import type { Bindings, Course, Order, Settings, Student } from '../env'
import { sendEmail } from './email'
import { brl, DAY, now } from './format'
import { findPaymentByOrder, getPayment, refundPayment, type MpPayment } from './mercadopago'

export const getOrder = (db: D1Database, id: string) => db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Order>()
export const getCourse = (db: D1Database, id: number) => db.prepare('SELECT * FROM courses WHERE id = ?').bind(id).first<Course>()
export const getStudent = (db: D1Database, id: number) =>
  db.prepare('SELECT id, name, email FROM students WHERE id = ?').bind(id).first<Student>()

/** A ÚNICA regra de acesso: o aluno tem um pedido PAGO deste curso. Reembolso/contestação = sem acesso. */
export async function hasAccess(db: D1Database, studentId: number, courseId: number): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 FROM orders WHERE student_id = ? AND course_id = ? AND status = 'paid' LIMIT 1`)
    .bind(studentId, courseId)
    .first()
  return !!row
}

export function notificationUrl(baseUrl: string) {
  return baseUrl.startsWith('https://') ? `${baseUrl}/webhooks/mercadopago` : undefined
}

/** Marca como pago (só uma vez) e avisa aluno e vendedor por e-mail. */
export async function markPaid(env: Bindings, s: Settings, baseUrl: string, order: Order, providerId?: string) {
  const res = await env.DB.prepare(
    `UPDATE orders SET status = 'paid', paid_at = ?, provider_payment_id = COALESCE(?, provider_payment_id)
     WHERE id = ? AND status IN ('pending', 'awaiting_confirmation')`,
  )
    .bind(now(), providerId ?? null, order.id)
    .run()
  if (!res.meta.changes) return
  const [course, student] = await Promise.all([getCourse(env.DB, order.course_id), getStudent(env.DB, order.student_id)])
  if (!course || !student) return
  await Promise.all([
    sendEmail(
      s,
      student.email,
      `Seu acesso ao curso "${course.title}" está liberado!`,
      order.method === 'free'
        ? [
            `Oi, ${student.name.split(' ')[0]}! Seu cupom liberou o curso de graça.`,
            `Para assistir, entre com o e-mail ${student.email} e a senha que você criou.`,
          ]
        : [
            `Oi, ${student.name.split(' ')[0]}! Recebemos seu pagamento de ${brl(order.amount_cents)}.`,
            `Para assistir, entre com o e-mail ${student.email} e a senha que você criou na compra.`,
            `Você tem ${s.refund_days || 7} dias de garantia: se não gostar, peça o reembolso direto na área do aluno.`,
          ],
      { label: 'Acessar meu curso', url: `${baseUrl}/aluno` },
    ),
    sendEmail(s, s.seller_email, `Nova venda: ${course.title} (${brl(order.amount_cents)})`, [
      `${student.name} (${student.email}) comprou "${course.title}".`,
    ], { label: 'Ver no painel', url: `${baseUrl}/admin/pedidos` }),
  ])
}

async function setStatus(env: Bindings, orderId: string, status: string, extra = '') {
  await env.DB.prepare(`UPDATE orders SET status = ?${extra} WHERE id = ?`).bind(status, orderId).run()
}

/**
 * Aplica o status REAL de um pagamento do Mercado Pago ao pedido.
 * Confere que o pagamento é mesmo deste pedido e do valor certo (ninguém paga R$ 1 e leva o curso).
 */
export async function applyMpPayment(env: Bindings, s: Settings, baseUrl: string, order: Order, p: MpPayment) {
  if (p.external_reference !== order.id) return
  if (p.currency_id !== 'BRL' || Math.round(p.transaction_amount * 100) < order.amount_cents) return
  switch (p.status) {
    case 'approved':
      if (order.status === 'pending' || order.status === 'awaiting_confirmation') await markPaid(env, s, baseUrl, order, String(p.id))
      break
    case 'refunded':
      if (order.status !== 'refunded') await setStatus(env, order.id, 'refunded', `, refunded_at = ${now()}`)
      break
    case 'charged_back':
    case 'in_mediation':
      await setStatus(env, order.id, 'disputed')
      break
    case 'cancelled':
      if (order.status === 'pending') await setStatus(env, order.id, 'cancelled')
      break
  }
}

/** Pergunta ao Mercado Pago como está o pagamento (usado na tela do pedido e no webhook). */
export async function refreshFromMp(env: Bindings, s: Settings, baseUrl: string, order: Order) {
  if (order.method === 'pix_manual' || order.method === 'free' || !s.mp_access_token) return
  try {
    const p = order.provider_payment_id
      ? await getPayment(s.mp_access_token, order.provider_payment_id)
      : await findPaymentByOrder(s.mp_access_token, order.id)
    if (p) await applyMpPayment(env, s, baseUrl, order, p)
  } catch (err) {
    console.error('Erro consultando Mercado Pago', err)
  }
}

export function canStudentRefund(s: Settings, order: Order) {
  const days = Number(s.refund_days || 7)
  return order.status === 'paid' && order.method !== 'free' && !!order.paid_at && now() - order.paid_at <= days * DAY
}

/**
 * Reembolso.
 * - Mercado Pago: devolve o dinheiro automaticamente pela API e corta o acesso na hora.
 * - Pix manual: corta o acesso na hora e avisa o vendedor, que devolve o Pix pelo app do banco
 *   e depois clica em "Marcar como reembolsado".
 */
export async function refundOrder(env: Bindings, s: Settings, baseUrl: string, order: Order, by: 'student' | 'admin'): Promise<string | null> {
  const course = await getCourse(env.DB, order.course_id)
  const student = await getStudent(env.DB, order.student_id)
  if (order.method === 'free') {
    // Saiu de graça: não há dinheiro para devolver, só tira o acesso.
    await setStatus(env, order.id, 'refunded', `, refunded_at = ${now()}`)
  } else if (order.method !== 'pix_manual') {
    if (!s.mp_access_token) return 'Mercado Pago não está configurado.'
    let pid = order.provider_payment_id
    if (!pid) pid = (await findPaymentByOrder(s.mp_access_token, order.id))?.id?.toString() ?? null
    if (!pid) return 'Pagamento não encontrado no Mercado Pago.'
    try {
      await refundPayment(s.mp_access_token, pid)
    } catch (err) {
      console.error(err)
      return 'O Mercado Pago recusou o reembolso. Tente pelo app do Mercado Pago.'
    }
    await setStatus(env, order.id, 'refunded', `, refunded_at = ${now()}`)
    if (student && course)
      await sendEmail(s, student.email, `Reembolso feito: ${course.title}`, [
        `Seu reembolso de ${brl(order.amount_cents)} foi solicitado ao Mercado Pago. No Pix ele cai em instantes; no cartão aparece na fatura conforme o banco.`,
      ])
  } else if (by === 'student') {
    await setStatus(env, order.id, 'refund_requested')
    if (student && course)
      await sendEmail(s, s.seller_email, `Pedido de reembolso: ${course.title}`, [
        `${student.name} (${student.email}) pediu reembolso de ${brl(order.amount_cents)}. O acesso já foi bloqueado.`,
        'Devolva o Pix pelo app do seu banco (opção "devolver" no comprovante) e depois marque como reembolsado no painel.',
      ], { label: 'Abrir pedidos', url: `${baseUrl}/admin/pedidos` })
  } else {
    await setStatus(env, order.id, 'refunded', `, refunded_at = ${now()}`)
  }
  return null
}
