import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'sprint-dashboard.db')

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
  const schema = fs.readFileSync(
    path.join(process.cwd(), 'migrations', 'schema.sql'),
    'utf-8'
  )
  database.exec(schema)

  const applied = new Set(
    (database.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map(r => r.name)
  )

  const migDir = path.join(process.cwd(), 'migrations')
  if (!fs.existsSync(migDir)) return

  const files = fs.readdirSync(migDir)
    .filter(f => f.endsWith('.sql') && f !== 'schema.sql')
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(migDir, file), 'utf-8')
    database.exec(sql)
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
  }
}
