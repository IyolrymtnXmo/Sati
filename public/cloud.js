import {SyncSession,SyncConflict} from './sync-core.js';
import {authClient,configured,projectScope} from './auth.js';
export async function connectCloud({validate,onChange}) {
  if(!configured)throw new Error('ยังไม่ได้เชื่อม Supabase: เตรียม Project URL และ Publishable key แล้วตั้งค่าตามคู่มือ');
  const {data:{user},error}=await authClient.auth.getUser();
  if(error||!user){const e=new Error('กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน');e.status=401;throw e;}
  const key='sati-cloud-v2:'+projectScope+':'+user.id;
  let cacheRaw=localStorage.getItem(key);
  const cache={read:()=>cacheRaw?JSON.parse(cacheRaw):null,write:record=>{
    if(localStorage.getItem(key)!==cacheRaw)throw new Error('ข้อมูลเปลี่ยนจากแท็บอื่น กรุณารีเฟรชก่อนแก้ไขต่อ');
    const next=JSON.stringify(record);
    if(cacheRaw)localStorage.setItem(key+'-previous',cacheRaw);
    localStorage.setItem(key,next);cacheRaw=next;
  }};
  async function verifyAccount(){
    const {data:{session},error}=await authClient.auth.getSession();
    if(error||session?.user.id!==user.id){const e=new Error('บัญชีเปลี่ยนแล้ว กรุณารีเฟรช');e.status=401;throw e;}
  }
  const fail=error=>{if(error){const e=new Error(error.code==='PGRST205'||error.code==='PGRST202'?'ยังไม่ได้ติดตั้งตารางและฟังก์ชัน Supabase ตามคู่มือ':error.message);if(error.code==='PGRST301'||error.code==='28000')e.status=401;throw e;}};
  const api={read:async()=>{
    await verifyAccount();
    const {data,error}=await authClient.from('finance_documents').select('payload,revision,operation_id,updated_at').eq('user_id',user.id).maybeSingle();fail(error);
    return data?{data:data.payload,revision:data.revision,operationId:data.operation_id,updatedAt:data.updated_at}:{data:null,revision:0,operationId:null};
  },write:async r=>{
    await verifyAccount();
    if(new TextEncoder().encode(JSON.stringify(r.data)).length>4_500_000)throw new Error('ข้อมูลซิงก์เกิน 4.5 MB กรุณาสำรอง JSON ก่อนขยายพื้นที่');
    const {data,error}=await authClient.rpc('save_finance_document',{p_payload:r.data,p_revision:r.revision,p_operation_id:r.operationId,p_account_id:user.id});fail(error);
    if(!data.ok)throw new SyncConflict(data.remote);
    return data;
  }};
  const session=new SyncSession({api,cache,validate,changed:onChange});
  await session.open();
  return {user,key,session};
}
