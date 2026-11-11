import type { Child } from 'hono/jsx'
import type { Settings, Student } from '../env'
import { isHexColor } from '../lib/format'
import { ASSET_VERSION } from './assets'
import { isColorMode, isTheme, THEME_FONTS, THEMES, type ColorMode, type ThemeId } from './styles'

export const themeOf = (s: Settings): ThemeId => (isTheme(s.theme) ? s.theme : 'saas')

/** Modo de cor: escolha do visitante (cookie, se o vendedor deixar) > escolha do vendedor > automático. */
export const modeOf = (s: Settings): ColorMode => {
  if (s.mode_toggle !== '0' && (s.visitor_mode === 'light' || s.visitor_mode === 'dark')) return s.visitor_mode
  return isColorMode(s.color_mode) ? s.color_mode : 'auto'
}

export function ModeButton({ s }: { s: Settings }) {
  if (s.mode_toggle === '0') return null
  return (
    <button type="button" class="mode-btn" data-mode-toggle="" aria-label="Alternar modo claro/escuro" title="Modo claro/escuro">
      <span class="i-light" aria-hidden="true">☾</span>
      <span class="i-dark" aria-hidden="true">☀</span>
    </button>
  )
}

/** Cor própria do vendedor (opcional). Sem ela, cada tema usa a cor dele. */
function themeVars(s: Settings) {
  return s.accent_custom === '1' && isHexColor(s.accent_color) ? `html[data-theme][data-mode]{--accent:${s.accent_color}}` : ''
}

function themeColor(s: Settings) {
  if (s.accent_custom === '1' && isHexColor(s.accent_color)) return s.accent_color
  return THEMES.find((t) => t.id === themeOf(s))!.swatch[1]
}

function Head({ title, s, description }: { title: string; s: Settings; description?: string }) {
  return (
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <meta name="theme-color" content={themeColor(s)} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${THEME_FONTS[themeOf(s)]}&display=swap`} />
      <link rel="stylesheet" href={`/assets/app.css?v=${ASSET_VERSION}`} />
      {themeVars(s) && <style>{themeVars(s)}</style>}
      {s.logo_key && <link rel="icon" href={`/media/p/${s.logo_key}`} />}
      <script src={`/assets/app.js?v=${ASSET_VERSION}`} defer></script>
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
    <html lang="pt-BR" data-theme={themeOf(s)} data-mode={modeOf(s)}>
      <Head title={props.title ? `${props.title} · ${s.store_name}` : s.store_name} s={s} description={props.description ?? s.store_tagline} />
      <body>
        <header class="top">
          <div class="wrap">
            <Brand s={s} />
            <nav class="nav">
              <a href="/">Cursos</a>
              {props.student ? <a href="/aluno">Meus cursos</a> : <a href="/aluno/entrar">Entrar</a>}
              <ModeButton s={s} />
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
  ['/admin/cupons', '%', 'Cupons'],
  ['/admin/alunos', '☺', 'Alunos'],
  ['/admin/configuracoes', '⚙', 'Configurações'],
] as const

export function AdminLayout(props: { title: string; s: Settings; active: string; children: Child }) {
  const { s } = props
  return (
    <html lang="pt-BR" data-theme={themeOf(s)} data-mode={modeOf(s)}>
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
              <div class="side-foot">
                <form method="post" action="/admin/sair">
                  <button class="btn ghost sm block" type="submit">
                    Sair
                  </button>
                </form>
                <ModeButton s={s} />
              </div>
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
