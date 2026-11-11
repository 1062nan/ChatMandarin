/** In-memory PostgreSQL integration test. Never connects to hosted Supabase. */
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const db = new PGlite()
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_user::text$$;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
  `)
  for (const filename of (await fs.readdir(`${root}supabase/migrations`)).filter(f => f.endsWith('.sql')).sort()) {
    // PGlite has built-in gen_random_uuid; the legacy optional extensions aren't needed.
    const sql = (await fs.readFile(`${root}supabase/migrations/${filename}`, 'utf8')).replace(/^CREATE EXTENSION.*$/mg, '')
    await db.exec(sql)
    console.log(`Loaded ${filename}`)
  }
  await db.exec(`
    ALTER TABLE auth.users DISABLE TRIGGER USER;
    INSERT INTO auth.users(id,email) VALUES('11111111-1111-1111-1111-111111111111','fixture@example.invalid');
    INSERT INTO profiles(id,auth_id,email) VALUES('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','fixture@example.invalid');
    INSERT INTO auth.users(id,email) VALUES('33333333-3333-3333-3333-333333333333','other@example.invalid');
    INSERT INTO profiles(id,auth_id,email) VALUES('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','other@example.invalid');
    BEGIN;
    SELECT set_config('test.profile_id','22222222-2222-2222-2222-222222222222',true);
    SET LOCAL ROLE service_role;
  `)
  await db.exec('RESET ROLE')
  await db.exec(await fs.readFile(`${root}supabase/tests/conversation_submission_idempotency.sql`, 'utf8'))
  await db.exec('ROLLBACK')
  console.log('Conversation idempotency PostgreSQL integration: PASS')
} catch (error) {
  console.error('Database integration failed:', error.message, error.where ?? '')
  process.exitCode = 1
} finally {
  await db.close()
}
