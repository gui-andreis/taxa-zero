import { Hono, type Context } from 'hono'
import type { AppEnv, Course, Lesson, Module, Order } from '../env'
import { AdminLayout, Flash, Layout } from '../views/layout'
import { brl, dateBR, DAY, isEmail, isHexColor, METHOD_LABEL, now, parseBRL, slugify, STATUS_LABEL } from '../lib/format'
import { hashPassword, randomId, safeEqual, verifyPassword } from '../lib/crypto'
import { createSession, destroySession, tooManyAttempts } from '../lib/auth'
import { emailReady, enabledMethods, saveSettings, SECRET_KEYS } from '../lib/settings'
import { getOrder, markPaid, refundOrder } from '../lib/orders'
import { loadCurriculum, origin } from './public'

const app = new Hono<AppEnv>()
type C = Context<AppEnv>

const adminExists = async (db: D1Database) => !!(await db.prepare('SELECT 1 FROM admins LIMIT 1').first())

// ───────────── Primeiro acesso ─────────────
function SetupPage({ c, error }: { c: C; error?: string }) {
  const s = c.get('settings')
  return (
    <Layout s={s} title="Configuração inicial">
      <div class="narrow auth">
        <div class="card pad-lg stack">
          <div class="center">
            <div style="font-size:2.4rem">🚀</div>
            <h2>Bem-vindo(a) ao Taxa Zero</h2>
            <p class="muted">Crie a conta de administrador da sua loja. Leva 30 segundos.</p>
          </div>
          <Flash msg={error} kind="bad" />
          <form method="post" class="stack">
            {c.env.SETUP_CODE ? (
              <div class="field">
                <label for="code">Código de configuração</label>
                <input id="code" name="code" type="password" required />
                <div class="hint">É o SETUP_CODE que você escolheu ao publicar o site.</div>
              </div>
            ) : (
              <div class="alert warn small">
                Dica de segurança: defina a variável SETUP_CODE na Cloudflare para que só você consiga fazer este passo.
              </div>
            )}
            <div class="field">
              <label for="email">Seu e-mail</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div class="field">
              <label for="password">Senha do painel</label>
              <input id="password" name="password" type="password" minlength={10} required autocomplete="new-password" />
              <div class="hint">Mínimo 10 caracteres.</div>
            </div>
            <button class="btn block lg" type="submit">
              Criar minha loja
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

app.get('/setup', async (c) => ((await adminExists(c.env.DB)) ? c.redirect('/admin/entrar') : c.html(<SetupPage c={c} />)))

app.post('/setup', async (c) => {
  if (await adminExists(c.env.DB)) return c.redirect('/admin/entrar')
  const f = await c.req.parseBody()
  const email = String(f.email ?? '').trim().toLowerCase()
  const password = String(f.password ?? '')
  if (c.env.SETUP_CODE) {
    if (await tooManyAttempts(c, 'setup', 'setup')) return c.html(<SetupPage c={c} error="Muitas tentativas. Aguarde 15 minutos." />, 429)
    if (!safeEqual(String(f.code ?? ''), c.env.SETUP_CODE)) return c.html(<SetupPage c={c} error="Código de configuração incorreto." />, 403)
  }
  if (!isEmail(email)) return c.html(<SetupPage c={c} error="E-mail inválido." />, 400)
  if (password.length < 10) return c.html(<SetupPage c={c} error="A senha precisa ter pelo menos 10 caracteres." />, 400)
  const r = await c.env.DB.prepare('INSERT INTO admins (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id')
    .bind(email, await hashPassword(password), now())
    .first<{ id: number }>()
  await saveSettings(c.env.DB, { seller_email: email })
  await createSession(c, 'admin', r!.id)
  return c.redirect('/admin/configuracoes?bemvindo=1')
})

// ───────────── Login ─────────────
function AdminLogin({ c, error }: { c: C; error?: string }) {
  return (
    <Layout s={c.get('settings')} title="Painel">
      <div class="narrow auth">
        <form method="post" class="card pad-lg stack">
          <h2 class="center">Painel do vendedor</h2>
          <Flash msg={error} kind="bad" />
          <div class="field">
            <label for="email">E-mail</label>
            <input id="email" name="email" type="email" required autocomplete="username" />
          </div>
          <div class="field">
            <label for="password">Senha</label>
            <input id="password" name="password" type="password" required autocomplete="current-password" />
          </div>
          <button class="btn block" type="submit">
            Entrar
          </button>
        </form>
      </div>
    </Layout>
  )
}

app.get('/entrar', async (c) => {
  if (!(await adminExists(c.env.DB))) return c.redirect('/admin/setup')
  return c.get('admin') ? c.redirect('/admin') : c.html(<AdminLogin c={c} />)
})

app.post('/entrar', async (c) => {
  const f = await c.req.parseBody()
  const email = String(f.email ?? '').trim().toLowerCase()
  if (await tooManyAttempts(c, 'admin', email)) return c.html(<AdminLogin c={c} error="Muitas tentativas. Aguarde 15 minutos." />, 429)
  const row = await c.env.DB.prepare('SELECT id, password_hash FROM admins WHERE email = ?').bind(email).first<{ id: number; password_hash: string }>()
  if (!row || !(await verifyPassword(String(f.password ?? ''), row.password_hash)))
    return c.html(<AdminLogin c={c} error="E-mail ou senha incorretos." />, 401)
  await createSession(c, 'admin', row.id)
  return c.redirect('/admin')
})

// ───────────── Daqui pra baixo: só admin ─────────────
app.use('*', async (c, next) => {
  if (!c.get('admin')) {
    if (!(await adminExists(c.env.DB))) return c.redirect('/admin/setup')
    if (c.req.method !== 'GET') return c.text('Sessão expirada. Entre novamente.', 401)
    return c.redirect('/admin/entrar')
  }
  await next()
})

app.post('/sair', async (c) => {
  await destroySession(c, 'admin')
  return c.redirect('/admin/entrar')
})

// ───────────── Visão geral ─────────────
app.get('/', async (c) => {
  const s = c.get('settings')
  const db = c.env.DB
  const since30 = now() - 30 * DAY
  const [total, last30, students, toConfirm, refunds, courses] = await Promise.all([
    db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(amount_cents),0) v FROM orders WHERE status = 'paid'`).first<{ n: number; v: number }>(),
    db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(amount_cents),0) v FROM orders WHERE status = 'paid' AND paid_at > ?`).bind(since30).first<{ n: number; v: number }>(),
    db.prepare(`SELECT COUNT(DISTINCT student_id) n FROM orders WHERE status = 'paid'`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n FROM orders WHERE status = 'awaiting_confirmation'`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n FROM orders WHERE status = 'refund_requested'`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(published),0) p FROM courses`).first<{ n: number; p: number }>(),
  ])
  const { results: paid } = await db.prepare(`SELECT amount_cents, paid_at FROM orders WHERE status = 'paid' AND paid_at > ?`).bind(since30).all<{ amount_cents: number; paid_at: number }>()
  const { results: recent } = await db
    .prepare(
      `SELECT o.*, s.name student_name, c.title course_title FROM orders o JOIN students s ON s.id = o.student_id JOIN courses c ON c.id = o.course_id
       WHERE o.status != 'cancelled' ORDER BY o.created_at DESC LIMIT 8`,
    )
    .all<Order & { student_name: string; course_title: string }>()

  // Faturamento por dia (últimos 30 dias, horário de Brasília)
  const days: { label: string; v: number }[] = []
  const dayKey = (t: number) => new Date(t - 3 * 3600 * 1000).toISOString().slice(0, 10)
  for (let i = 29; i >= 0; i--) {
    const t = now() - i * DAY
    days.push({ label: dayKey(t), v: 0 })
  }
  for (const p of paid) {
    const d = days.find((x) => x.label === dayKey(p.paid_at))
    if (d) d.v += p.amount_cents
  }
  const max = Math.max(1, ...days.map((d) => d.v))
  const hotmartFee = (total?.n ?? 0) * 249 + Math.round((total?.v ?? 0) * 0.099)

  const m = enabledMethods(s)
  const checklist = [
    { done: m.pix_manual || m.mp_pix || m.mp_card, label: 'Configurar como você recebe (Pix e/ou Mercado Pago)', href: '/admin/configuracoes#pagamentos' },
    { done: (courses?.n ?? 0) > 0, label: 'Criar seu primeiro curso', href: '/admin/cursos/novo' },
    { done: (courses?.p ?? 0) > 0, label: 'Publicar o curso', href: '/admin/cursos' },
    { done: emailReady(s), label: 'Ativar e-mails automáticos (opcional)', href: '/admin/configuracoes#email' },
  ]

  return c.html(
    <AdminLayout title="Visão geral" s={s} active="/admin">
      <div class="page-head">
        <div>
          <h1>Visão geral</h1>
          <p class="muted" style="margin:0">Tudo o que você vendeu, sem nenhuma comissão.</p>
        </div>
        <a class="btn" href="/admin/cursos/novo">
          + Novo curso
        </a>
      </div>
      {(toConfirm?.n ?? 0) > 0 && (
        <div class="alert warn">
          <strong>{toConfirm!.n} Pix aguardando sua confirmação.</strong> Confira no app do banco e <a href="/admin/pedidos?status=awaiting_confirmation">confirme aqui</a>.
        </div>
      )}
      {(refunds?.n ?? 0) > 0 && (
        <div class="alert bad">
          <strong>{refunds!.n} pedido(s) de reembolso.</strong> <a href="/admin/pedidos?status=refund_requested">Ver pedidos</a>
        </div>
      )}
      {checklist.some((x) => !x.done) && (
        <div class="card" style="margin-bottom:20px">
          <h3>Primeiros passos</h3>
          <ul class="ticks">
            {checklist.map((x) => (
              <li style={x.done ? 'opacity:.55;text-decoration:line-through' : ''}>
                {x.done ? x.label : <a href={x.href}>{x.label}</a>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div class="grid g4">
        <div class="card kpi">
          <div class="label">Faturamento (30 dias)</div>
          <div class="value">{brl(last30?.v ?? 0)}</div>
          <div class="small muted">{last30?.n ?? 0} vendas</div>
        </div>
        <div class="card kpi">
          <div class="label">Faturamento total</div>
          <div class="value">{brl(total?.v ?? 0)}</div>
          <div class="small muted">{total?.n ?? 0} vendas</div>
        </div>
        <div class="card kpi">
          <div class="label">Alunos ativos</div>
          <div class="value">{students?.n ?? 0}</div>
          <div class="small muted">com acesso liberado</div>
        </div>
        <div class="card kpi">
          <div class="label">Você economizou</div>
          <div class="value" style="color:var(--ok)">{brl(hotmartFee)}</div>
          <div class="small muted">vs. 9,9% + R$ 2,49 por venda</div>
        </div>
      </div>
      <div class="card" style="margin-top:20px">
        <div class="row spread">
          <h3 style="margin:0">Vendas nos últimos 30 dias</h3>
          <span class="small muted">passe o mouse nas barras</span>
        </div>
        <div class="chart">
          {days.map((d) => (
            <div class="bar" style={`height:${Math.max(1, (d.v / max) * 100)}%`} data-tip={`${d.label.slice(8)}/${d.label.slice(5, 7)}: ${brl(d.v)}`} />
          ))}
        </div>
      </div>
      <div class="card" style="margin-top:20px">
        <div class="row spread">
          <h3 style="margin:0">Últimos pedidos</h3>
          <a href="/admin/pedidos" class="small">
            Ver todos →
          </a>
        </div>
        <OrdersTable orders={recent} compact />
      </div>
    </AdminLayout>,
  )
})

// ───────────── Pedidos ─────────────
function statusBadge(status: string) {
  const kind = status === 'paid' ? 'ok' : status === 'awaiting_confirmation' || status === 'pending' ? 'warn' : status === 'cancelled' ? '' : 'bad'
  return <span class={`badge ${kind}`}>{STATUS_LABEL[status] ?? status}</span>
}

function OrdersTable({ orders, compact }: { orders: (Order & { student_name: string; student_email?: string; course_title: string })[]; compact?: boolean }) {
  if (!orders.length)
    return (
      <div class="empty-state">
        <div class="big">🧾</div>Nenhum pedido por aqui ainda.
      </div>
    )
  return (
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Aluno</th>
            <th>Curso</th>
            <th>Valor</th>
            <th>Forma</th>
            <th>Status</th>
            {!compact && <th></th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr>
              <td>
                <code class="small">{o.id}</code>
                <div class="small muted">{dateBR(o.created_at)}</div>
              </td>
              <td>
                {o.student_name}
                {o.student_email && <div class="small muted">{o.student_email}</div>}
              </td>
              <td>{o.course_title}</td>
              <td>
                <strong>{brl(o.amount_cents)}</strong>
              </td>
              <td class="small">{METHOD_LABEL[o.method]}</td>
              <td>{statusBadge(o.status)}</td>
              {!compact && (
                <td>
                  <div class="row" style="justify-content:flex-end;flex-wrap:nowrap">
                    {(o.status === 'awaiting_confirmation' || (o.status === 'pending' && o.method === 'pix_manual')) && (
                      <form method="post" action={`/admin/pedidos/${o.id}/confirmar`} data-confirm={`Você confirma que recebeu ${brl(o.amount_cents)} via Pix com a identificação ${o.id}?`}>
                        <button class="btn ok sm" type="submit">
                          Confirmar Pix
                        </button>
                      </form>
                    )}
                    {o.status === 'refund_requested' && (
                      <form method="post" action={`/admin/pedidos/${o.id}/reembolsar`} data-confirm="Você já devolveu o Pix para o aluno pelo app do banco?">
                        <button class="btn sm" type="submit">
                          Marcar reembolsado
                        </button>
                      </form>
                    )}
                    {o.status === 'paid' && (
                      <form
                        method="post"
                        action={`/admin/pedidos/${o.id}/reembolsar`}
                        data-confirm={o.method === 'pix_manual' ? 'Isso remove o acesso do aluno. Lembre de devolver o Pix pelo app do banco. Continuar?' : 'O valor será devolvido automaticamente pelo Mercado Pago e o acesso removido. Continuar?'}
                      >
                        <button class="btn ghost sm" type="submit">
                          Reembolsar
                        </button>
                      </form>
                    )}
                    {(o.status === 'pending' || o.status === 'awaiting_confirmation') && (
                      <form method="post" action={`/admin/pedidos/${o.id}/cancelar`} data-confirm="Cancelar este pedido?">
                        <button class="btn ghost sm" type="submit">
                          Cancelar
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

app.get('/pedidos', async (c) => {
  const status = c.req.query('status') ?? ''
  const q = (c.req.query('q') ?? '').trim()
  const where: string[] = []
  const binds: (string | number)[] = []
  if (status && status in STATUS_LABEL) {
    where.push('o.status = ?')
    binds.push(status)
  } else where.push(`o.status != 'cancelled'`)
  if (q) {
    where.push('(s.email LIKE ? OR s.name LIKE ? OR o.id LIKE ?)')
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const { results } = await c.env.DB.prepare(
    `SELECT o.*, s.name student_name, s.email student_email, c.title course_title FROM orders o
     JOIN students s ON s.id = o.student_id JOIN courses c ON c.id = o.course_id
     WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT 200`,
  )
    .bind(...binds)
    .all<Order & { student_name: string; student_email: string; course_title: string }>()
  const tabs = [
    ['', 'Todos'],
    ['awaiting_confirmation', 'Confirmar Pix'],
    ['paid', 'Pagos'],
    ['pending', 'Aguardando'],
    ['refund_requested', 'Reembolso pedido'],
    ['refunded', 'Reembolsados'],
    ['cancelled', 'Cancelados'],
  ]
  return c.html(
    <AdminLayout title="Pedidos" s={c.get('settings')} active="/admin/pedidos">
      <div class="page-head">
        <h1>Pedidos</h1>
        <form method="get" class="row">
          <input type="hidden" name="status" value={status} />
          <input name="q" placeholder="Buscar por nome, e-mail ou pedido" value={q} style="width:280px" />
        </form>
      </div>
      <Flash msg={c.req.query('ok')} />
      <Flash msg={c.req.query('erro')} kind="bad" />
      <div class="tabs">
        {tabs.map(([k, label]) => (
          <a href={`/admin/pedidos${k ? `?status=${k}` : ''}`} class={status === k ? 'on' : ''}>
            {label}
          </a>
        ))}
      </div>
      <div class="card" style="padding:12px">
        <OrdersTable orders={results} />
      </div>
      {status === 'awaiting_confirmation' && (
        <p class="small muted" style="margin-top:14px">
          Dica: no app do banco, procure o Pix pelo valor e pela identificação (o código do pedido aparece na descrição do Pix).
        </p>
      )}
    </AdminLayout>,
  )
})

app.post('/pedidos/:id/confirmar', async (c) => {
  const order = await getOrder(c.env.DB, c.req.param('id'))
  if (order && order.method === 'pix_manual') await markPaid(c.env, c.get('settings'), origin(c), order)
  return c.redirect('/admin/pedidos?ok=' + encodeURIComponent('Pagamento confirmado. O aluno já tem acesso.'))
})

app.post('/pedidos/:id/reembolsar', async (c) => {
  const order = await getOrder(c.env.DB, c.req.param('id'))
  if (!order || !['paid', 'refund_requested'].includes(order.status)) return c.redirect('/admin/pedidos')
  if (order.status === 'refund_requested') {
    await c.env.DB.prepare(`UPDATE orders SET status = 'refunded', refunded_at = ? WHERE id = ?`).bind(now(), order.id).run()
    return c.redirect('/admin/pedidos?ok=Pedido+marcado+como+reembolsado.')
  }
  const err = await refundOrder(c.env, c.get('settings'), origin(c), order, 'admin')
  return c.redirect(err ? '/admin/pedidos?erro=' + encodeURIComponent(err) : '/admin/pedidos?ok=Reembolso+feito.')
})

app.post('/pedidos/:id/cancelar', async (c) => {
  await c.env.DB.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ? AND status IN ('pending','awaiting_confirmation')`).bind(c.req.param('id')).run()
  return c.redirect('/admin/pedidos?ok=Pedido+cancelado.')
})

// ───────────── Alunos ─────────────
app.get('/alunos', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.email, s.created_at,
       SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END) courses,
       SUM(CASE WHEN o.status = 'paid' THEN o.amount_cents ELSE 0 END) spent
     FROM students s LEFT JOIN orders o ON o.student_id = s.id GROUP BY s.id ORDER BY s.created_at DESC LIMIT 500`,
  ).all<{ id: number; name: string; email: string; created_at: number; courses: number; spent: number }>()
  return c.html(
    <AdminLayout title="Alunos" s={c.get('settings')} active="/admin/alunos">
      <div class="page-head">
        <h1>Alunos</h1>
        <span class="muted">{results.length} cadastrados</span>
      </div>
      <div class="card" style="padding:12px">
        {results.length ? (
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Cursos ativos</th>
                  <th>Total pago</th>
                  <th>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr>
                    <td>{r.name}</td>
                    <td>
                      <a href={`/admin/pedidos?q=${encodeURIComponent(r.email)}`}>{r.email}</a>
                    </td>
                    <td>{r.courses ?? 0}</td>
                    <td>{brl(r.spent ?? 0)}</td>
                    <td class="small muted">{dateBR(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="empty-state">
            <div class="big">🙋</div>Seus alunos aparecem aqui depois da primeira compra.
          </div>
        )}
      </div>
    </AdminLayout>,
  )
})

// ───────────── Cursos ─────────────
app.get('/cursos', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.course_id = c.id AND o.status = 'paid') sales FROM courses c ORDER BY c.created_at DESC`,
  ).all<Course & { sales: number }>()
  return c.html(
    <AdminLayout title="Cursos" s={c.get('settings')} active="/admin/cursos">
      <div class="page-head">
        <h1>Cursos</h1>
        <a class="btn" href="/admin/cursos/novo">
          + Novo curso
        </a>
      </div>
      <Flash msg={c.req.query('ok')} />
      {results.length ? (
        <div class="card" style="padding:12px">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Preço</th>
                  <th>Vendas</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr>
                    <td>
                      <strong>{r.title}</strong>
                      <div class="small muted">/c/{r.slug}</div>
                    </td>
                    <td>{brl(r.price_cents)}</td>
                    <td>{r.sales}</td>
                    <td>{r.published ? <span class="badge ok">Publicado</span> : <span class="badge">Rascunho</span>}</td>
                    <td>
                      <div class="row" style="justify-content:flex-end">
                        {r.published ? (
                          <a class="btn ghost sm" href={`/c/${r.slug}`} target="_blank">
                            Ver página
                          </a>
                        ) : null}
                        <a class="btn sm" href={`/admin/cursos/${r.id}`}>
                          Editar
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div class="card empty-state">
          <div class="big">🎬</div>
          <h3>Crie seu primeiro curso</h3>
          <p>Coloque título, preço e depois adicione os módulos e aulas.</p>
          <a class="btn" href="/admin/cursos/novo">
            Criar curso
          </a>
        </div>
      )}
    </AdminLayout>,
  )
})

