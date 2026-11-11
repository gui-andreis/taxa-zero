import { Hono, type Context } from 'hono'
import type { AppEnv, Course, Lesson, Order } from '../env'
import { Cover, Flash, Layout } from '../views/layout'
import { brl, isEmail, now, STATUS_LABEL, METHOD_LABEL } from '../lib/format'
import { hashPassword, randomToken, sha256Hex, verifyPassword } from '../lib/crypto'
import { createSession, destroySession, tooManyAttempts } from '../lib/auth'
import { canStudentRefund, getOrder, hasAccess, refundOrder } from '../lib/orders'
import { markdown } from '../lib/markdown'
import { emailReady } from '../lib/settings'
import { sendEmail } from '../lib/email'
import { loadCurriculum, origin } from './public'

const app = new Hono<AppEnv>()

function safeNext(next: string | undefined) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/aluno'
}

// ───────────── Entrar / sair ─────────────
function LoginPage({ c, error, ok, email }: { c: Context<AppEnv>; error?: string; ok?: string; email?: string }) {
  const s = c.get('settings')
  return (
    <Layout s={s} title="Entrar">
      <div class="narrow auth">
        <div class="card pad-lg stack">
          <div class="center">
            <h2>Área do aluno</h2>
            <p class="muted">Entre com o e-mail e a senha que você criou na compra.</p>
          </div>
          <Flash msg={error} kind="bad" />
          <Flash msg={ok} kind="ok" />
          <form method="post" class="stack">
            <input type="hidden" name="next" value={c.req.query('next') ?? ''} />
            <div class="field">
              <label for="email">E-mail</label>
              <input id="email" name="email" type="email" required value={email} autocomplete="email" />
            </div>
            <div class="field">
              <label for="password">Senha</label>
              <input id="password" name="password" type="password" required autocomplete="current-password" />
            </div>
            <button class="btn block" type="submit">
              Entrar
            </button>
          </form>
          <p class="center small">
            <a href="/aluno/esqueci">Esqueci minha senha</a>
          </p>
        </div>
      </div>
    </Layout>
  )
}

app.get('/entrar', (c) => (c.get('student') ? c.redirect('/aluno') : c.html(<LoginPage c={c} />)))

app.post('/entrar', async (c) => {
  const form = await c.req.parseBody()
  const email = String(form.email ?? '').trim().toLowerCase()
  const password = String(form.password ?? '')
  if (await tooManyAttempts(c, 'aluno', email)) return c.html(<LoginPage c={c} email={email} error="Muitas tentativas. Aguarde 15 minutos." />, 429)
  const row = await c.env.DB.prepare('SELECT id, password_hash FROM students WHERE email = ?').bind(email).first<{ id: number; password_hash: string }>()
  if (!row || !(await verifyPassword(password, row.password_hash)))
    return c.html(<LoginPage c={c} email={email} error="E-mail ou senha incorretos." />, 401)
  await createSession(c, 'student', row.id)
  return c.redirect(safeNext(String(form.next ?? '')))
})

app.post('/sair', async (c) => {
  await destroySession(c, 'student')
  return c.redirect('/')
})

// ───────────── Esqueci a senha ─────────────
app.get('/esqueci', (c) => {
  const s = c.get('settings')
  return c.html(
    <Layout s={s} title="Recuperar senha">
      <div class="narrow auth">
        <div class="card pad-lg stack">
          <h2 class="center">Recuperar senha</h2>
          {emailReady(s) ? (
            <form method="post" class="stack">
              <div class="field">
                <label for="email">Seu e-mail</label>
                <input id="email" name="email" type="email" required />
              </div>
              <button class="btn block" type="submit">
                Enviar link
              </button>
            </form>
          ) : (
            <p class="muted center">Fale com o suporte para redefinir sua senha{s.support_contact ? `: ${s.support_contact}` : '.'}</p>
          )}
        </div>
      </div>
    </Layout>,
  )
})

app.post('/esqueci', async (c) => {
  const s = c.get('settings')
  const email = String((await c.req.parseBody()).email ?? '').trim().toLowerCase()
  if (isEmail(email) && !(await tooManyAttempts(c, 'reset', email))) {
    const st = await c.env.DB.prepare('SELECT id FROM students WHERE email = ?').bind(email).first<{ id: number }>()
    if (st) {
      const token = randomToken()
      await c.env.DB.prepare('INSERT INTO password_resets (id, student_id, expires_at) VALUES (?, ?, ?)')
        .bind(await sha256Hex(token), st.id, now() + 60 * 60 * 1000)
        .run()
      await sendEmail(s, email, 'Redefinir sua senha', ['Clique no botão para criar uma nova senha. O link vale por 1 hora.'], {
        label: 'Criar nova senha',
        url: `${origin(c)}/aluno/redefinir/${token}`,
      })
    }
  }
  // Mesma resposta sempre (não revela quais e-mails existem)
  return c.html(<LoginPage c={c} ok="Se esse e-mail tiver cadastro, enviamos um link para redefinir a senha." />)
})

