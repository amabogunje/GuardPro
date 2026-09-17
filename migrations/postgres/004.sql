DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardpro_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON media_uploads TO guardpro_app;
  END IF;
END
$$;