function CourseForm({ course, error }: { course?: Partial<Course>; error?: string }) {
  const v = course ?? {}
  return (
    <form method="post" class="stack">
      <Flash msg={error} kind="bad" />
      <fieldset>
        <legend>Página de vendas</legend>
        <div class="field">
          <label for="title">Título do curso</label>
          <input id="title" name="title" required maxlength={120} value={v.title} />
        </div>
        <div class="field">
          <label for="subtitle">Frase de chamada</label>
          <input id="subtitle" name="subtitle" maxlength={200} value={v.subtitle} placeholder="Ex.: Aprenda do zero e crie seu primeiro app em 30 dias" />
        </div>
        <div class="grid g2" style="margin-top:16px">
          <div class="field">
            <label for="price">Preço (R$)</label>
            <input id="price" name="price" required inputmode="decimal" value={v.price_cents ? (v.price_cents / 100).toFixed(2).replace('.', ',') : ''} placeholder="97,00" />
          </div>
          <div class="field">
            <label for="slug">Endereço da página</label>
            <input id="slug" name="slug" value={v.slug} placeholder="gerado automaticamente" />
            <div class="hint">seusite.com/c/<strong>{v.slug || 'nome-do-curso'}</strong></div>
          </div>
        </div>
        <div class="field">
          <label for="bullets">O que o aluno vai aprender (um por linha)</label>
          <textarea id="bullets" name="bullets" rows={5}>
            {v.bullets}
          </textarea>
        </div>
        <div class="field">
          <label for="description">Descrição completa</label>
          <textarea id="description" name="description" rows={10}>
            {v.description}
          </textarea>
          <div class="hint">Aceita formatação simples: ## Título, **negrito**, *itálico*, listas com "- " e [links](https://...).</div>
        </div>
        <div class="field">
          <label>Imagem de capa (16:9)</label>
          <input type="hidden" name="cover_key" id="cover_key" value={v.cover_key ?? ''} />
          <input type="file" accept="image/*" data-upload="image" data-target="cover_key" data-bar="cover_bar" data-status="cover_status" />
          <div class="upload-bar" id="cover_bar">
            <span />
          </div>
          <div class="hint" id="cover_status">
            {v.cover_key ? 'Capa atual mantida. Envie outra para trocar.' : 'Recomendado: 1280×720.'}
          </div>
        </div>
        <label class="check" style="margin-top:16px">
          <input type="checkbox" name="published" value="1" checked={!!v.published} />
          <span>
            Publicado <span class="hint">(aparece na loja e aceita compras)</span>
          </span>
        </label>
      </fieldset>
      <div class="row">
        <button class="btn" type="submit">
          Salvar curso
        </button>
      </div>
    </form>
  )
}