app.get('/redefinir/:token', (c) => {
  const s = c.get('settings')
  return c.html(
    <Layout s={s} title="Nova senha">
      <div class="narrow auth">
        <form method="post" class="card pad-lg stack">
          <h2 class="center">Crie uma nova senha</h2>
          <div class="field">
            <label for="password">Nova senha</label>
            <input id="password" name="password" type="password" minlength={8} required autocomplete="new-password" />
          </div>
          <button class="btn block" type="submit">
            Salvar e entrar
          </button>
        </form>
      </div>
    </Layout>,
  )
})

app.post('/redefinir/:token', async (c) => {
  const password = String((await c.req.parseBody()).password ?? '')
  const id = await sha256Hex(c.req.param('token'))
  const row = await c.env.DB.prepare('SELECT student_id, expires_at FROM password_resets WHERE id = ?').bind(id).first<{ student_id: number; expires_at: number }>()
  if (!row || row.expires_at < now()) return c.html(<LoginPage c={c} error="Link inválido ou expirado. Peça outro." />, 400)
  if (password.length < 8) return c.redirect(c.req.path)
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE students SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), row.student_id),
    c.env.DB.prepare('DELETE FROM password_resets WHERE student_id = ?').bind(row.student_id),
    c.env.DB.prepare(`DELETE FROM sessions WHERE kind = 'student' AND user_id = ?`).bind(row.student_id),
  ])
  await createSession(c, 'student', row.student_id)
  return c.redirect('/aluno')
})

// ───────────── Tudo abaixo exige login ─────────────
app.use('*', async (c, next) => {
  if (!c.get('student')) return c.redirect(`/aluno/entrar?next=${encodeURIComponent(c.req.path)}`)
  await next()
})

