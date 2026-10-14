import test from 'node:test';
import assert from 'node:assert/strict';
import {SyncSession,SyncConflict} from '../public/sync-core.js';

function setup() {
  let remote={revision:0,data:null,operationId:null}, serial=0;
  const api={read:async()=>structuredClone(remote),write:async r=>{
    if(remote.operationId===r.operationId) return structuredClone(remote);
    if(remote.revision!==r.revision) throw new SyncConflict(structuredClone(remote));
    remote={revision:remote.revision+1,data:structuredClone(r.data),operationId:r.operationId};return structuredClone(remote);
  }};
  function device(){let saved=null;return new SyncSession({api,cache:{read:()=>saved,write:r=>saved=structuredClone(r)},validate:x=>x,uuid:()=>String(++serial)});}
  return {device,api};
}
test('two devices read the same saved data',async()=>{const s=setup(),a=s.device(),b=s.device();await a.open();a.edit({amount:55});await a.sync();await b.open();assert.equal(b.record.data.amount,55);});
test('stale device cannot silently overwrite a concurrent edit',async()=>{const s=setup(),a=s.device(),b=s.device();await a.open();await b.open();a.edit({amount:55});b.edit({amount:60});await a.sync();await assert.rejects(b.sync(),SyncConflict);assert.equal((await s.api.read()).data.amount,55);assert.equal(b.record.data.amount,60);b.useRemote();assert.equal(b.record.data.amount,55);});
test('explicit local conflict resolution is revision guarded',async()=>{const s=setup(),a=s.device(),b=s.device();await a.open();await b.open();a.edit({a:1});b.edit({b:2});await a.sync();await assert.rejects(b.sync());b.useLocal();await b.sync();assert.deepEqual((await s.api.read()).data,{b:2});});
test('edit during pending upload stays queued',async()=>{const s=setup(),a=s.device();await a.open();a.edit({v:1});const original=a.api.write;let resume;a.api.write=async r=>{await new Promise(resolve=>resume=resolve);return original(r);};const pending=a.sync();a.edit({v:2});resume();await pending;assert.equal(a.record.dirty,true);assert.equal(a.record.revision,1);assert.equal(a.record.data.v,2);a.api.write=original;await a.sync();assert.equal((await s.api.read()).data.v,2);});
test('lost upload response is safely retried with same operation ID',async()=>{const s=setup(),a=s.device();await a.open();a.edit({v:1});const original=a.api.write;a.api.write=async r=>{await original(r);throw new Error('offline');};await assert.rejects(a.sync());assert.equal(a.record.dirty,true);a.api.write=original;await a.sync();assert.equal(a.record.dirty,false);assert.equal(a.record.revision,1);});
test('local write failure never acknowledges save',async()=>{const s=setup(),a=s.device();await a.open();a.cache.write=()=>{throw new Error('quota');};assert.throws(()=>a.edit({v:1}),/quota/);assert.equal(a.record.data,null);});
test('pull finishing after local edit does not replace it',async()=>{const s=setup(),a=s.device();await a.open();let resume;const read=a.api.read;a.api.read=async()=>{await new Promise(resolve=>resume=resolve);return read();};const pending=a.sync();a.edit({v:2});resume();await pending;assert.equal(a.record.dirty,true);assert.equal(a.record.data.v,2);});