async function readCourseForm(c: C, id?: number) {
  const f = await c.req.parseBody()
  const title = String(f.title ?? '').trim()
  const price = parseBRL(String(f.price ?? ''))
  const slug = slugify(String(f.slug ?? '') || title)
  const data = {
    title,
    subtitle: String(f.subtitle ?? '').trim(),
    description: String(f.description ?? ''),
    bullets: String(f.bullets ?? ''),
    price_cents: price ?? 0,
    slug,
    cover_key: String(f.cover_key ?? '') || null,
    published: f.published === '1' ? 1 : 0,
  }
  let error: string | undefined
  if (!title) error = 'Dê um título ao curso.'
  else if (price === null || price < 100) error = 'Preço inválido (mínimo R$ 1,00).'
  else if (!slug) error = 'Endereço inválido.'
  else if (data.cover_key && !data.cover_key.startsWith('public/')) error = 'Capa inválida.'
  else {
    const dup = await c.env.DB.prepare('SELECT id FROM courses WHERE slug = ? AND id != ?').bind(slug, id ?? 0).first()
    if (dup) error = 'Já existe um curso com esse endereço. Escolha outro.'
  }
  return { data, error }
}

app.get('/cursos/novo', (c) =>
  c.html(
    <AdminLayout title="Novo curso" s={c.get('settings')} active="/admin/cursos">
      <div class="page-head">
        <h1>Novo curso</h1>
      </div>
      <CourseForm />
    </AdminLayout>,
  ),
)

