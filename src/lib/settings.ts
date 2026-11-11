import type { Settings } from '../env'

/** Valores padrão. Tudo pode ser trocado em /admin/configuracoes. */
export const DEFAULT_SETTINGS: Settings = {
  store_name: 'Minha Escola',
  store_tagline: 'Cursos online direto de quem faz.',
  theme: 'saas',
  accent_custom: '0',
  accent_color: '#635bff',
  color_mode: 'auto',
  mode_toggle: '1',
  logo_key: '',
  seller_email: '',
  support_contact: '',
  footer_text: '',
  refund_days: '7',
  terms_text: '',

  pix_manual_enabled: '0',
  pix_key: '',
  pix_name: '',
  pix_city: '',

  mp_access_token: '',
  mp_webhook_secret: '',
  mp_pix_enabled: '0',
  mp_card_enabled: '0',
  mp_max_installments: '12',

  resend_api_key: '',
  email_from: '',

  bunny_token_key: '',
}

/** Chaves secretas: nunca mostradas de volta na tela. */
export const SECRET_KEYS = ['mp_access_token', 'mp_webhook_secret', 'resend_api_key', 'bunny_token_key']

export async function loadSettings(db: D1Database): Promise<Settings> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  const s: Settings = { ...DEFAULT_SETTINGS }
  for (const r of results) s[r.key] = r.value
  return s
}

export async function saveSettings(db: D1Database, values: Settings) {
  const stmts = Object.entries(values).map(([k, v]) =>
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v),
  )
  if (stmts.length) await db.batch(stmts)
}

export const flag = (s: Settings, key: string) => s[key] === '1'

export function enabledMethods(s: Settings) {
  const mpReady = !!s.mp_access_token
  return {
    pix_manual: flag(s, 'pix_manual_enabled') && !!s.pix_key && !!s.pix_name && !!s.pix_city,
    mp_pix: mpReady && flag(s, 'mp_pix_enabled'),
    mp_card: mpReady && flag(s, 'mp_card_enabled'),
  }
}

export function emailReady(s: Settings) {
  return !!s.resend_api_key && !!s.email_from
}
