/**
 * O banco se atualiza sozinho: cada item desta lista roda uma única vez, em ordem.
 * Para mudar o banco no futuro, ADICIONE um item novo no fim (nunca edite os antigos).
 */
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      student_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS login_attempts (key TEXT NOT NULL, at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts (key, at)`,
    `CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      bullets TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL,
      cover_key TEXT,
      published INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      video_type TEXT NOT NULL DEFAULT 'none',
      video_ref TEXT,
      duration_text TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      course_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_payment_id TEXT,
      pix_payload TEXT,
      checkout_url TEXT,
      created_at INTEGER NOT NULL,
      paid_at INTEGER,
      refunded_at INTEGER,
      note TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_orders_student ON orders (student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at)`,
  ],
]

let migrated = false

export async function ensureSchema(db: D1Database) {
  if (migrated) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS _schema (version INTEGER NOT NULL)`).run()
  const row = await db.prepare(`SELECT version FROM _schema LIMIT 1`).first<{ version: number }>()
  let version = row?.version ?? 0
  if (!row) await db.prepare(`INSERT INTO _schema (version) VALUES (0)`).run()
  while (version < MIGRATIONS.length) {
    const stmts = MIGRATIONS[version].map((sql) => db.prepare(sql))
    stmts.push(db.prepare(`UPDATE _schema SET version = ?`).bind(version + 1))
    await db.batch(stmts)
    version++
  }
  migrated = true
}
