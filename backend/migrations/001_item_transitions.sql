CREATE TABLE IF NOT EXISTS item_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
