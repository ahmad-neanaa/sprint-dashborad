CREATE TABLE IF NOT EXISTS projects (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL UNIQUE,
  github_project_id TEXT    NOT NULL,
  github_token      TEXT    NOT NULL DEFAULT '',
  expected_hours    REAL    NOT NULL DEFAULT 120,
  status_field      TEXT    NOT NULL DEFAULT 'Status',
  effort_field      TEXT    NOT NULL DEFAULT 'Estimate (Hrs)',
  actual_time_field TEXT    NOT NULL DEFAULT 'Actual time',
  assignee_field    TEXT    NOT NULL DEFAULT 'Assignee',
  sprint_field      TEXT    NOT NULL DEFAULT 'Iteration',
  type_field        TEXT    NOT NULL DEFAULT 'Issue Type',
  done_value        TEXT    NOT NULL DEFAULT 'Done',
  in_progress_value TEXT    NOT NULL DEFAULT 'In Progress',
  story_value       TEXT    NOT NULL DEFAULT 'User Story',
  points_field      TEXT    NOT NULL DEFAULT 'Story Points',
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sprints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL UNIQUE,
  start_date  TEXT    NOT NULL,
  duration    INTEGER NOT NULL DEFAULT 14,
  project_id  INTEGER REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id    INTEGER NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  number       INTEGER NOT NULL,
  url          TEXT    NOT NULL,
  type         TEXT    NOT NULL DEFAULT 'issue',
  status       TEXT    NOT NULL DEFAULT 'To Do',
  effort       REAL,
  actual_time  REAL,
  assignee     TEXT,
  sprint_id    INTEGER REFERENCES sprints(id),
  project_id   INTEGER REFERENCES projects(id),
  closed_at    TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO config (key, value) VALUES ('github_token', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('last_refreshed', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('refresh_interval_hours', '');

CREATE TABLE IF NOT EXISTS _migrations (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  run_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

