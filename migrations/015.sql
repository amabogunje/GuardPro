CREATE TABLE IF NOT EXISTS shift_template_audio (
 shift_template_id TEXT PRIMARY KEY REFERENCES shift_templates(id),
 instruction_version_id TEXT NOT NULL REFERENCES instruction_versions(id)
);
