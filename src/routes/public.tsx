import { Hono, type Context } from 'hono'
import type { AppEnv, Course, Lesson, Module, Order, PaymentMethod } from '../env'
import { Cover, Flash, Layout } from '../views/layout'
import { brl, isEmail, now, DAY } from '../lib/format'
import { markdown } from '../lib/markdown'
import { enabledMethods } from '../lib/settings'
import { buildPixPayload, qrSvg } from '../lib/pix'
import { hashPassword, randomId, verifyPassword } from '../lib/crypto'
import { createSession, tooManyAttempts } from '../lib/auth'
import { createCardCheckout, createPixPayment } from '../lib/mercadopago'
import { getCourse, getOrder, hasAccess, notificationUrl, refreshFromMp } from '../lib/orders'
import { sendEmail } from '../lib/email'

export const origin = (c: Context) => new URL(c.req.url).origin

const app = new Hono<AppEnv>()

// ───────────── Vitrine ─────────────
app.get('/', async (c) => {
  const s = c.get('settings')
  const { results: courses } = await c.env.DB.prepare('SELECT * FROM courses WHERE published = 1 ORDER BY created_at DESC').all<Course>()
  const hasAdmin = await c.env.DB.prepare('SELECT 1 FROM admins LIMIT 1').first()
  return c.html(
    <Layout s={s} student={c.get('student')}>
      <section class="hero wrap">
        <h1>{s.store_name}</h1>
        <p>{s.store_tagline}</p>
      </section>
      <section class="wrap" style="padding-bottom:60px">
        {courses.length ? (
          <div class="grid g3">
            {courses.map((course) => (
              <a href={`/c/${course.slug}`} class="card course-card">
                <Cover course={course} />
                <div class="body">
                  <h3>{course.title}</h3>
                  <p class="muted small" style="flex:1">
                    {course.subtitle}
                  </p>
                  <div class="row spread">
                    <span class="price">{brl(course.price_cents)}</span>
                    <span class="badge accent">Ver curso →</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div class="card empty-state">
            <div class="big">✨</div>
            <h3>Nenhum curso publicado ainda</h3>
            {!hasAdmin ? (
              <p>
                É o dono da loja? <a href="/admin">Comece a configuração aqui</a>.
              </p>
            ) : (
              <p>Volte em breve!</p>
            )}
          </div>
        )}
      </section>
    </Layout>,
  )
})

async function loadCurriculum(db: D1Database, courseId: number) {
  const { results: modules } = await db.prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY position, id').bind(courseId).all<Module>()
  const { results: lessons } = await db
    .prepare('SELECT l.* FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ? ORDER BY l.position, l.id')
    .bind(courseId)
    .all<Lesson>()
  return modules.map((m) => ({ ...m, lessons: lessons.filter((l) => l.module_id === m.id) }))
}
export { loadCurriculum }

// ───────────── Página de vendas ─────────────
app.get('/c/:slug', async (c) => {
  const s = c.get('settings')
  const course = await c.env.DB.prepare('SELECT * FROM courses WHERE slug = ? AND published = 1').bind(c.req.param('slug')).first<Course>()
  if (!course) return c.notFound()
  const curriculum = await loadCurriculum(c.env.DB, course.id)
  const totalLessons = curriculum.reduce((n, m) => n + m.lessons.length, 0)
  const student = c.get('student')
  const owned = student ? await hasAccess(c.env.DB, student.id, course.id) : false
  const bullets = course.bullets.split('\n').map((b) => b.trim()).filter(Boolean)
  const methods = enabledMethods(s)
  const anyMethod = methods.pix_manual || methods.mp_pix || methods.mp_card

  return c.html(
    <Layout s={s} student={student} title={course.title} description={course.subtitle}>
      <div class="wrap sales">
        <div class="stack">
          <div>
            <span class="badge accent">Curso online</span>
            <h1 style="margin-top:14px">{course.title}</h1>
            <p style="font-size:1.2rem" class="muted">
              {course.subtitle}
            </p>
          </div>
          <div class="card" style="padding:0;overflow:hidden">
            <Cover course={course} />
          </div>
          {bullets.length > 0 && (
            <div class="card">
              <h2>O que você vai aprender</h2>
              <ul class="ticks">
                {bullets.map((b) => (
                  <li>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {course.description && <div class="card prose" dangerouslySetInnerHTML={{ __html: markdown(course.description) }} />}
          {curriculum.length > 0 && (
            <div class="curriculum">
              <h2>Conteúdo do curso</h2>
              <p class="muted small">
                {curriculum.length} módulos · {totalLessons} aulas
              </p>
              {curriculum.map((m, i) => (
                <details open={i === 0}>
                  <summary>
                    <span>{m.title}</span>
                    <span class="muted small">{m.lessons.length} aulas</span>
                  </summary>
                  <ol>
                    {m.lessons.map((l) => (
                      <li>
                        {l.title} {l.duration_text && <span class="small">· {l.duration_text}</span>}
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          )}
        </div>
        <aside class="sticky">
          <div class="card pad-lg buybox stack">
            <div>
              <div class="muted small">Acesso completo por</div>
              <div class="price">{brl(course.price_cents)}</div>
              {methods.mp_card && Number(s.mp_max_installments) > 1 && (
                <div class="muted small">ou parcelado no cartão em até {s.mp_max_installments}x</div>
              )}
            </div>
            {owned ? (
              <a class="btn lg block" href={`/aluno/curso/${course.id}`}>
                Continuar assistindo
              </a>
            ) : anyMethod ? (
              <a class="btn lg block" href={`/c/${course.slug}/comprar`}>
                Quero comprar
              </a>
            ) : (
              <div class="alert warn">As vendas ainda não estão abertas.</div>
            )}
            <ul class="ticks small">
              <li>Liberação imediata após o pagamento</li>
              <li>{s.refund_days || 7} dias de garantia: não gostou, devolvemos</li>
              <li>{[methods.mp_pix || methods.pix_manual ? 'Pix' : '', methods.mp_card ? 'Cartão de crédito' : ''].filter(Boolean).join(' ou ') || 'Pagamento seguro'}</li>
            </ul>
          </div>
        </aside>
      </div>
    </Layout>,
  )
})

// ───────────── Checkout ─────────────
function CheckoutPage(props: { c: Context<AppEnv>; course: Course; error?: string; values?: Record<string, string> }) {
  const { c, course, error } = props
  const s = c.get('settings')
  const student = c.get('student')
  const m = enabledMethods(s)
  const v = props.values ?? {}
  const firstMethod = m.mp_pix ? 'mp_pix' : m.pix_manual ? 'pix_manual' : 'mp_card'
  const chosen = v.method || firstMethod
  return (
    <Layout s={s} student={student} title={`Comprar ${course.title}`}>
      <div class="narrow" style="padding:48px 20px 80px;max-width:560px">
        <a href={`/c/${course.slug}`} class="small">
          ← Voltar
        </a>
        <div class="card pad-lg stack" style="margin-top:14px">
          <div class="row spread">
            <div>
              <div class="muted small">Você está comprando</div>
              <h2 style="margin:0">{course.title}</h2>
            </div>
            <div class="price">{brl(course.price_cents)}</div>
          </div>
          <Flash msg={error} kind="bad" />
          <form method="post" class="stack">
            {student ? (
              <div class="alert info">
                Comprando como <strong>{student.name}</strong> ({student.email})
              </div>
            ) : (
              <>
                <div class="field">
                  <label for="name">Nome completo</label>
                  <input id="name" name="name" required maxlength={100} value={v.name} autocomplete="name" />
                </div>
                <div class="field">
                  <label for="email">E-mail</label>
                  <input id="email" name="email" type="email" required value={v.email} autocomplete="email" />
                  <div class="hint">É por ele que você vai entrar para assistir.</div>
                </div>
                <div class="field">
                  <label for="password">Crie uma senha</label>
                  <input id="password" name="password" type="password" required minlength={8} autocomplete="new-password" />
                  <div class="hint">Mínimo 8 caracteres. Já comprou aqui antes? Use a mesma senha.</div>
                </div>
              </>
            )}
            <div>
              <label>Forma de pagamento</label>
              <div class="methods">
                {m.mp_pix && (
                  <label class="method">
                    <input type="radio" name="method" value="mp_pix" checked={chosen === 'mp_pix'} />
                    <span>
                      Pix<span class="sub">Aprovação na hora, acesso imediato</span>
                    </span>
                  </label>
                )}
                {m.pix_manual && (
                  <label class="method">
                    <input type="radio" name="method" value="pix_manual" checked={chosen === 'pix_manual'} />
                    <span>
                      Pix {m.mp_pix ? '(direto para o vendedor)' : ''}
                      <span class="sub">Liberado assim que o vendedor confirmar o recebimento</span>
                    </span>
                  </label>
                )}
                {m.mp_card && (
                  <label class="method">
                    <input type="radio" name="method" value="mp_card" checked={chosen === 'mp_card'} />
                    <span>
                      Cartão de crédito
                      <span class="sub">
                        Até {s.mp_max_installments}x · ambiente seguro do Mercado Pago
                      </span>
                    </span>
                  </label>
                )}
              </div>
            </div>
            <label class="check small">
              <input type="checkbox" name="terms" value="1" required />
              <span>
                Li e aceito os <a href="/termos" target="_blank">termos de compra e reembolso</a>.
              </span>
            </label>
            <button class="btn lg block" type="submit">
              Finalizar compra · {brl(course.price_cents)}
            </button>
            <div class="trust">
              <span>🔒 Seus dados de cartão nunca passam por este site</span>
              <span>↺ {s.refund_days || 7} dias de garantia</span>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}

async function publishedCourse(c: Context<AppEnv>) {
  return c.env.DB.prepare('SELECT * FROM courses WHERE slug = ? AND published = 1').bind(c.req.param('slug')).first<Course>()
}

app.get('/c/:slug/comprar', async (c) => {
  const course = await publishedCourse(c)
  if (!course) return c.notFound()
  const student = c.get('student')
  if (student && (await hasAccess(c.env.DB, student.id, course.id))) return c.redirect(`/aluno/curso/${course.id}`)
  return c.html(<CheckoutPage c={c} course={course} />)
})

app.post('/c/:slug/comprar', async (c) => {
  const s = c.get('settings')
  const course = await publishedCourse(c)
  if (!course) return c.notFound()
  const form = await c.req.parseBody()
  const values = { name: String(form.name ?? '').trim(), email: String(form.email ?? '').trim().toLowerCase(), method: String(form.method ?? '') }
  const fail = (error: string) => c.html(<CheckoutPage c={c} course={course} error={error} values={values} />, 400)

  const method = values.method as PaymentMethod
  const enabled = enabledMethods(s)
  if (!(method in enabled) || !enabled[method]) return fail('Escolha uma forma de pagamento.')
  if (form.terms !== '1') return fail('Você precisa aceitar os termos.')

  // 1) Identifica (ou cria) o aluno
  let student = c.get('student')
  if (!student) {
    const password = String(form.password ?? '')
    if (values.name.length < 2) return fail('Informe seu nome.')
    if (!isEmail(values.email)) return fail('E-mail inválido.')
    if (password.length < 8) return fail('A senha precisa ter pelo menos 8 caracteres.')
    const existing = await c.env.DB.prepare('SELECT id, name, email, password_hash FROM students WHERE email = ?')
      .bind(values.email)
      .first<{ id: number; name: string; email: string; password_hash: string }>()
    if (existing) {
      if (await tooManyAttempts(c, 'aluno', values.email)) return fail('Muitas tentativas. Aguarde 15 minutos.')
      if (!(await verifyPassword(password, existing.password_hash)))
        return fail('Este e-mail já tem cadastro e a senha não confere. Use a senha da sua conta ou recupere em "Entrar".')
      student = { id: existing.id, name: existing.name, email: existing.email }
    } else {
      const r = await c.env.DB.prepare('INSERT INTO students (name, email, password_hash, created_at) VALUES (?, ?, ?, ?) RETURNING id')
        .bind(values.name, values.email, await hashPassword(password), now())
        .first<{ id: number }>()
      student = { id: r!.id, name: values.name, email: values.email }
    }
    await createSession(c, 'student', student.id)
  }

  if (await hasAccess(c.env.DB, student.id, course.id)) return c.redirect(`/aluno/curso/${course.id}`)

  // 2) Reaproveita um pedido em aberto (evita pedidos duplicados ao clicar duas vezes)
  const open = await c.env.DB.prepare(
    `SELECT id FROM orders WHERE student_id = ? AND course_id = ? AND method = ? AND status IN ('pending','awaiting_confirmation') AND created_at > ? AND amount_cents = ?`,
  )
    .bind(student.id, course.id, method, now() - DAY, course.price_cents)
    .first<{ id: string }>()
  if (open) return c.redirect(`/pedido/${open.id}`)

  // 3) Cria o pedido. O valor vem SEMPRE do banco, nunca do formulário.
  const orderId = randomId()
  const base = origin(c)
  let providerId: string | null = null
  let pixPayload: string | null = null
  let checkoutUrl: string | null = null
  try {
    if (method === 'pix_manual') {
      pixPayload = buildPixPayload({ key: s.pix_key, name: s.pix_name, city: s.pix_city, amountCents: course.price_cents, txid: orderId })
    } else if (method === 'mp_pix') {
      const p = await createPixPayment(s.mp_access_token, {
        orderId,
        amountCents: course.price_cents,
        description: course.title,
        email: student.email,
        name: student.name,
        notificationUrl: notificationUrl(base),
      })
      providerId = String(p.id)
      pixPayload = p.point_of_interaction?.transaction_data?.qr_code ?? null
      if (!pixPayload) throw new Error('Mercado Pago não retornou o código Pix')
    } else {
      checkoutUrl = await createCardCheckout(s.mp_access_token, {
        orderId,
        amountCents: course.price_cents,
        title: course.title,
        email: student.email,
        name: student.name,
        baseUrl: base,
        notificationUrl: notificationUrl(base),
        maxInstallments: Number(s.mp_max_installments || 12),
      })
    }
  } catch (err) {
    console.error('Erro criando pagamento', err)
    return fail('Não conseguimos gerar o pagamento agora. Tente outra forma de pagamento ou tente de novo em instantes.')
  }

  await c.env.DB.prepare(
    `INSERT INTO orders (id, course_id, student_id, amount_cents, method, status, provider_payment_id, pix_payload, checkout_url, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
  )
    .bind(orderId, course.id, student.id, course.price_cents, method, providerId, pixPayload, checkoutUrl, now())
    .run()
  return c.redirect(`/pedido/${orderId}`)
})

// ───────────── Pedido ─────────────
async function ownOrder(c: Context<AppEnv>): Promise<Order | null> {
  const student = c.get('student')
  if (!student) return null
  const order = await getOrder(c.env.DB, c.req.param('id') ?? '')
  return order && order.student_id === student.id ? order : null
}

app.get('/pedido/:id', async (c) => {
  if (!c.get('student')) return c.redirect(`/aluno/entrar?next=${encodeURIComponent(c.req.path)}`)
  let order = await ownOrder(c)
  if (!order) return c.notFound()
  const s = c.get('settings')
  if (order.status === 'pending' && order.method !== 'pix_manual') {
    await refreshFromMp(c.env, s, origin(c), order)
    order = (await getOrder(c.env.DB, order.id))!
  }
  const course = (await getCourse(c.env.DB, order.course_id))!
  const isPix = order.method !== 'mp_card'

  let body
  if (order.status === 'paid') {
    body = (
      <div class="center stack">
        <div style="font-size:3rem">🎉</div>
        <h2>Pagamento confirmado!</h2>
        <p class="muted">Seu acesso a “{course.title}” está liberado.</p>
        <a class="btn lg" href={`/aluno/curso/${course.id}`}>
          Começar agora
        </a>
      </div>
    )
  } else if (order.status === 'pending' && isPix && order.pix_payload) {
    body = (
      <div class="center stack">
        <h2>Pague com Pix</h2>
        <p class="muted">
          Valor: <strong style="color:var(--ink)">{brl(order.amount_cents)}</strong>
        </p>
        <div class="qr" dangerouslySetInnerHTML={{ __html: qrSvg(order.pix_payload) }} />
        <div class="copy">
          <input id="pix" readonly value={order.pix_payload} aria-label="Pix copia e cola" />
          <button class="btn" type="button" data-copy="pix">
            Copiar
          </button>
        </div>
        <ol class="steps small">
          <li>Abra o app do seu banco e escolha Pix</li>
          <li>Escaneie o QR Code ou use “Pix Copia e Cola”</li>
          <li>Confira o valor e confirme</li>
        </ol>
        {order.method === 'mp_pix' ? (
          <p class="small muted" data-poll={`/pedido/${order.id}/status`} data-status={order.status}>
            <span class="pulse" /> Aguardando pagamento… esta página atualiza sozinha.
          </p>
        ) : (
          <form method="post" action={`/pedido/${order.id}/paguei`}>
            <button class="btn ghost block" type="submit">
              Já paguei
            </button>
            <p class="hint">O vendedor confere o Pix na conta dele e libera seu acesso. Você recebe um e-mail.</p>
          </form>
        )}
      </div>
    )
  } else if (order.status === 'pending' && order.method === 'mp_card' && order.checkout_url) {
    const back = !!c.req.query('status') || !!c.req.query('payment_id')
    body = (
      <div class="center stack" data-poll={`/pedido/${order.id}/status`} data-status={order.status}>
        <h2>{back ? 'Processando seu pagamento' : 'Indo para o pagamento seguro'}</h2>
        <p class="muted">
          {back
            ? 'Se o cartão foi aprovado, seu acesso aparece aqui em instantes.'
            : 'Você vai digitar o cartão no ambiente do Mercado Pago. Nenhum dado de cartão passa por este site.'}
        </p>
        <a class="btn lg" href={order.checkout_url} {...(back ? {} : { 'data-redirect': order.checkout_url })}>
          {back ? 'Tentar pagar de novo' : 'Ir para o pagamento'}
        </a>
      </div>
    )
  } else if (order.status === 'awaiting_confirmation') {
    body = (
      <div class="center stack" data-poll={`/pedido/${order.id}/status`} data-status={order.status}>
        <div style="font-size:2.6rem">⏳</div>
        <h2>Recebemos seu aviso!</h2>
        <p class="muted">O vendedor vai conferir o Pix e liberar seu acesso. Você recebe um e-mail quando estiver pronto. Pode fechar esta página.</p>
      </div>
    )
  } else {
    const msg: Record<string, string> = {
      refund_requested: 'Reembolso solicitado. O vendedor vai devolver o valor pelo Pix.',
      refunded: 'Este pedido foi reembolsado.',
      disputed: 'Este pagamento está em contestação.',
      cancelled: 'Este pedido foi cancelado ou expirou.',
    }
    body = (
      <div class="center stack">
        <h2>{msg[order.status] ?? 'Pedido'}</h2>
        <a class="btn ghost" href={`/c/${course.slug}`}>
          Voltar ao curso
        </a>
      </div>
    )
  }

  return c.html(
    <Layout s={s} student={c.get('student')} title="Seu pedido">
      <div class="narrow" style="padding:48px 20px 80px">
        <div class="card pad-lg">
          <div class="muted small center" style="margin-bottom:18px">
            Pedido #{order.id.slice(0, 8).toUpperCase()} · {course.title}
          </div>
          {body}
        </div>
      </div>
    </Layout>,
  )
})

app.get('/pedido/:id/status', async (c) => {
  let order = await ownOrder(c)
  if (!order) return c.json({ error: 'not_found' }, 404)
  if (order.status === 'pending' && order.method !== 'pix_manual') {
    await refreshFromMp(c.env, c.get('settings'), origin(c), order)
    order = (await getOrder(c.env.DB, order.id))!
  }
  return c.json({ status: order.status })
})

app.post('/pedido/:id/paguei', async (c) => {
  const order = await ownOrder(c)
  if (!order) return c.notFound()
  if (order.method === 'pix_manual' && order.status === 'pending') {
    await c.env.DB.prepare(`UPDATE orders SET status = 'awaiting_confirmation' WHERE id = ? AND status = 'pending'`).bind(order.id).run()
    const s = c.get('settings')
    const course = await getCourse(c.env.DB, order.course_id)
    const student = c.get('student')!
    await sendEmail(s, s.seller_email, `Confirme um Pix: ${brl(order.amount_cents)}`, [
      `${student.name} (${student.email}) diz que pagou ${brl(order.amount_cents)} via Pix pelo curso "${course?.title}".`,
      `Confira no app do seu banco um Pix com a identificação ${order.id} e confirme no painel.`,
    ], { label: 'Confirmar no painel', url: `${origin(c)}/admin/pedidos?status=awaiting_confirmation` })
  }
  return c.redirect(`/pedido/${order.id}`)
})

// ───────────── Termos ─────────────
app.get('/termos', (c) => {
  const s = c.get('settings')
  const days = s.refund_days || '7'
  const text =
    s.terms_text ||
    `## Termos de compra\n\nAo comprar um curso em **${s.store_name}**, você recebe acesso pessoal e intransferível ao conteúdo, para assistir online.\n\n## Garantia e reembolso\n\nVocê tem **${days} dias** a partir da confirmação do pagamento para pedir o reembolso, sem precisar justificar (Código de Defesa do Consumidor, art. 49). É só clicar em "Pedir reembolso" na sua área do aluno. O acesso ao curso é encerrado quando o reembolso é pedido.\n\n- Pix pelo Mercado Pago e cartão: o reembolso é automático.\n- Pix direto para o vendedor: o valor é devolvido por Pix pelo vendedor.\n\n## Seus dados\n\nUsamos seu nome e e-mail apenas para liberar seu acesso e falar sobre sua compra. Os dados do cartão são digitados no ambiente do Mercado Pago e nunca passam por este site. Para pedir a exclusão dos seus dados, fale com o suporte${s.support_contact ? `: ${s.support_contact}` : ''}.`
  return c.html(
    <Layout s={s} student={c.get('student')} title="Termos">
      <div class="wrap" style="max-width:760px;padding:48px 20px">
        <div class="card pad-lg prose" dangerouslySetInnerHTML={{ __html: markdown(text) }} />
      </div>
    </Layout>,
  )
})

export default app
