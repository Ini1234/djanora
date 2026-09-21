-- Built-in types stay one-per-site; CUSTOM may repeat.
CREATE UNIQUE INDEX "event_site_sections_site_id_builtin_type_key"
  ON "event_site_sections" ("site_id", "type")
  WHERE "type" <> 'CUSTOM';