app.post('/cursos/novo', async (c) => {
  const { data, error } = await readCourseForm(c)
  if (error)
    return c.html(
      <AdminLayout title="Novo curso" s={c.get('settings')} active="/admin/cursos">
        <div class="page-head">
          <h1>Novo curso</h1>
        </div>
        <CourseForm course={data} error={error} />
      </AdminLayout>,
      400,
    )
  const r = await c.env.DB.prepare(
    'INSERT INTO courses (slug, title, subtitle, description, bullets, price_cents, cover_key, published, created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id',
  )
    .bind(data.slug, data.title, data.subtitle, data.description, data.bullets, data.price_cents, data.cover_key, data.published, now())
    .first<{ id: number }>()
  await c.env.DB.prepare('INSERT INTO modules (course_id, title, position) VALUES (?, ?, 0)').bind(r!.id, 'Módulo 1').run()
  return c.redirect(`/admin/cursos/${r!.id}?ok=` + encodeURIComponent('Curso criado! Agora adicione as aulas.'))
})

async function CourseEditPage({ c, course, error }: { c: C; course: Course; error?: string }) {
  const curriculum = await loadCurriculum(c.env.DB, course.id)
  return (
    <AdminLayout title={course.title} s={c.get('settings')} active="/admin/cursos">
      <div class="page-head">
        <div>
          <a class="small" href="/admin/cursos">
            ← Cursos
          </a>
          <h1>{course.title}</h1>
        </div>
        {course.published ? (
          <a class="btn ghost" href={`/c/${course.slug}`} target="_blank">
            Ver página de vendas ↗
          </a>
        ) : (
          <span class="badge">Rascunho</span>
        )}
      </div>
      <Flash msg={c.req.query('ok')} />
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));align-items:start">
        <CourseForm course={course} error={error} />
        <div class="stack">
          <fieldset>
            <legend>Módulos e aulas</legend>
            {curriculum.map((m) => (
              <div style="margin-bottom:22px">
                <div class="row spread" style="margin-bottom:8px">
                  <form method="post" action={`/admin/modulos/${m.id}`} class="row" style="flex:1">
                    <input name="title" value={m.title} style="flex:1;font-weight:650" />
                    <input name="position" type="number" value={String(m.position)} style="width:70px" title="Ordem" />
                    <button class="btn ghost sm" type="submit">
                      Salvar
                    </button>
                  </form>
                  <form method="post" action={`/admin/modulos/${m.id}/excluir`} data-confirm="Excluir este módulo e TODAS as aulas dele?">
                    <button class="btn ghost sm" type="submit" title="Excluir módulo">
                      ✕
                    </button>
                  </form>
                </div>
                {m.lessons.map((l) => (
                  <div class="lesson-row">
                    <span>
                      {l.title}{' '}
                      <span class="badge" style="margin-left:6px">
                        {l.video_type === 'none' ? 'texto' : l.video_type === 'r2' ? 'vídeo' : l.video_type}
                      </span>
                    </span>
                    <a class="btn ghost sm" href={`/admin/aulas/${l.id}`}>
                      Editar
                    </a>
                  </div>
                ))}
                <a class="btn sm" href={`/admin/aulas/nova?modulo=${m.id}`}>
                  + Aula
                </a>
              </div>
            ))}
            <form method="post" action={`/admin/cursos/${course.id}/modulos`} class="row">
              <input name="title" placeholder="Nome do novo módulo" required style="flex:1" />
              <button class="btn ghost" type="submit">
                + Módulo
              </button>
            </form>
          </fieldset>
          <fieldset>
            <legend>Zona de perigo</legend>
            <form method="post" action={`/admin/cursos/${course.id}/excluir`} data-confirm="Excluir o curso? Se ele já tiver vendas, será apenas despublicado.">
              <button class="btn danger sm" type="submit">
                Excluir curso
              </button>
            </form>
          </fieldset>
        </div>
      </div>
    </AdminLayout>
  )
}

