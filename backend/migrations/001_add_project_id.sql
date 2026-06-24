ALTER TABLE sprints ADD COLUMN project_id INTEGER REFERENCES projects(id);
ALTER TABLE items ADD COLUMN project_id INTEGER REFERENCES projects(id);
