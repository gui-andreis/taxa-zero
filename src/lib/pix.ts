import { renderSVG } from 'uqr'

/**
 * Gera o "Pix Copia e Cola" (BR Code estático, padrão EMV do Banco Central).
 * Funciona com qualquer banco (Nubank, Inter, Itaú, Caixa...): o dinheiro cai direto na chave do vendedor.
 * Não precisa de API nem de conta especial, mas o banco não avisa o site quando o Pix é pago,
 * por isso o vendedor confirma o pedido no painel.
 */
function field(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

/** Remove acentos e caracteres fora do padrão do BR Code. */
function sanitize(s: string, max: number): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, '')
    .trim()
    .slice(0, max)
}

export function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Normaliza a chave: telefone vira +55..., CPF/CNPJ só números, e-mail minúsculo, aleatória como está. */
export function normalizePixKey(key: string): string {
  const k = key.trim()
  if (k.includes('@')) return k.toLowerCase()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase()
  const digits = k.replace(/\D/g, '')
  if (k.startsWith('+')) return `+${digits}`
  // Celular escrito do jeito comum, "(11) 98765-4321" ou "11 98765-4321": vira +55. CPF formatado usa pontos.
  if (!k.includes('.') && /[()\s]/.test(k) && (digits.length === 10 || digits.length === 11)) return `+55${digits}`
  // 11 dígitos é ambíguo (CPF ou celular). Tratamos como CPF; celular deve ser cadastrado com +55.
  return digits || k
}

export function buildPixPayload(opts: { key: string; name: string; city: string; amountCents: number; txid: string }): string {
  const gui = field('00', 'br.gov.bcb.pix') + field('01', normalizePixKey(opts.key))
  const txid = opts.txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const payload =
    field('00', '01') +
    field('26', gui) +
    field('52', '0000') +
    field('53', '986') +
    field('54', (opts.amountCents / 100).toFixed(2)) +
    field('58', 'BR') +
    field('59', sanitize(opts.name, 25) || 'VENDEDOR') +
    field('60', sanitize(opts.city, 15) || 'BRASIL') +
    field('62', field('05', txid)) +
    '6304'
  return payload + crc16(payload)
}

export function qrSvg(data: string): string {
  return renderSVG(data, { pixelSize: 6, border: 2 })
}
