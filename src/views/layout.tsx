import type { Child } from 'hono/jsx'
import type { Settings, Student } from '../env'
import { isHexColor } from '../lib/format'

function themeVars(s: Settings) {
  const accent = isHexColor(s.accent_color) ? s.accent_color : '#6d4aff'
  return `:root{--accent:${accent}}`
}

function Head({ title, s, description }: { title: string; s: Settings; description?: string }) {
  return (
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <meta name="theme-color" content={s.accent_color} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      <link rel="stylesheet" href="/assets/app.css" />
      <style>{themeVars(s)}</style>
      {s.logo_key && <link rel="icon" href={`/media/p/${s.logo_key}`} />}
      <script src="/assets/app.js" defer></script>
    </head>
  )
}

export function Brand({ s }: { s: Settings }) {
  return (
    <a href="/" class="brand">
      {s.logo_key ? <img src={`/media/p/${s.logo_key}`} alt="" /> : <span class="dot">{(s.store_name || 'T').slice(0, 1).toUpperCase()}</span>}
      <span>{s.store_name}</span>
    </a>
  )
}

export function Layout(props: { title?: string; s: Settings; student?: Student | null; description?: string; children: Child }) {
  const { s } = props
  return (
    <html lang="pt-BR">
      <Head title={props.title ? `${props.title} · ${s.store_name}` : s.store_name} s={s} description={props.description ?? s.store_tagline} />
      <body>
        <header class="top">
          <div class="wrap">
            <Brand s={s} />
            <nav class="nav">
              <a href="/">Cursos</a>
              {props.student ? <a href="/aluno">Meus cursos</a> : <a href="/aluno/entrar">Entrar</a>}
            </nav>
          </div>
        </header>
        <main>{props.children}</main>
        <footer class="foot">
          <div class="wrap">
            <span>
              © {new Date().getFullYear()} {s.store_name}
              {s.footer_text ? ` · ${s.footer_text}` : ''}
            </span>
            <span class="row">
              {s.support_contact && <span>Suporte: {s.support_contact}</span>}
              <a href="/termos">Termos e reembolso</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  )
}

const ADMIN_NAV = [
  ['/admin', '◎', 'Visão geral'],
  ['/admin/pedidos', '₿', 'Pedidos'],
  ['/admin/cursos', '▶', 'Cursos'],
  ['/admin/alunos', '☺', 'Alunos'],
  ['/admin/configuracoes', '⚙', 'Configurações'],
] as const

export function AdminLayout(props: { title: string; s: Settings; active: string; children: Child }) {
  const { s } = props
  return (
    <html lang="pt-BR">
      <Head title={`${props.title} · Painel`} s={s} />
      <body>
        <div class="admin">
          <aside class="side">
            <Brand s={s} />
            <nav>
              {ADMIN_NAV.map(([href, ico, label]) => (
                <a href={href} class={props.active === href ? 'on' : ''}>
                  <span class="ico">{ico}</span>
                  {label}
                </a>
              ))}
              <a href="/" target="_blank">
                <span class="ico">↗</span>Ver loja
              </a>
              <form method="post" action="/admin/sair" style="margin-top:10px">
                <button class="btn ghost sm block" type="submit">
                  Sair
                </button>
              </form>
            </nav>
          </aside>
          <section class="main">{props.children}</section>
        </div>
      </body>
    </html>
  )
}

export function Flash({ msg, kind = 'ok' }: { msg?: string | null; kind?: 'ok' | 'bad' | 'warn' | 'info' }) {
  if (!msg) return null
  return <div class={`alert ${kind}`}>{msg}</div>
}

export function Cover({ course }: { course: { title: string; cover_key: string | null } }) {
  return <div class="cover">{course.cover_key ? <img src={`/media/p/${course.cover_key}`} alt="" /> : course.title}</div>
}
