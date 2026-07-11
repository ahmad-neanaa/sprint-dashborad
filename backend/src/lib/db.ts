import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'sprint-dashboard.db')
const dbDir = path.dirname(DB_PATH)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function runMigrations(): void {
  const database = getDb()

  // Check if it is a brand new database (no tables exist yet)
  const tableCount = (database.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }).count
  const isNewDb = tableCount === 0

  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', 'migrations', 'schema.sql'),
    'utf-8'
  )
  database.exec(schema)

  const migDir = path.join(__dirname, '..', '..', 'migrations')
  if (!fs.existsSync(migDir)) return

  const files = fs.readdirSync(migDir)
    .filter(f => f.endsWith('.sql') && f !== 'schema.sql')
    .sort()

  if (isNewDb) {
    // Brand new DB: schema.sql contains all latest changes. Skip running migrations, just mark them applied.
    for (const file of files) {
      database.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run(file)
    }
    return
  }

  const applied = new Set(
    (database.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map(r => r.name)
  )

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(migDir, file), 'utf-8')
    try {
      database.exec(sql)
      database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    } catch (error: any) {
      const msg = error.message || ''
      if (msg.includes('duplicate column name') || msg.includes('already exists')) {
        console.warn(`Migration ${file} skipped because target elements already exist: ${msg}`)
        database.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run(file)
      } else {
        throw error
      }
    }
  }
}
