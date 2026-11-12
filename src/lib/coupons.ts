import type { Course } from '../env'
import { brl, now } from './format.ts'

/**
 * Cupons de desconto.
 * - percent: value = porcentagem (1 a 100)
 * - fixed:   value = centavos a descontar
 * Um cupom pode valer para todos os cursos (course_id NULL) ou só para um.
 */
export type Coupon = {
  id: number
  code: string
  kind: 'percent' | 'fixed'
  value: number
  course_id: number | null
  max_uses: number | null
  once_per_student: number
  starts_at: number | null
  expires_at: number | null
  active: number
  created_at: number
}

export type CouponState = 'active' | 'paused' | 'scheduled' | 'expired' | 'exhausted'

export const COUPON_STATE_LABEL: Record<CouponState, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  scheduled: 'Agendado',
  expired: 'Expirado',
  exhausted: 'Esgotado',
}

/** Pedidos que "gastaram" o cupom. Reembolsados e cancelados devolvem o uso. */
const USED = `('paid','awaiting_confirmation','refund_requested','disputed')`
/** Pix gerado há pouco também segura o cupom (evita várias pessoas usarem a última unidade ao mesmo tempo). */
const HOLD_MS = 2 * 60 * 60 * 1000

export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '')
export const isValidCode = (s: string) => /^[A-Z0-9_-]{3,30}$/.test(s)

export function describeDiscount(c: Pick<Coupon, 'kind' | 'value'>) {
  return c.kind === 'percent' ? `${c.value}% de desconto` : `${brl(c.value)} de desconto`
}
export const shortDiscount = (c: Pick<Coupon, 'kind' | 'value'>) => (c.kind === 'percent' ? `−${c.value}%` : `−${brl(c.value)}`)

/** Quanto o cupom tira deste preço (nunca mais que o preço). */
export function discountFor(c: Pick<Coupon, 'kind' | 'value'>, priceCents: number) {
  const d = c.kind === 'percent' ? Math.round((priceCents * Math.min(100, Math.max(0, c.value))) / 100) : c.value
  return Math.max(0, Math.min(priceCents, d))
}

export function couponState(c: Coupon, uses: number, t = now()): CouponState {
  if (!c.active) return 'paused'
  if (c.expires_at && t > c.expires_at) return 'expired'
  if (c.starts_at && t < c.starts_at) return 'scheduled'
  if (c.max_uses != null && uses >= c.max_uses) return 'exhausted'
  return 'active'
}

/** Usos do cupom. O Pix em aberto do próprio aluno não conta contra ele. */
export async function couponUses(db: D1Database, couponId: number, exceptStudentId: number | null = null) {
  const r = await db
    .prepare(
      `SELECT COUNT(*) n FROM orders WHERE coupon_id = ?
       AND (status IN ${USED} OR (status = 'pending' AND created_at > ? AND student_id != ?))`,
    )
    .bind(couponId, now() - HOLD_MS, exceptStudentId ?? -1)
    .first<{ n: number }>()
  return r?.n ?? 0
}

export const findCoupon = (db: D1Database, code: string) =>
  db.prepare('SELECT * FROM coupons WHERE code = ?').bind(normalizeCode(code)).first<Coupon>()

export type CouponCheck =
  | { ok: true; coupon: Coupon; discount: number; final: number }
  | { ok: false; error: string }

/** Confere se o cupom pode ser usado agora, neste curso, por este aluno. */
export async function checkCoupon(db: D1Database, rawCode: string, course: Course, studentId: number | null): Promise<CouponCheck> {
  const code = normalizeCode(rawCode)
  if (!code) return { ok: false, error: 'Digite o código do cupom.' }
  const coupon = isValidCode(code) ? await findCoupon(db, code) : null
  if (!coupon) return { ok: false, error: `Não encontramos o cupom “${code}”. Confira se digitou certo.` }
  if (coupon.course_id && coupon.course_id !== course.id) return { ok: false, error: `O cupom ${code} não vale para este curso.` }
  const state = couponState(coupon, await couponUses(db, coupon.id, studentId))
  if (state === 'paused') return { ok: false, error: `O cupom ${code} não está disponível no momento.` }
  if (state === 'expired') return { ok: false, error: `O cupom ${code} expirou.` }
  if (state === 'scheduled') return { ok: false, error: `O cupom ${code} ainda não começou a valer.` }
  if (state === 'exhausted') return { ok: false, error: `O cupom ${code} esgotou.` }
  if (studentId && coupon.once_per_student) {
    const used = await db
      .prepare(`SELECT 1 FROM orders WHERE coupon_id = ? AND student_id = ? AND status IN ${USED} LIMIT 1`)
      .bind(coupon.id, studentId)
      .first()
    if (used) return { ok: false, error: `Você já usou o cupom ${code}.` }
  }
  let discount = discountFor(coupon, course.price_cents)
  // Valor mínimo de cobrança é R$ 1,00: um desconto que deixaria centavos fica limitado.
  if (course.price_cents - discount > 0 && course.price_cents - discount < 100) discount = Math.max(0, course.price_cents - 100)
  return { ok: true, coupon, discount, final: course.price_cents - discount }
}

// ── datas no fuso de Brasília (o campo datetime-local não tem fuso) ──
const BR_OFFSET = '-03:00'
export function parseLocalDateTime(v: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null
  const t = Date.parse(`${v}:00${BR_OFFSET}`)
  return Number.isFinite(t) ? t : null
}
export function toLocalDateTime(ts: number | null | undefined) {
  if (!ts) return ''
  return new Date(ts - 3 * 60 * 60 * 1000).toISOString().slice(0, 16)
}
