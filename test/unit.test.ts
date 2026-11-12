import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPixPayload, crc16, isValidPixKey, normalizePixKey } from '../src/lib/pix.ts'
import { parseBRL, slugify } from '../src/lib/format.ts'
import { markdown } from '../src/lib/markdown.ts'
import { hashPassword, verifyPassword } from '../src/lib/crypto.ts'
import { discountFor, isValidCode, normalizeCode, parseLocalDateTime, toLocalDateTime } from '../src/lib/coupons.ts'

test('Pix: exemplo oficial do Banco Central', () => {
  const body =
    '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'
  assert.equal(crc16(body), '1D3D')
})

test('Pix: payload com valor e txid', () => {
  const p = buildPixPayload({ key: 'Loja@Exemplo.com', name: 'João da Silva', city: 'São Paulo', amountCents: 9790, txid: 'abc123' })
  assert.match(p, /0116loja@exemplo\.com/)
  assert.match(p, /540597\.90/)
  assert.match(p, /5913Joao da Silva/)
  assert.match(p, /6009Sao Paulo/)
  assert.match(p, /62100506abc123/)
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)))
})

test('preço em reais', () => {
  assert.equal(parseBRL('97'), 9700)
  assert.equal(parseBRL('97,90'), 9790)
  assert.equal(parseBRL('R$ 1.297,90'), 129790)
  assert.equal(parseBRL('97.5'), 9750)
  assert.equal(parseBRL('abc'), null)
})

test('slug', () => assert.equal(slugify('Curso de Programação: do Zero!'), 'curso-de-programacao-do-zero'))

test('markdown escapa HTML', () => {
  const html = markdown('<script>alert(1)</script> **oi** [x](javascript:alert(1))')
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('href="javascript'))
  assert.ok(html.includes('<strong>oi</strong>'))
})

test('senha', async () => {
  const h = await hashPassword('minha-senha-123')
  assert.ok(await verifyPassword('minha-senha-123', h))
  assert.ok(!(await verifyPassword('errada', h)))
})

test('cupom: desconto em % e em R$, nunca passa do preço', () => {
  assert.equal(discountFor({ kind: 'percent', value: 20 }, 19700), 3940)
  assert.equal(discountFor({ kind: 'percent', value: 100 }, 19700), 19700)
  assert.equal(discountFor({ kind: 'fixed', value: 3000 }, 19700), 3000)
  assert.equal(discountFor({ kind: 'fixed', value: 50000 }, 19700), 19700)
})

test('cupom: código normalizado e datas no horário de Brasília', () => {
  assert.equal(normalizeCode('  black friday '), 'BLACKFRIDAY')
  assert.ok(isValidCode('ALUNO-10'))
  assert.ok(!isValidCode('AÇÃO'))
  assert.ok(!isValidCode('AB'))
  const t = parseLocalDateTime('2026-11-30T23:59')
  assert.equal(t, Date.parse('2026-12-01T02:59:00Z'))
  assert.equal(toLocalDateTime(t), '2026-11-30T23:59')
  assert.equal(parseLocalDateTime('30/11/2026'), null)
})

test('Pix: celular escrito do jeito comum vira +55', () => {
  assert.equal(normalizePixKey('(11) 98765-4321'), '+5511987654321')
  assert.equal(normalizePixKey('11 98765-4321'), '+5511987654321')
  assert.equal(normalizePixKey('123.456.789-09'), '12345678909')
  assert.equal(normalizePixKey('+55 11 98765-4321'), '+5511987654321')
  assert.equal(normalizePixKey('Fulano@Exemplo.com'), 'fulano@exemplo.com')
})

test('chave Pix: aceita formatos válidos e recusa lixo', () => {
  for (const k of ['ana@exemplo.com', '12345678901', '12345678000199', '+5511987654321', '123e4567-e89b-12d3-a456-426614174000'])
    assert.ok(isValidPixKey(normalizePixKey(k)), k)
  for (const k of ['abc', '123', '+1555123', 'ana@', '1234567890123456']) assert.ok(!isValidPixKey(normalizePixKey(k)), k)
})

test('preço com ponto de milhar e sem centavos', () => {
  assert.equal(parseBRL('1.297'), 129700)
  assert.equal(parseBRL('12.500'), 1250000)
  assert.equal(parseBRL('1.29'), 129)
})