const courseById = (c: C, id: string) => c.env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(Number(id)).first<Course>()

app.get('/cursos/:id', async (c) => {
  const course = await courseById(c, c.req.param('id'))
  if (!course) return c.notFound()
  return c.html(await CourseEditPage({ c, course }))
})

app.post('/cursos/:id', async (c) => {
  const course = await courseById(c, c.req.param('id'))
  if (!course) return c.notFound()
  const { data, error } = await readCourseForm(c, course.id)
  if (error) return c.html(await CourseEditPage({ c, course: { ...course, ...data }, error }), 400)
  await c.env.DB.prepare('UPDATE courses SET slug=?, title=?, subtitle=?, description=?, bullets=?, price_cents=?, cover_key=?, published=? WHERE id=?')
    .bind(data.slug, data.title, data.subtitle, data.description, data.bullets, data.price_cents, data.cover_key, data.published, course.id)
    .run()
  return c.redirect(`/admin/cursos/${course.id}?ok=Curso+salvo.`)
})

app.post('/cursos/:id/excluir', async (c) => {
  const id = Number(c.req.param('id'))
  const sold = await c.env.DB.prepare('SELECT 1 FROM orders WHERE course_id = ? LIMIT 1').bind(id).first()
  if (sold) {
    await c.env.DB.prepare('UPDATE courses SET published = 0 WHERE id = ?').bind(id).run()
    return c.redirect(`/admin/cursos?ok=` + encodeURIComponent('O curso tem pedidos, então foi só despublicado (alunos continuam com acesso).'))
  }
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM lessons WHERE module_id IN (SELECT id FROM modules WHERE course_id = ?)').bind(id),
    c.env.DB.prepare('DELETE FROM modules WHERE course_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM courses WHERE id = ?').bind(id),
  ])
  return c.redirect('/admin/cursos?ok=Curso+exclu%C3%ADdo.')
})

app.post('/cursos/:id/modulos', async (c) => {
  const id = Number(c.req.param('id'))
  const title = String((await c.req.parseBody()).title ?? '').trim() || 'Novo módulo'
  const pos = await c.env.DB.prepare('SELECT COALESCE(MAX(position), -1) + 1 p FROM modules WHERE course_id = ?').bind(id).first<{ p: number }>()
  await c.env.DB.prepare('INSERT INTO modules (course_id, title, position) VALUES (?, ?, ?)').bind(id, title, pos?.p ?? 0).run()
  return c.redirect(`/admin/cursos/${id}`)
})

app.post('/modulos/:id', async (c) => {
  const m = await c.env.DB.prepare('SELECT * FROM modules WHERE id = ?').bind(Number(c.req.param('id'))).first<Module>()
  if (!m) return c.notFound()
  const f = await c.req.parseBody()
  await c.env.DB.prepare('UPDATE modules SET title = ?, position = ? WHERE id = ?')
    .bind(String(f.title ?? m.title).trim() || m.title, Number(f.position ?? m.position) || 0, m.id)
    .run()
  return c.redirect(`/admin/cursos/${m.course_id}`)
})

app.post('/modulos/:id/excluir', async (c) => {
  const m = await c.env.DB.prepare('SELECT * FROM modules WHERE id = ?').bind(Number(c.req.param('id'))).first<Module>()
  if (!m) return c.notFound()
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM lessons WHERE module_id = ?').bind(m.id),
    c.env.DB.prepare('DELETE FROM modules WHERE id = ?').bind(m.id),
  ])
  return c.redirect(`/admin/cursos/${m.course_id}`)
})

