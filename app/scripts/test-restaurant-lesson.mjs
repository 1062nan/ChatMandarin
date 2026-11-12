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
    if (filename.endsWith('_meeting_time_lesson.sql')) {
      await db.exec(`
        ALTER TABLE auth.users DISABLE TRIGGER USER;
        INSERT INTO auth.users(id,email) VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','existing@example.invalid');
        INSERT INTO profiles(id,auth_id,email) VALUES('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','existing@example.invalid');
        INSERT INTO lesson_progress(user_id,lesson_id,next_review_at,review_count,recall_streak,last_summary,updated_at)
        VALUES('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','restaurant-order-v1','2026-11-20T00:00:00Z',5,2,'{"matched":4,"unaided":4,"total":4,"submission_id":"55555555-5555-4555-8555-555555555555","mode":"review"}','2026-11-12T01:00:00Z');
      `)
      const before=await db.query("SELECT * FROM lesson_progress WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'")
      await db.exec(sql)
      const after=await db.query("SELECT * FROM lesson_progress WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'")
      if(JSON.stringify(before.rows)!==JSON.stringify(after.rows)) throw new Error('Migration changed existing restaurant progress/receipt')
      console.log('Preexisting restaurant progress/receipt byte-equivalence after additive migration: PASS')
    } else await db.exec(sql)
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
  await db.exec('COMMIT')
  await db.exec(`INSERT INTO lesson_progress(user_id,lesson_id,next_review_at) VALUES
    ('22222222-2222-2222-2222-222222222222','restaurant-order-v1',now()),
    ('44444444-4444-4444-4444-444444444444','restaurant-order-v1',now());`)
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false)`)
  const rows = await db.query('SELECT user_id FROM lesson_progress')
  if(rows.rows.length!==1 || rows.rows[0].user_id!=='22222222-2222-2222-2222-222222222222') throw new Error('Owner isolation failed')
  async function denied(sql) {try {await db.exec(sql)} catch(e) {if(e.code==='42501') return; throw e} throw new Error('Expected permission denial')}
  await denied("UPDATE lesson_progress SET next_review_at=now()")
  await denied("INSERT INTO lesson_progress(user_id,lesson_id,next_review_at) VALUES ('22222222-2222-2222-2222-222222222222','restaurant-order-v1',now())")
  await denied('DELETE FROM lesson_progress')
  await db.exec('RESET ROLE; SET ROLE anon')
  await denied('SELECT * FROM lesson_progress')
  await db.exec('RESET ROLE; SET ROLE service_role')
  const before = await db.query("SELECT updated_at FROM lesson_progress WHERE user_id='22222222-2222-2222-2222-222222222222'")
  const stamp=before.rows[0].updated_at
  const query="UPDATE lesson_progress SET review_count=review_count+1,updated_at=updated_at+interval '1 second' WHERE user_id='22222222-2222-2222-2222-222222222222' AND updated_at=$1 RETURNING review_count"
  const first=await db.query(query,[stamp]); const duplicate=await db.query(query,[stamp])
  if(first.rows.length!==1 || duplicate.rows.length!==0) throw new Error('CAS failed')
  await db.exec("INSERT INTO lesson_progress(user_id,lesson_id,next_review_at) VALUES ('22222222-2222-2222-2222-222222222222','meeting-time-v1','2026-11-20T00:00:00Z')")
  const timeBefore = await db.query("SELECT * FROM lesson_progress WHERE user_id='22222222-2222-2222-2222-222222222222' AND lesson_id='meeting-time-v1'")
  await db.exec("UPDATE lesson_progress SET review_count=review_count+1 WHERE user_id='22222222-2222-2222-2222-222222222222' AND lesson_id='restaurant-order-v1'")
  const timeAfter = await db.query("SELECT * FROM lesson_progress WHERE user_id='22222222-2222-2222-2222-222222222222' AND lesson_id='meeting-time-v1'")
  if(JSON.stringify(timeBefore.rows)!==JSON.stringify(timeAfter.rows)) throw new Error('Cross-lesson progress changed')
  await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false)")
  const ownLessons=await db.query('SELECT lesson_id FROM lesson_progress')
  if(ownLessons.rows.length!==2) throw new Error('Owner must read both own lessons')
  await denied("UPDATE lesson_progress SET review_count=99 WHERE lesson_id='meeting-time-v1'")
  await db.exec('RESET ROLE; SET ROLE service_role')
  try {
    await db.exec("INSERT INTO lesson_progress(user_id,lesson_id,next_review_at) VALUES ('22222222-2222-2222-2222-222222222222','unapproved-lesson',now())")
    throw new Error('Unknown lesson accepted')
  } catch (error) { if(error.code!=='23514') throw error }
  console.log('Restaurant and meeting time lesson isolation, allowlist: PASS')
  console.log('Restaurant lesson owner isolation, browser write denial, anonymous denial and CAS: PASS')
} catch (error) {
  console.error('Database integration failed:', error.message, error.where ?? '')
  process.exitCode = 1
} finally { await db.close() }
