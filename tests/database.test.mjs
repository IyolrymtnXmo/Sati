import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {defaultState} from '../public/data.js';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
test('PostgreSQL RLS and actual migration enforce account isolation, CAS, retry and validation',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${a}'),('${b}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(await fs.readFile('supabase/migrations/202610140001_finance_sync.sql','utf8'));
 const login=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const write=async(id,revision,operation=crypto.randomUUID(),payload=defaultState('2026'))=>(await db.query('select public.save_finance_document($1::jsonb,$2::bigint,$3::uuid,$4::uuid) as result',[JSON.stringify(payload),revision,operation,id])).rows[0].result;
 await login(a);const op=crypto.randomUUID();assert.equal((await write(a,0,op)).revision,1);assert.equal((await write(a,0,op)).revision,1);
 const stale=await write(a,0);assert.equal(stale.ok,false);assert.equal(stale.remote.revision,1);
 assert.equal((await write(a,1)).revision,2);
 await login(b);assert.equal((await db.query('select * from public.finance_documents')).rows.length,0);
 await assert.rejects(write(a,0),/Account changed/);
 await assert.rejects(db.query('insert into public.finance_documents values ($1,$2,1,$3,now())',[a,JSON.stringify(defaultState('2026')),crypto.randomUUID()]),/row-level security/);
 assert.equal((await write(b,0)).revision,1);
 assert.equal((await db.query('select user_id from public.finance_documents')).rows[0].user_id,b);
 await assert.rejects(write(b,1,crypto.randomUUID(),{schemaVersion:1}),/finance_document_shape/);
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select * from public.finance_documents'),/permission denied/);
 await assert.rejects(write(b,0),/permission denied/);
 }finally{await db.close();}
});