// ───────────── Aulas ─────────────
function LessonForm({ c, lesson, moduleId, courseId, error }: { c: C; lesson?: Partial<Lesson>; moduleId: number; courseId: number; error?: string }) {
  const v = lesson ?? { video_type: 'r2' as const }
  const bunnyOn = !!c.get('settings').bunny_token_key
  return (
    <AdminLayout title={v.id ? 'Editar aula' : 'Nova aula'} s={c.get('settings')} active="/admin/cursos">
      <div class="page-head">
        <div>
          <a class="small" href={`/admin/cursos/${courseId}`}>
            ← Voltar ao curso
          </a>
          <h1>{v.id ? 'Editar aula' : 'Nova aula'}</h1>
        </div>
      </div>
      <form method="post" class="stack" style="max-width:760px">
        <Flash msg={error} kind="bad" />
        <input type="hidden" name="module_id" value={String(moduleId)} />
        <fieldset>
          <legend>Aula</legend>
          <div class="field">
            <label for="title">Título</label>
            <input id="title" name="title" required value={v.title} />
          </div>
          <div class="grid g2" style="margin-top:16px">
            <div class="field">
              <label for="duration_text">Duração (opcional)</label>
              <input id="duration_text" name="duration_text" value={v.duration_text} placeholder="12 min" />
            </div>
            <div class="field">
              <label for="position">Ordem</label>
              <input id="position" name="position" type="number" value={String(v.position ?? 0)} />
            </div>
          </div>
          <div class="field">
            <label for="description">Texto / materiais da aula</label>
            <textarea id="description" name="description" rows={6}>
              {v.description}
            </textarea>
            <div class="hint">Aceita **negrito**, listas e [links](https://...) — ótimo para materiais de apoio.</div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Vídeo</legend>
          <div class="field">
            <label for="video_type">Onde está o vídeo?</label>
            <select id="video_type" name="video_type" data-toggle="">
              <option value="r2" selected={v.video_type === 'r2'}>
                Enviar arquivo (grátis, protegido) — recomendado
              </option>
              <option value="bunny" selected={v.video_type === 'bunny'}>
                Bunny Stream (pago à parte, mais proteção)
              </option>
              <option value="embed" selected={v.video_type === 'embed'}>
                Link de incorporação (Panda Video, Vimeo, YouTube…)
              </option>
              <option value="none" selected={v.video_type === 'none'}>
                Sem vídeo (só texto)
              </option>
            </select>
          </div>
          <div class="field" data-show-for="r2">
            <input type="hidden" name="r2_key" id="r2_key" value={v.video_type === 'r2' ? (v.video_ref ?? '') : ''} />
            <label>Arquivo de vídeo (MP4)</label>
            <input type="file" accept="video/mp4,video/webm,video/*" data-upload="video" data-target="r2_key" data-bar="vbar" data-status="vstatus" />
            <div class="upload-bar" id="vbar">
              <span />
            </div>
            <div class="hint" id="vstatus">
              {v.video_type === 'r2' && v.video_ref ? 'Vídeo atual mantido. Envie outro para trocar.' : 'Vídeos grandes são enviados em partes. Não feche a página até terminar.'}
            </div>
          </div>
          <div class="field" data-show-for="bunny">
            <label for="bunny_ref">Biblioteca/ID do vídeo no Bunny</label>
            <input id="bunny_ref" name="bunny_ref" value={v.video_type === 'bunny' ? (v.video_ref ?? '') : ''} placeholder="123456/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" />
            <div class="hint">
              No Bunny: Stream → sua biblioteca → vídeo → copie o Library ID e o Video ID.{' '}
              {!bunnyOn && 'Para proteger com token, cadastre a "Token Authentication Key" em Configurações.'}
            </div>
          </div>
          <div class="field" data-show-for="embed">
            <label for="embed_ref">Link de incorporação (https://...)</label>
            <input id="embed_ref" name="embed_ref" type="url" value={v.video_type === 'embed' ? (v.video_ref ?? '') : ''} placeholder="https://player-vz-....tv.pandavideo.com.br/embed/?v=..." />
            <div class="hint">Use o link do player (iframe). Atenção: YouTube “não listado” não é protegido — quem tiver o link assiste.</div>
          </div>
        </fieldset>
        <div class="row">
          <button class="btn" type="submit">
            Salvar aula
          </button>
        </div>
      </form>
      {v.id && (
        <form method="post" action={`/admin/aulas/${v.id}/excluir`} data-confirm="Excluir esta aula?" style="margin-top:16px">
          <button class="btn danger sm" type="submit">
            Excluir aula
          </button>
        </form>
      )}
    </AdminLayout>
  )
}

async function readLessonForm(c: C) {
  const f = await c.req.parseBody()
  const type = String(f.video_type ?? 'none') as Lesson['video_type']
  let ref: string | null = null
  let error: string | undefined
  if (type === 'r2') {
    ref = String(f.r2_key ?? '') || null
    if (ref && !ref.startsWith('private/')) error = 'Vídeo inválido.'
    if (!ref) error = 'Envie o arquivo de vídeo (ou escolha "Sem vídeo").'
  } else if (type === 'bunny') {
    ref = String(f.bunny_ref ?? '').trim()
    if (!/^\d+\/[\w-]+$/.test(ref)) error = 'Informe no formato BIBLIOTECA/ID_DO_VIDEO.'
  } else if (type === 'embed') {
    ref = String(f.embed_ref ?? '').trim()
    if (!ref.startsWith('https://')) error = 'O link precisa começar com https://'
  } else if (type !== 'none') error = 'Tipo de vídeo inválido.'
  const data = {
    module_id: Number(f.module_id),
    title: String(f.title ?? '').trim(),
    description: String(f.description ?? ''),
    duration_text: String(f.duration_text ?? '').trim(),
    position: Number(f.position ?? 0) || 0,
    video_type: type,
    video_ref: ref,
  }
  if (!data.title) error = 'Dê um título à aula.'
  return { data, error }
}

async function moduleCourse(c: C, moduleId: number) {
  return c.env.DB.prepare('SELECT * FROM modules WHERE id = ?').bind(moduleId).first<Module>()
}

app.get('/aulas/nova', async (c) => {
  const m = await moduleCourse(c, Number(c.req.query('modulo')))
  if (!m) return c.notFound()
  const pos = await c.env.DB.prepare('SELECT COALESCE(MAX(position), -1) + 1 p FROM lessons WHERE module_id = ?').bind(m.id).first<{ p: number }>()
  return c.html(<LessonForm c={c} moduleId={m.id} courseId={m.course_id} lesson={{ video_type: 'r2', position: pos?.p ?? 0 }} />)
})

app.post('/aulas/nova', async (c) => {
  const { data, error } = await readLessonForm(c)
  const m = await moduleCourse(c, data.module_id)
  if (!m) return c.notFound()
  if (error) return c.html(<LessonForm c={c} moduleId={m.id} courseId={m.course_id} lesson={data} error={error} />, 400)
  await c.env.DB.prepare('INSERT INTO lessons (module_id, title, description, position, video_type, video_ref, duration_text) VALUES (?,?,?,?,?,?,?)')
    .bind(m.id, data.title, data.description, data.position, data.video_type, data.video_ref, data.duration_text)
    .run()
  return c.redirect(`/admin/cursos/${m.course_id}?ok=Aula+salva.`)
})

app.get('/aulas/:id', async (c) => {
  const l = await c.env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(Number(c.req.param('id'))).first<Lesson>()
  if (!l) return c.notFound()
  const m = (await moduleCourse(c, l.module_id))!
  return c.html(<LessonForm c={c} moduleId={m.id} courseId={m.course_id} lesson={l} />)
})

app.post('/aulas/:id', async (c) => {
  const l = await c.env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(Number(c.req.param('id'))).first<Lesson>()
  if (!l) return c.notFound()
  const { data, error } = await readLessonForm(c)
  const m = (await moduleCourse(c, l.module_id))!
  if (error) return c.html(<LessonForm c={c} moduleId={m.id} courseId={m.course_id} lesson={{ ...data, id: l.id }} error={error} />, 400)
  if (l.video_type === 'r2' && l.video_ref && l.video_ref !== data.video_ref) await c.env.BUCKET.delete(l.video_ref)
  await c.env.DB.prepare('UPDATE lessons SET title=?, description=?, position=?, video_type=?, video_ref=?, duration_text=? WHERE id=?')
    .bind(data.title, data.description, data.position, data.video_type, data.video_ref, data.duration_text, l.id)
    .run()
  return c.redirect(`/admin/cursos/${m.course_id}?ok=Aula+salva.`)
})

app.post('/aulas/:id/excluir', async (c) => {
  const l = await c.env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(Number(c.req.param('id'))).first<Lesson>()
  if (!l) return c.notFound()
  const m = (await moduleCourse(c, l.module_id))!
  if (l.video_type === 'r2' && l.video_ref) await c.env.BUCKET.delete(l.video_ref)
  await c.env.DB.prepare('DELETE FROM lessons WHERE id = ?').bind(l.id).run()
  return c.redirect(`/admin/cursos/${m.course_id}?ok=Aula+exclu%C3%ADda.`)
})

// ───────────── Upload para o R2 ─────────────
function uploadKey(c: C): { key: string; type: string } | null {
  const kind = c.req.query('kind')
  const type = c.req.query('type') ?? ''
  const name = (c.req.query('name') ?? 'arquivo').replace(/[^\w.\-]/g, '_').slice(-60)
  if (kind === 'image' && /^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(type)) return { key: `public/img/${randomId(10)}-${name}`, type }
  if (kind === 'video' && type.startsWith('video/')) return { key: `private/videos/${randomId(16)}-${name}`, type }
  return null
}

app.post('/upload/simple', async (c) => {
  const k = uploadKey(c)
  if (!k) return c.text('Tipo de arquivo não permitido.', 400)
  if (!c.req.raw.body) return c.text('Arquivo vazio.', 400)
  await c.env.BUCKET.put(k.key, c.req.raw.body, { httpMetadata: { contentType: k.type } })
  return c.json({ key: k.key })
})

app.post('/upload/start', async (c) => {
  const k = uploadKey(c)
  if (!k || !k.key.startsWith('private/')) return c.text('Tipo de arquivo não permitido.', 400)
  const up = await c.env.BUCKET.createMultipartUpload(k.key, { httpMetadata: { contentType: k.type } })
  return c.json({ key: up.key, uploadId: up.uploadId })
})

app.post('/upload/part', async (c) => {
  const key = c.req.query('key') ?? ''
  const part = Number(c.req.query('part'))
  if (!key.startsWith('private/videos/') || !(part >= 1 && part <= 10000) || !c.req.raw.body) return c.text('Requisição inválida.', 400)
  const up = c.env.BUCKET.resumeMultipartUpload(key, c.req.query('uploadId') ?? '')
  const p = await up.uploadPart(part, c.req.raw.body)
  return c.json(p)
})

app.post('/upload/finish', async (c) => {
  const key = c.req.query('key') ?? ''
  if (!key.startsWith('private/videos/')) return c.text('Requisição inválida.', 400)
  const parts = (await c.req.json()) as R2UploadedPart[]
  const up = c.env.BUCKET.resumeMultipartUpload(key, c.req.query('uploadId') ?? '')
  await up.complete(parts.sort((a, b) => a.partNumber - b.partNumber))
  return c.json({ key })
})

// ───────────── Configurações ─────────────
function Secret({ name, label, s, hint }: { name: string; label: string; s: Record<string, string>; hint?: any }) {
  return (
    <div class="field">
      <label for={name}>
        {label} {s[name] ? <span class="badge ok">configurado ✓</span> : null}
      </label>
      <input id={name} name={name} type="password" autocomplete="off" placeholder={s[name] ? '•••••••• (deixe vazio para manter)' : ''} />
      {hint && <div class="hint">{hint}</div>}
      {s[name] ? (
        <label class="check small" style="margin-top:6px">
          <input type="checkbox" name={`clear_${name}`} value="1" />
          <span>Remover</span>
        </label>
      ) : null}
    </div>
  )
}

app.get('/configuracoes', (c) => {
  const s = c.get('settings')
  const webhook = `${origin(c)}/webhooks/mercadopago`
  const m = enabledMethods(s)
  return c.html(
    <AdminLayout title="Configurações" s={s} active="/admin/configuracoes">
      <div class="page-head">
        <h1>Configurações</h1>
      </div>
      {c.req.query('bemvindo') && (
        <div class="alert info">
          <strong>Loja criada! 🎉</strong> Agora dê um nome a ela e escolha como quer receber. Depois é só criar seu primeiro curso.
        </div>
      )}
      <Flash msg={c.req.query('ok')} />
      <Flash msg={c.req.query('erro')} kind="bad" />
      <form method="post" class="stack" style="max-width:820px">
        <fieldset>
          <legend>Sua loja</legend>
          <div class="grid g2">
            <div class="field">
              <label for="store_name">Nome da loja</label>
              <input id="store_name" name="store_name" required value={s.store_name} />
            </div>
            <div class="field">
              <label for="accent_color">Cor principal</label>
              <input id="accent_color" name="accent_color" type="color" value={s.accent_color} />
            </div>
          </div>
          <div class="field">
            <label for="store_tagline">Frase da página inicial</label>
            <input id="store_tagline" name="store_tagline" value={s.store_tagline} />
          </div>
          <div class="field">
            <label>Logo (quadrado)</label>
            <input type="hidden" name="logo_key" id="logo_key" value={s.logo_key} />
            <input type="file" accept="image/*" data-upload="image" data-target="logo_key" data-bar="logo_bar" data-status="logo_status" />
            <div class="upload-bar" id="logo_bar">
              <span />
            </div>
            <div class="hint" id="logo_status">
              {s.logo_key ? 'Logo atual mantido.' : 'Opcional.'}
            </div>
          </div>
          <div class="grid g2">
            <div class="field">
              <label for="seller_email">Seu e-mail (para avisos de venda)</label>
              <input id="seller_email" name="seller_email" type="email" value={s.seller_email} />
            </div>
            <div class="field">
              <label for="support_contact">Contato de suporte (aparece para alunos)</label>
              <input id="support_contact" name="support_contact" value={s.support_contact} placeholder="WhatsApp ou e-mail" />
            </div>
          </div>
          <div class="field">
            <label for="footer_text">Texto do rodapé</label>
            <input id="footer_text" name="footer_text" value={s.footer_text} placeholder="Ex.: CNPJ 00.000.000/0001-00" />
          </div>
        </fieldset>

        <fieldset id="pagamentos">
          <legend>Pix direto na sua conta (grátis)</legend>
          <p class="small muted">
            Funciona com qualquer banco (Nubank, Inter, Caixa…). O site gera o QR Code com o valor certo e o dinheiro cai direto na sua chave, <strong>sem nenhuma taxa</strong>. Como o banco não avisa o site, você confere o Pix no app e clica em “Confirmar” no painel (recebe um e-mail quando o aluno disser que pagou).
          </p>
          <label class="check">
            <input type="checkbox" name="pix_manual_enabled" value="1" checked={s.pix_manual_enabled === '1'} />
            <span>Ativar Pix direto</span>
          </label>
          <div class="grid g2" style="margin-top:14px">
            <div class="field">
              <label for="pix_key">Chave Pix</label>
              <input id="pix_key" name="pix_key" value={s.pix_key} placeholder="e-mail, CPF/CNPJ, +5511999999999 ou aleatória" />
              <div class="hint">Celular: use o formato +55DDDNÚMERO.</div>
            </div>
            <div class="field">
              <label for="pix_name">Nome do recebedor</label>
              <input id="pix_name" name="pix_name" value={s.pix_name} maxlength={25} placeholder="Como aparece no banco" />
            </div>
          </div>
          <div class="field">
            <label for="pix_city">Cidade</label>
            <input id="pix_city" name="pix_city" value={s.pix_city} maxlength={15} placeholder="SAO PAULO" />
          </div>
          {s.pix_manual_enabled === '1' && !m.pix_manual && <div class="alert warn small">Preencha chave, nome e cidade para ativar.</div>}
        </fieldset>

        <fieldset>
          <legend>Mercado Pago (Pix automático e cartão)</legend>
          <p class="small muted">
            Com o Mercado Pago o acesso é liberado <strong>sozinho</strong>, na hora. Taxas cobradas pelo Mercado Pago (não por nós): ~0,99% no Pix e ~4–5% no cartão. Aceita conta com CPF.
          </p>
          <ol class="small" style="padding-left:1.2em">
            <li>
              Entre em <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener">mercadopago.com.br/developers</a> → “Criar aplicação”.
            </li>
            <li>Em “Credenciais de produção”, copie o <strong>Access Token</strong> e cole abaixo.</li>
            <li>
              Em “Webhooks”, cole esta URL e marque o evento <strong>Pagamentos</strong>:
              <div class="copy" style="margin:8px 0">
                <input id="wh" readonly value={webhook} />
                <button class="btn ghost sm" type="button" data-copy="wh">
                  Copiar
                </button>
              </div>
              Depois copie a “assinatura secreta” e cole abaixo (opcional, mais segurança).
            </li>
          </ol>
          <Secret name="mp_access_token" label="Access Token" s={s} hint="Começa com APP_USR-. Para testes, use o token de teste (TEST-)." />
          <Secret name="mp_webhook_secret" label="Assinatura secreta do webhook (opcional)" s={s} />
          <div class="grid g2" style="margin-top:12px">
            <label class="check">
              <input type="checkbox" name="mp_pix_enabled" value="1" checked={s.mp_pix_enabled === '1'} />
              <span>Pix automático</span>
            </label>
            <label class="check">
              <input type="checkbox" name="mp_card_enabled" value="1" checked={s.mp_card_enabled === '1'} />
              <span>Cartão de crédito</span>
            </label>
          </div>
          <div class="field" style="margin-top:12px;max-width:240px">
            <label for="mp_max_installments">Parcelas máximas no cartão</label>
            <select id="mp_max_installments" name="mp_max_installments">
              {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                <option value={String(n)} selected={s.mp_max_installments === String(n)}>
                  {n}x
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset id="email">
          <legend>E-mails automáticos (opcional, grátis)</legend>
          <p class="small muted">
            Envia “compra confirmada”, avisos de venda e recuperação de senha. Crie uma conta grátis em{' '}
            <a href="https://resend.com" target="_blank" rel="noopener">
              resend.com
            </a>{' '}
            (3.000 e-mails/mês), verifique seu domínio e gere uma API Key.
          </p>
          <Secret name="resend_api_key" label="Resend API Key" s={s} />
          <div class="field">
            <label for="email_from">E-mail remetente</label>
            <input id="email_from" name="email_from" type="email" value={s.email_from} placeholder="contato@seudominio.com" />
          </div>
        </fieldset>

        <fieldset>
          <legend>Vídeos com Bunny Stream (opcional, pago à parte)</legend>
          <p class="small muted">
            Só se você usar o Bunny. Em Stream → sua biblioteca → Security, ative “Embed view token authentication” e cole a chave aqui. Assim os links do player expiram e não podem ser compartilhados.
          </p>
          <Secret name="bunny_token_key" label="Token Authentication Key" s={s} />
        </fieldset>

        <fieldset>
          <legend>Garantia e termos</legend>
          <div class="field" style="max-width:240px">
            <label for="refund_days">Dias de garantia</label>
            <input id="refund_days" name="refund_days" type="number" min={7} max={90} value={s.refund_days} />
            <div class="hint">Mínimo de 7 dias pelo Código de Defesa do Consumidor.</div>
          </div>
          <div class="field">
            <label for="terms_text">Termos de compra (opcional)</label>
            <textarea id="terms_text" name="terms_text" rows={8} placeholder="Deixe vazio para usar o modelo padrão (veja em /termos)">
              {s.terms_text}
            </textarea>
          </div>
        </fieldset>

        <div class="row">
          <button class="btn lg" type="submit">
            Salvar configurações
          </button>
        </div>
      </form>
    </AdminLayout>,
  )
})

app.post('/configuracoes', async (c) => {
  const f = await c.req.parseBody()
  const str = (k: string) => String(f[k] ?? '').trim()
  const values: Record<string, string> = {
    store_name: str('store_name') || 'Minha Escola',
    store_tagline: str('store_tagline'),
    accent_color: isHexColor(str('accent_color')) ? str('accent_color') : '#6d4aff',
    seller_email: str('seller_email'),
    support_contact: str('support_contact'),
    footer_text: str('footer_text'),
    pix_manual_enabled: f.pix_manual_enabled === '1' ? '1' : '0',
    pix_key: str('pix_key'),
    pix_name: str('pix_name'),
    pix_city: str('pix_city'),
    mp_pix_enabled: f.mp_pix_enabled === '1' ? '1' : '0',
    mp_card_enabled: f.mp_card_enabled === '1' ? '1' : '0',
    mp_max_installments: String(Math.min(12, Math.max(1, Number(str('mp_max_installments')) || 12))),
    email_from: str('email_from'),
    refund_days: String(Math.min(90, Math.max(7, Number(str('refund_days')) || 7))),
    terms_text: String(f.terms_text ?? ''),
  }
  const logo = str('logo_key')
  if (!logo || logo.startsWith('public/')) values.logo_key = logo
  for (const k of SECRET_KEYS) {
    if (f[`clear_${k}`] === '1') values[k] = ''
    else if (str(k)) values[k] = str(k)
  }
  await saveSettings(c.env.DB, values)
  return c.redirect('/admin/configuracoes?ok=Configura%C3%A7%C3%B5es+salvas.')
})

export default app
