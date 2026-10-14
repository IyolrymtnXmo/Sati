import {createClient} from './vendor/supabase.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';
export function validConfig(url,key){
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))return false;
  if(key.startsWith('sb_publishable_'))return true;
  try{return JSON.parse(atob(key.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).role==='anon';}catch{return false;}
}
export const configured=validConfig(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
export const authClient=configured?createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:'sati-auth:'+SUPABASE_URL}
}):null;
export const projectScope=SUPABASE_URL;
export const recoveryRequested=new URLSearchParams(location.search).get('recovery')==='1';
export async function signIn(email,password){
  if(!authClient)throw new Error('ยังไม่ได้เชื่อมโปรเจกต์ Supabase');
  const {error}=await authClient.auth.signInWithPassword({email,password});if(error)throw error;
}
export async function resetPassword(email){
  const redirect=new URL('index.html',location.href);redirect.search='recovery=1';
  const {error}=await authClient.auth.resetPasswordForEmail(email,{redirectTo:redirect.href});if(error)throw error;
}
export async function changePassword(password){const {error}=await authClient.auth.updateUser({password});if(error)throw error;}
export async function signOut(){const {error}=await authClient.auth.signOut({scope:'local'});if(error)throw error;}
