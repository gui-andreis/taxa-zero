import { Hono } from 'hono'
import type { AppEnv } from './env'
import { ensureSchema } from './db/schema'
import { loadSettings } from './lib/settings'
import { cleanupExpired, readSession } from './lib/auth'
import { CSS } from './views/styles'
import { CLIENT_JS } from './views/client'
import { Layout } from './views/layout'
import publicRoutes from './routes/public'
import studentRoutes from './routes/student'
import adminRoutes from './routes/admin'
import mediaRoutes from './routes/media'
import webhookRoutes from './routes/webhooks'

const app = new Hono<AppEnv>()

// Arquivos estáticos (embutidos no código, sem build)
const ASSET_HEADERS = { 'cache-control': 'public, max-age=3600' }
app.get('/assets/app.css', (c) => c.body(CSS, 200, { ...ASSET_HEADERS, 'content-type': 'text/css; charset=utf-8' }))
app.get('/assets/app.js', (c) => c.body(CLIENT_JS, 200, { ...ASSET_HEADERS, 'content-type': 'text/javascript; charset=utf-8' }))

// Segurança: cabeçalhos + proteção contra CSRF (formulários enviados de outros sites)
app.use('*', async (c, next) => {
  const method = c.req.method
  if (method !== 'GET' && method !== 'HEAD' && !c.req.path.startsWith('/webhooks/')) {
    const reqOrigin = c.req.header('origin')
    const self = new URL(c.req.url).origin
    if (reqOrigin && reqOrigin !== self) return c.text('Origem não permitida.', 403)
    if (!reqOrigin) {
      const referer = c.req.header('referer')
      if (!referer || new URL(referer).origin !== self) return c.text('Origem não permitida.', 403)
    }
  }
  await next()
  c.header('x-content-type-options', 'nosniff')
  c.header('referrer-policy', 'strict-origin-when-cross-origin')
  c.header('x-frame-options', 'DENY')
  c.header('permissions-policy', 'camera=(), microphone=(), geolocation=()')
  if (!c.res.headers.has('content-security-policy'))
    c.header(
      'content-security-policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "media-src 'self'",
        'frame-src https:',
        "connect-src 'self'",
        "form-action 'self'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    )
})

// Banco, configurações e sessões
app.use('*', async (c, next) => {
  await ensureSchema(c.env.DB)
  c.set('settings', await loadSettings(c.env.DB))
  const [adminId, studentId] = await Promise.all([readSession(c, 'admin'), readSession(c, 'student')])
  c.set('admin', adminId ? await c.env.DB.prepare('SELECT id, email FROM admins WHERE id = ?').bind(adminId).first() : null)
  c.set('student', studentId ? await c.env.DB.prepare('SELECT id, name, email FROM students WHERE id = ?').bind(studentId).first() : null)
  if (Math.random() < 0.01) c.executionCtx.waitUntil(cleanupExpired(c.env.DB))
  await next()
})

app.route('/', publicRoutes)
app.route('/aluno', studentRoutes)
app.route('/admin', adminRoutes)
app.route('/media', mediaRoutes)
app.route('/webhooks', webhookRoutes)

app.notFound((c) => {
  const s = c.get('settings')
  if (!s) return c.text('Não encontrado', 404)
  return c.html(
    <Layout s={s} student={c.get('student')} title="Não encontrado">
      <div class="narrow auth center">
        <div>
          <div style="font-size:3rem">🧭</div>
          <h2>Página não encontrada</h2>
          <a class="btn" href="/">
            Voltar ao início
          </a>
        </div>
      </div>
    </Layout>,
    404,
  )
})

app.onError((err, c) => {
  console.error(err)
  return c.text('Algo deu errado. Tente novamente em instantes.', 500)
})

export default app
