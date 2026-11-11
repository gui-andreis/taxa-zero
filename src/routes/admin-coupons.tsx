import type { Context, Hono } from 'hono'
import type { AppEnv, Course } from '../env'
import { AdminLayout, Flash } from '../views/layout'
import { brl, dateBR, now, parseBRL } from '../lib/format'
import { randomId } from '../lib/crypto'
import {
  COUPON_STATE_LABEL,
  couponState,
  couponUses,
  describeDiscount,
  isValidCode,
  normalizeCode,
  parseLocalDateTime,
  shortDiscount,
  toLocalDateTime,
  type Coupon,
  type CouponState,
} from '../lib/coupons'
import { origin } from './public'

type C = Context<AppEnv>
type Row = Coupon & { course_title: string | null; course_slug: string | null; uses: number; revenue: number; discounts: number }

const STATE_BADGE: Record<CouponState, string> = { active: 'ok', paused: '', scheduled: 'warn', expired: 'bad', exhausted: 'bad' }

const coursesList = (c: C) => c.env.DB.prepare('SELECT id, title, slug, price_cents FROM courses ORDER BY created_at DESC').all<Course>()

function suggestCode() {
  return 'PROMO' + randomId().replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase()
}

function CouponForm({ v, courses, error, isNew }: { v: Partial<Coupon>; courses: Course[]; error?: string; isNew: boolean }) {
  const valueText = v.value == null ? '' : v.kind === 'fixed' ? (v.value / 100).toFixed(2).replace('.', ',') : String(v.value)
  return (
    <form method="post" class="stack" style="max-width:760px">
      <Flash msg={error} kind="bad" />
      <fieldset>
        <legend>Cupom</legend>
        <div class="grid g2">
          <div class="field">
            <label for="code">Código</label>
            <input id="code" name="code" required maxlength={30} value={v.code} style="text-transform:uppercase;font-family:'JetBrains Mono',ui-monospace,monospace" />
            <div class="hint">O que o aluno digita. Letras, números, - e _ (3 a 30). Ex.: BLACKFRIDAY, ALUNO10.</div>
          </div>
          <div class="field">
            <label for="course_id">Vale para</label>
            <select id="course_id" name="course_id">
              <option value="">Todos os cursos</option>
              {courses.map((co) => (
                <option value={String(co.id)} selected={v.course_id === co.id}>
                  {co.title} ({brl(co.price_cents)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div class="grid g2" style="margin-top:16px">
          <div class="field">
            <label for="kind">Tipo de desconto</label>
            <select id="kind" name="kind">
              <option value="percent" selected={v.kind !== 'fixed'}>
                Porcentagem (%)
              </option>
              <option value="fixed" selected={v.kind === 'fixed'}>
                Valor fixo (R$)
              </option>
            </select>
          </div>
          <div class="field">
            <label for="value">Desconto</label>
            <input id="value" name="value" required inputmode="decimal" value={valueText} placeholder="Ex.: 20 (para 20%) ou 30,00 (para R$ 30)" />
            <div class="hint">100% ou um valor maior que o preço deixa o curso de graça (bom para dar cortesia).</div>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Regras</legend>
        <div class="grid g2">
          <div class="field">
            <label for="starts_at">Começa a valer em (opcional)</label>
            <input id="starts_at" name="starts_at" type="datetime-local" value={toLocalDateTime(v.starts_at)} />
          </div>
          <div class="field">
            <label for="expires_at">Expira em (opcional)</label>
            <input id="expires_at" name="expires_at" type="datetime-local" value={toLocalDateTime(v.expires_at)} />
            <div class="hint">Horário de Brasília. Em branco = não expira.</div>
          </div>
        </div>
        <div class="field" style="margin-top:16px;max-width:360px">
          <label for="max_uses">Limite de usos (opcional)</label>
          <input id="max_uses" name="max_uses" type="number" min={1} max={1000000} value={v.max_uses == null ? '' : String(v.max_uses)} placeholder="Ilimitado" />
          <div class="hint">Ex.: 50 = só as 50 primeiras compras. Reembolsos devolvem o uso.</div>
        </div>
        <label class="check" style="margin-top:16px">
          <input type="checkbox" name="once_per_student" value="1" checked={v.once_per_student !== 0} />
          <span>Cada aluno só pode usar uma vez</span>
        </label>
        <label class="check" style="margin-top:10px">
          <input type="checkbox" name="active" value="1" checked={v.active !== 0} />
          <span>Ativo (desmarque para pausar sem apagar)</span>
        </label>
      </fieldset>

      <div class="row">
        <button class="btn lg" type="submit">
          {isNew ? 'Criar cupom' : 'Salvar cupom'}
        </button>
        <a class="btn ghost lg" href="/admin/cupons">
          Voltar
        </a>
      </div>
    </form>
  )
}

async function readCouponForm(c: C, id?: number): Promise<{ v: Partial<Coupon>; error?: string }> {
  const f = await c.req.parseBody()
  const str = (k: string) => String(f[k] ?? '').trim()
  const kind = str('kind') === 'fixed' ? 'fixed' : 'percent'
  const rawStart = str('starts_at')
  const rawEnd = str('expires_at')
  const v: Partial<Coupon> = {
    code: normalizeCode(str('code')),
    kind,
    course_id: Number(str('course_id')) || null,
    max_uses: str('max_uses') ? Math.floor(Number(str('max_uses'))) : null,
    once_per_student: f.once_per_student === '1' ? 1 : 0,
    active: f.active === '1' ? 1 : 0,
    starts_at: rawStart ? parseLocalDateTime(rawStart) : null,
    expires_at: rawEnd ? parseLocalDateTime(rawEnd) : null,
  }
  const rawValue = str('value').replace('%', '').trim()
  if (kind === 'percent') {
    const n = Number(rawValue.replace(',', '.'))
    v.value = Number.isInteger(n) ? n : NaN
  } else v.value = parseBRL(rawValue) ?? NaN

  if (!isValidCode(v.code!)) return { v, error: 'Código inválido. Use de 3 a 30 letras, números, - ou _ (sem espaços nem acentos).' }
  if (kind === 'percent' && !(v.value! >= 1 && v.value! <= 100)) return { v, error: 'A porcentagem precisa ser um número inteiro de 1 a 100.' }
  if (kind === 'fixed' && !(v.value! >= 1)) return { v, error: 'Informe um valor de desconto válido, por exemplo 30,00.' }
  if (v.max_uses != null && !(v.max_uses >= 1 && v.max_uses <= 1_000_000)) return { v, error: 'O limite de usos precisa ser pelo menos 1 (ou deixe em branco).' }
  if (rawStart && v.starts_at == null) return { v, error: 'Data de início inválida.' }
  if (rawEnd && v.expires_at == null) return { v, error: 'Data de expiração inválida.' }
  if (v.starts_at && v.expires_at && v.expires_at <= v.starts_at) return { v, error: 'A data de expiração precisa ser depois do início.' }
  if (v.course_id && !(await c.env.DB.prepare('SELECT 1 FROM courses WHERE id = ?').bind(v.course_id).first())) v.course_id = null
  const dup = await c.env.DB.prepare('SELECT id FROM coupons WHERE code = ? AND id != ?').bind(v.code!, id ?? 0).first()
  if (dup) return { v, error: `Já existe um cupom ${v.code}.` }
  return { v }
}

export function registerCoupons(app: Hono<AppEnv>) {
  app.get('/cupons', async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT k.*, co.title course_title, co.slug course_slug,
         (SELECT COUNT(*) FROM orders o WHERE o.coupon_id = k.id AND o.status IN ('paid','awaiting_confirmation','refund_requested','disputed')) uses,
         (SELECT COALESCE(SUM(o.amount_cents),0) FROM orders o WHERE o.coupon_id = k.id AND o.status = 'paid') revenue,
         (SELECT COALESCE(SUM(o.discount_cents),0) FROM orders o WHERE o.coupon_id = k.id AND o.status = 'paid') discounts
       FROM coupons k LEFT JOIN courses co ON co.id = k.course_id ORDER BY k.created_at DESC`,
    ).all<Row>()
    const base = origin(c)
    const t = now()
    const withState = await Promise.all(
      results.map(async (r) => ({ ...r, state: couponState(r, r.max_uses != null ? await couponUses(c.env.DB, r.id) : r.uses, t) })),
    )
    const active = withState.filter((r) => r.state === 'active').length
    const sales = withState.reduce((n, r) => n + r.uses, 0)
    const revenue = withState.reduce((n, r) => n + r.revenue, 0)
    const discounts = withState.reduce((n, r) => n + r.discounts, 0)

    return c.html(
      <AdminLayout title="Cupons" s={c.get('settings')} active="/admin/cupons">
        <div class="page-head">
          <div>
            <h1>Cupons</h1>
            <p class="muted" style="margin:6px 0 0">Descontos com código, validade e limite de usos.</p>
          </div>
          <a class="btn" href="/admin/cupons/novo">
            + Novo cupom
          </a>
        </div>
        <Flash msg={c.req.query('ok')} />
        <Flash msg={c.req.query('erro')} kind="bad" />
        {withState.length ? (
          <>
            <div class="grid g4" style="margin-bottom:22px">
              <div class="card kpi">
                <div class="label">Cupons ativos</div>
                <div class="value">{active}</div>
              </div>
              <div class="card kpi">
                <div class="label">Vendas com cupom</div>
                <div class="value">{sales}</div>
              </div>
              <div class="card kpi">
                <div class="label">Faturado com cupom</div>
                <div class="value">{brl(revenue)}</div>
              </div>
              <div class="card kpi">
                <div class="label">Descontos dados</div>
                <div class="value">{brl(discounts)}</div>
              </div>
            </div>
            <div class="card" style="padding:12px">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cupom</th>
                      <th>Vale para</th>
                      <th>Usos</th>
                      <th>Validade</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {withState.map((r) => {
                      const link = r.course_slug ? `${base}/c/${r.course_slug}?cupom=${r.code}` : `${base}/?cupom=${r.code}`
                      return (
                        <tr>
                          <td>
                            <code>{r.code}</code>
                            <div class="small muted nowrap" style="margin-top:4px">{describeDiscount(r)}</div>
                          </td>
                          <td class="small">{r.course_title ?? 'Todos os cursos'}</td>
                          <td class="nowrap">
                            <strong>{r.uses}</strong>
                            <span class="muted"> / {r.max_uses ?? '∞'}</span>
                            {r.once_per_student ? <div class="small muted">1 por aluno</div> : null}
                          </td>
                          <td class="small nowrap">
                            {r.starts_at && r.starts_at > t ? <div>De {dateBR(r.starts_at)}</div> : null}
                            {r.expires_at ? <div>Até {dateBR(r.expires_at)}</div> : <span class="muted">Sem prazo</span>}
                          </td>
                          <td>
                            <span class={`badge ${STATE_BADGE[r.state]}`}>{COUPON_STATE_LABEL[r.state]}</span>
                          </td>
                          <td>
                            <div class="row" style="justify-content:flex-end;flex-wrap:nowrap">
                              <input id={`link-${r.id}`} value={link} readonly aria-label={`Link com o cupom ${r.code}`} class="sr-copy" />
                              <button class="btn ghost sm" type="button" data-copy={`link-${r.id}`} title={link}>
                                Copiar link
                              </button>
                              <form method="post" action={`/admin/cupons/${r.id}/${r.active ? 'pausar' : 'ativar'}`}>
                                <button class="btn ghost sm" type="submit">
                                  {r.active ? 'Pausar' : 'Ativar'}
                                </button>
                              </form>
                              <a class="btn sm" href={`/admin/cupons/${r.id}`}>
                                Editar
                              </a>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p class="small muted" style="margin-top:14px">
              “Copiar link” gera um link que já abre com o cupom aplicado. É só mandar no WhatsApp, Instagram ou e-mail.
            </p>
          </>
        ) : (
          <div class="card empty-state">
            <div class="big">🏷️</div>
            <h3>Crie seu primeiro cupom</h3>
            <p>
              Dê desconto em porcentagem ou em reais, com data para acabar e limite de usos.
              <br />
              Ex.: <code>LANCAMENTO20</code> com 20% até domingo, só para as 50 primeiras vendas.
            </p>
            <a class="btn" href="/admin/cupons/novo">
              Criar cupom
            </a>
          </div>
        )}
      </AdminLayout>,
    )
  })

  app.get('/cupons/novo', async (c) => {
    const { results: courses } = await coursesList(c)
    return c.html(
      <AdminLayout title="Novo cupom" s={c.get('settings')} active="/admin/cupons">
        <div class="page-head">
          <h1>Novo cupom</h1>
        </div>
        <CouponForm isNew courses={courses} v={{ code: suggestCode(), kind: 'percent', once_per_student: 1, active: 1 }} />
      </AdminLayout>,
    )
  })

  app.post('/cupons/novo', async (c) => {
    const { v, error } = await readCouponForm(c)
    if (error) {
      const { results: courses } = await coursesList(c)
      return c.html(
        <AdminLayout title="Novo cupom" s={c.get('settings')} active="/admin/cupons">
          <div class="page-head">
            <h1>Novo cupom</h1>
          </div>
          <CouponForm isNew courses={courses} v={v} error={error} />
        </AdminLayout>,
        400,
      )
    }
    await c.env.DB.prepare(
      `INSERT INTO coupons (code, kind, value, course_id, max_uses, once_per_student, starts_at, expires_at, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(v.code!, v.kind!, v.value!, v.course_id ?? null, v.max_uses ?? null, v.once_per_student!, v.starts_at ?? null, v.expires_at ?? null, v.active!, now())
      .run()
    return c.redirect('/admin/cupons?ok=' + encodeURIComponent(`Cupom ${v.code} criado (${shortDiscount(v as Coupon)}).`))
  })

  const byId = (c: C) => c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(Number(c.req.param('id'))).first<Coupon>()

  async function editPage(c: C, coupon: Coupon, v: Partial<Coupon>, error?: string) {
    const { results: courses } = await coursesList(c)
    const uses = await couponUses(c.env.DB, coupon.id)
    return c.html(
      <AdminLayout title={`Cupom ${coupon.code}`} s={c.get('settings')} active="/admin/cupons">
        <div class="page-head">
          <div>
            <h1>
              Cupom <code style="font-size:.8em">{coupon.code}</code>
            </h1>
            <p class="muted" style="margin:6px 0 0">
              {uses} {uses === 1 ? 'uso' : 'usos'} até agora · criado em {dateBR(coupon.created_at)}
            </p>
          </div>
        </div>
        <CouponForm isNew={false} courses={courses} v={v} error={error} />
        <form
          method="post"
          action={`/admin/cupons/${coupon.id}/excluir`}
          style="margin-top:28px"
          data-confirm={uses ? 'Este cupom já foi usado. Ele vai sumir da lista, mas os pedidos continuam registrados. Excluir mesmo?' : 'Excluir este cupom?'}
        >
          <button class="btn danger sm" type="submit">
            Excluir cupom
          </button>
        </form>
      </AdminLayout>,
      error ? 400 : 200,
    )
  }

  app.get('/cupons/:id', async (c) => {
    const coupon = await byId(c)
    if (!coupon) return c.redirect('/admin/cupons')
    return editPage(c, coupon, coupon)
  })

  app.post('/cupons/:id', async (c) => {
    const coupon = await byId(c)
    if (!coupon) return c.redirect('/admin/cupons')
    const { v, error } = await readCouponForm(c, coupon.id)
    if (error) return editPage(c, coupon, { ...v, id: coupon.id }, error)
    await c.env.DB.prepare(
      `UPDATE coupons SET code = ?, kind = ?, value = ?, course_id = ?, max_uses = ?, once_per_student = ?, starts_at = ?, expires_at = ?, active = ? WHERE id = ?`,
    )
      .bind(v.code!, v.kind!, v.value!, v.course_id ?? null, v.max_uses ?? null, v.once_per_student!, v.starts_at ?? null, v.expires_at ?? null, v.active!, coupon.id)
      .run()
    return c.redirect('/admin/cupons?ok=' + encodeURIComponent(`Cupom ${v.code} salvo.`))
  })

  for (const [action, active, msg] of [
    ['pausar', 0, 'pausado'],
    ['ativar', 1, 'ativado'],
  ] as const) {
    app.post(`/cupons/:id/${action}`, async (c) => {
      const coupon = await byId(c)
      if (coupon) await c.env.DB.prepare('UPDATE coupons SET active = ? WHERE id = ?').bind(active, coupon.id).run()
      return c.redirect('/admin/cupons' + (coupon ? '?ok=' + encodeURIComponent(`Cupom ${coupon.code} ${msg}.`) : ''))
    })
  }

  app.post('/cupons/:id/excluir', async (c) => {
    const coupon = await byId(c)
    if (coupon) await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(coupon.id).run()
    return c.redirect('/admin/cupons' + (coupon ? '?ok=' + encodeURIComponent(`Cupom ${coupon.code} excluído.`) : ''))
  })
}
