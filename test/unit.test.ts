import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPixPayload, crc16 } from '../src/lib/pix.ts'
import { parseBRL, slugify } from '../src/lib/format.ts'
import { markdown } from '../src/lib/markdown.ts'
import { hashPassword, verifyPassword } from '../src/lib/crypto.ts'

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
