import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const root=process.cwd(),out=path.resolve(root,'dist');
if(out!==path.join(root,'dist'))throw new Error('Invalid output directory');
await fs.rm(out,{recursive:true,force:true});
await fs.cp('public',out,{recursive:true});
await build({entryPoints:['@supabase/supabase-js'],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:path.join(out,'vendor/supabase.js'),legalComments:'eof'});
const url=process.env.SUPABASE_URL??'',key=process.env.SUPABASE_PUBLISHABLE_KEY??'';
if(url||key){
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!(key.startsWith('sb_publishable_')||key.startsWith('eyJ')))throw new Error('Use the project HTTPS URL and publishable/anon key');
  if(key.startsWith('eyJ')&&JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!=='anon')throw new Error('Secret keys must never be bundled');
  await fs.writeFile(path.join(out,'config.js'),`export const SUPABASE_URL=${JSON.stringify(url)};\nexport const SUPABASE_PUBLISHABLE_KEY=${JSON.stringify(key)};\n`);
}else if(process.env.REQUIRE_CLOUD_CONFIG==='1')throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in GitHub repository variables before deployment');
await fs.writeFile(path.join(out,'.nojekyll'),'');
console.log('Built static website in dist/');
