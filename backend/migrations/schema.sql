CREATE TABLE IF NOT EXISTS sprints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL UNIQUE,
  start_date  TEXT    NOT NULL,
  duration    INTEGER NOT NULL DEFAULT 14
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
  closed_at    TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO config (key, value) VALUES ('expected_hours', '120');
INSERT OR IGNORE INTO config (key, value) VALUES ('github_project_id', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('github_token', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('last_refreshed', '');
INSERT OR IGNORE INTO config (key, value) VALUES ('status_field', 'Status');
INSERT OR IGNORE INTO config (key, value) VALUES ('effort_field', 'Effort');
INSERT OR IGNORE INTO config (key, value) VALUES ('actual_time_field', 'Actual time');
INSERT OR IGNORE INTO config (key, value) VALUES ('assignee_field', 'Assignee');
INSERT OR IGNORE INTO config (key, value) VALUES ('sprint_field', 'Sprint');
INSERT OR IGNORE INTO config (key, value) VALUES ('type_field', 'Type');
