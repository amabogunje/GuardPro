DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardpro_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON customer_notice_acceptances TO guardpro_app;
  END IF;
END
$$;