app.get('/', async (c) => {
  const s = c.get('settings')
  const student = c.get('student')!
  const { results: orders } = await c.env.DB.prepare(
    `SELECT o.*, c.title AS course_title, c.cover_key, c.slug FROM orders o JOIN courses c ON c.id = o.course_id
     WHERE o.student_id = ? AND o.status != 'cancelled' ORDER BY o.created_at DESC`,
  )
    .bind(student.id)
    .all<Order & { course_title: string; cover_key: string | null; slug: string }>()
  const active = orders.filter((o) => o.status === 'paid')
  const others = orders.filter((o) => o.status !== 'paid')
  const flash = c.req.query('ok') ? 'Reembolso solicitado. Seu acesso a este curso foi encerrado.' : c.req.query('erro')
  return c.html(
    <Layout s={s} student={student} title="Meus cursos">
      <div class="wrap" style="padding:40px 20px 80px">
        <div class="row spread" style="margin-bottom:24px">
          <div>
            <h1 style="font-size:2rem;margin:0">Olá, {student.name.split(' ')[0]}!</h1>
            <p class="muted" style="margin:0">Seus cursos estão aqui.</p>
          </div>
          <form method="post" action="/aluno/sair">
            <button class="btn ghost sm" type="submit">
              Sair
            </button>
          </form>
        </div>
        <Flash msg={flash} kind={c.req.query('ok') ? 'ok' : 'bad'} />
        {active.length ? (
          <div class="grid g3">
            {active.map((o) => (
              <div class="card course-card">
                <a href={`/aluno/curso/${o.course_id}`} style="color:inherit">
                  <Cover course={{ title: o.course_title, cover_key: o.cover_key }} />
                </a>
                <div class="body">
                  <h3>{o.course_title}</h3>
                  <a class="btn block" href={`/aluno/curso/${o.course_id}`}>
                    Assistir
                  </a>
                  {canStudentRefund(s, o) && (
                    <form method="post" action={`/aluno/pedido/${o.id}/reembolso`} data-confirm="Tem certeza? Seu acesso ao curso será encerrado e o valor devolvido.">
                      <button class="btn ghost sm block" type="submit" style="margin-top:6px">
                        Pedir reembolso (garantia de {s.refund_days} dias)
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div class="card empty-state">
            <div class="big">📚</div>
            <h3>Você ainda não tem cursos liberados</h3>
            <a href="/">Ver cursos disponíveis</a>
          </div>
        )}
        {others.length > 0 && (
          <div class="card" style="margin-top:28px">
            <h3>Outros pedidos</h3>
            <div class="table-wrap">
              <table>
                <tbody>
                  {others.map((o) => (
                    <tr>
                      <td>{o.course_title}</td>
                      <td>{brl(o.amount_cents)}</td>
                      <td>{METHOD_LABEL[o.method]}</td>
                      <td>
                        <span class="badge">{STATUS_LABEL[o.status]}</span>
                      </td>
                      <td>{(o.status === 'pending' || o.status === 'awaiting_confirmation') && <a href={`/pedido/${o.id}`}>Ver pedido</a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>,
  )
})

app.post('/pedido/:id/reembolso', async (c) => {
  const s = c.get('settings')
  const order = await getOrder(c.env.DB, c.req.param('id'))
  if (!order || order.student_id !== c.get('student')!.id) return c.notFound()
  if (!canStudentRefund(s, order)) return c.redirect('/aluno?erro=' + encodeURIComponent('O prazo de garantia deste pedido já terminou.'))
  const err = await refundOrder(c.env, s, origin(c), order, 'student')
  if (err) return c.redirect('/aluno?erro=' + encodeURIComponent(err + ' Fale com o suporte.'))
  return c.redirect('/aluno?ok=1')
})

// ───────────── Player ─────────────
app.get('/curso/:id', async (c) => {
  const courseId = Number(c.req.param('id'))
  const first = await c.env.DB.prepare(
    'SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ? ORDER BY m.position, m.id, l.position, l.id LIMIT 1',
  )
    .bind(courseId)
    .first<{ id: number }>()
  if (!(await hasAccess(c.env.DB, c.get('student')!.id, courseId))) return c.redirect('/aluno')
  return first ? c.redirect(`/aluno/curso/${courseId}/aula/${first.id}`) : c.redirect('/aluno?erro=' + encodeURIComponent('Este curso ainda não tem aulas.'))
})

async function bunnyEmbed(tokenKey: string, ref: string) {
  const [lib, vid] = ref.split('/')
  if (!lib || !vid) return null
  const base = `https://iframe.mediadelivery.net/embed/${encodeURIComponent(lib)}/${encodeURIComponent(vid)}`
  if (!tokenKey) return base
  const expires = Math.floor(Date.now() / 1000) + 6 * 3600
  return `${base}?token=${await sha256Hex(tokenKey + vid + expires)}&expires=${expires}`
}

app.get('/curso/:id/aula/:lessonId', async (c) => {
  const s = c.get('settings')
  const student = c.get('student')!
  const courseId = Number(c.req.param('id'))
  if (!(await hasAccess(c.env.DB, student.id, courseId))) return c.redirect('/aluno')
  const course = await c.env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(courseId).first<Course>()
  if (!course) return c.notFound()
  const curriculum = await loadCurriculum(c.env.DB, courseId)
  const flat = curriculum.flatMap((m) => m.lessons)
  const idx = flat.findIndex((l) => l.id === Number(c.req.param('lessonId')))
  if (idx < 0) return c.notFound()
  const lesson: Lesson = flat[idx]
  const prev = flat[idx - 1]
  const next = flat[idx + 1]

  let player
  if (lesson.video_type === 'r2' && lesson.video_ref) {
    player = (
      <div class="video">
        <video controls preload="metadata" playsinline controlslist="nodownload" src={`/media/v/${lesson.id}`} />
      </div>
    )
  } else if (lesson.video_type === 'bunny' && lesson.video_ref) {
    const src = await bunnyEmbed(s.bunny_token_key, lesson.video_ref)
    player = <div class="video">{src && <iframe src={src} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen />}</div>
  } else if (lesson.video_type === 'embed' && lesson.video_ref?.startsWith('https://')) {
    player = (
      <div class="video">
        <iframe src={lesson.video_ref} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen />
      </div>
    )
  } else {
    player = <div class="video empty">Esta aula não tem vídeo — veja o conteúdo abaixo.</div>
  }

  return c.html(
    <Layout s={s} student={student} title={lesson.title}>
      <div class="wrap player">
        <div class="stack">
          {player}
          <div class="row spread">
            <div>
              <div class="muted small">{course.title}</div>
              <h2 style="margin:0">{lesson.title}</h2>
            </div>
            <div class="row">
              {prev && (
                <a class="btn ghost sm" href={`/aluno/curso/${courseId}/aula/${prev.id}`}>
                  ← Anterior
                </a>
              )}
              {next && (
                <a class="btn sm" href={`/aluno/curso/${courseId}/aula/${next.id}`}>
                  Próxima →
                </a>
              )}
            </div>
          </div>
          {lesson.description && <div class="card prose" dangerouslySetInnerHTML={{ __html: markdown(lesson.description) }} />}
        </div>
        <aside class="card lessons">
          <div style="padding:10px 10px 4px">
            <div class="small muted">
              Aula {idx + 1} de {flat.length}
            </div>
            <div class="progress" style="margin-top:6px">
              <span style={`width:${Math.round(((idx + 1) / flat.length) * 100)}%`} />
            </div>
          </div>
          {curriculum.map((m) => (
            <div>
              <h4>{m.title}</h4>
              {m.lessons.map((l) => (
                <a href={`/aluno/curso/${courseId}/aula/${l.id}`} class={l.id === lesson.id ? 'on' : ''}>
                  <span>{l.title}</span>
                  <span class="small muted">{l.duration_text}</span>
                </a>
              ))}
            </div>
          ))}
        </aside>
      </div>
    </Layout>,
  )
})

export default app
