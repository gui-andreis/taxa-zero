export function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "97", "97,90", "1.297,90", "R$ 97,90" -> centavos. Retorna null se inválido. */
export function parseBRL(input: string): number | null {
  const clean = input.replace(/[R$\s]/g, '')
  if (!clean) return null
  let normalized = clean
  if (clean.includes(',')) normalized = clean.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

export function dateBR(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export const now = () => Date.now()
export const DAY = 24 * 60 * 60 * 1000

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 200
}

export function isHexColor(s: string) {
  return /^#[0-9a-fA-F]{6}$/.test(s)
}

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando pagamento',
  awaiting_confirmation: 'Confirmar Pix',
  paid: 'Pago',
  refund_requested: 'Reembolso pedido',
  refunded: 'Reembolsado',
  disputed: 'Contestado',
  cancelled: 'Cancelado',
}

export const METHOD_LABEL: Record<string, string> = {
  pix_manual: 'Pix (manual)',
  mp_pix: 'Pix (automático)',
  mp_card: 'Cartão',
}
