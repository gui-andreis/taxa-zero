import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { AppEnv } from '../env'
import { randomToken, sha256Hex } from './crypto'
import { DAY, now } from './format'

type Kind = 'admin' | 'student'
const COOKIE: Record<Kind, string> = { admin: 'tz_admin', student: 'tz_aluno' }
const TTL: Record<Kind, number> = { admin: 7 * DAY, student: 30 * DAY }

function isLocal(c: Context) {
  const host = new URL(c.req.url).hostname
  return host === 'localhost' || host === '127.0.0.1'
}

/** O token fica só no cookie; no banco guardamos o hash (se o banco vazar, as sessões não servem). */
export async function createSession(c: Context<AppEnv>, kind: Kind, userId: number) {
  const token = randomToken()
  await c.env.DB.prepare('INSERT INTO sessions (id, kind, user_id, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), kind, userId, now() + TTL[kind])
    .run()
  setCookie(c, COOKIE[kind], token, {
    httpOnly: true,
    secure: !isLocal(c),
    sameSite: 'Lax',
    path: '/',
    maxAge: TTL[kind] / 1000,
  })
}

export async function readSession(c: Context<AppEnv>, kind: Kind): Promise<number | null> {
  const token = getCookie(c, COOKIE[kind])
  if (!token) return null
  const row = await c.env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ? AND kind = ?')
    .bind(await sha256Hex(token), kind)
    .first<{ user_id: number; expires_at: number }>()
  if (!row || row.expires_at < now()) return null
  return row.user_id
}

export async function destroySession(c: Context<AppEnv>, kind: Kind) {
  const token = getCookie(c, COOKIE[kind])
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run()
  deleteCookie(c, COOKIE[kind], { path: '/' })
}

/** Limite simples contra força bruta: 8 tentativas a cada 15 minutos por IP+e-mail. */
export async function tooManyAttempts(c: Context<AppEnv>, scope: string, email: string): Promise<boolean> {
  const ip = c.req.header('cf-connecting-ip') ?? 'local'
  const key = `${scope}:${ip}:${email.toLowerCase()}`
  const since = now() - 15 * 60 * 1000
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at > ?').bind(key, since).first<{ n: number }>()
  await c.env.DB.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').bind(key, now()).run()
  return (row?.n ?? 0) >= 8
}

export async function cleanupExpired(db: D1Database) {
  const t = now()
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
    db.prepare('DELETE FROM password_resets WHERE expires_at < ?').bind(t),
    db.prepare('DELETE FROM login_attempts WHERE at < ?').bind(t - DAY),
  ])
}
