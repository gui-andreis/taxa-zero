import { Hono } from 'hono'
import type { AppEnv, Lesson } from '../env'
import { hasAccess } from '../lib/orders'

/**
 * Arquivos guardados no Cloudflare R2.
 * - public/...  → capas e logo (qualquer um vê)
 * - private/... → vídeos: só entrega para quem tem um pedido PAGO do curso (ou para o admin).
 *   Não existe link público: cada pedaço do vídeo passa por essa checagem.
 */
const app = new Hono<AppEnv>()

app.get('/p/:key{.+}', async (c) => {
  const key = c.req.param('key')
  if (!key.startsWith('public/')) return c.notFound()
  const obj = await c.env.BUCKET.get(key)
  if (!obj) return c.notFound()
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('cache-control', 'public, max-age=86400')
  headers.set('x-content-type-options', 'nosniff')
  return new Response(obj.body, { headers })
})

app.get('/v/:lessonId', async (c) => {
  const lesson = await c.env.DB.prepare(
    `SELECT l.*, m.course_id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = ?`,
  )
    .bind(Number(c.req.param('lessonId')))
    .first<Lesson & { course_id: number }>()
  if (!lesson || lesson.video_type !== 'r2' || !lesson.video_ref) return c.notFound()

  const student = c.get('student')
  const allowed = !!c.get('admin') || (!!student && (await hasAccess(c.env.DB, student.id, lesson.course_id)))
  if (!allowed) return c.text('Acesso negado', 403)

  const obj = await c.env.BUCKET.get(lesson.video_ref, { range: c.req.raw.headers, onlyIf: c.req.raw.headers })
  if (!obj) return c.notFound()
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', 'private, no-store')
  headers.set('content-disposition', 'inline')
  headers.set('x-content-type-options', 'nosniff')
  if (!('body' in obj)) return new Response(null, { status: 304, headers })

  const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined
  if (r && c.req.header('range')) {
    const offset = r.suffix !== undefined ? obj.size - r.suffix : (r.offset ?? 0)
    const length = r.suffix !== undefined ? r.suffix : (r.length ?? obj.size - offset)
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`)
    headers.set('content-length', String(length))
    return new Response(obj.body, { status: 206, headers })
  }
  headers.set('content-length', String(obj.size))
  return new Response(obj.body, { headers })
})

export default app
