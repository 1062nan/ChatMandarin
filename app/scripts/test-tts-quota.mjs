import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const db=new PGlite()
try {
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE TABLE profiles(id uuid PRIMARY KEY);GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;INSERT INTO profiles VALUES('11111111-1111-1111-1111-111111111111');`)
 await db.exec(await fs.readFile(new URL('../supabase/migrations/20261112073936_tts_abuse_quota.sql',import.meta.url),'utf8'))
 const call="SELECT * FROM reserve_free_tts('11111111-1111-1111-1111-111111111111', $1)"
 for(const role of ['anon','authenticated']) {
  await db.exec(`SET ROLE ${role}`)
  for(const sql of ["SELECT * FROM tts_usage",call.replace('$1','1'),"DELETE FROM tts_usage"]) await assert.rejects(db.query(sql),e=>e.code==='42501')
  await db.exec('RESET ROLE')
 }
 await db.exec('SET ROLE service_role')
 for(let i=0;i<20;i++)assert.equal((await db.query(call,[500])).rows[0].allowed,true)
 assert.equal((await db.query(call,[1])).rows[0].reason,'daily_limit')
 await db.exec("UPDATE tts_usage SET usage_date=usage_date-1,minute_start=minute_start-interval '1 day'")
 for(let i=0;i<20;i++)assert.equal((await db.query(call,[1])).rows[0].allowed,true)
 assert.equal((await db.query(call,[1])).rows[0].reason,'rate_limit')
 await db.exec("UPDATE tts_usage SET minute_start=minute_start-interval '1 minute'")
 assert.equal((await db.query(call,[1])).rows[0].allowed,true)
 assert.equal((await db.query('SELECT characters FROM tts_usage')).rows[0].characters,21)
 await assert.rejects(db.query(call,[501]),e=>e.code==='22023')
 console.log('TTS quota: ACL, daily/minute caps, UTC reset, input range PASS')
}finally{await db.close()}
