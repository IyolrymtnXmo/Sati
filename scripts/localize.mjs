// Translate only application-authored source text at build time. Never process
// database payloads, user input, stored category names or workbook cell data.
import fs from 'node:fs/promises';
import path from 'node:path';
import {transform} from 'esbuild';
export const localizedModules=['app','experience','workbook-view','auth','cloud','sync-core','finance','data'];
export const thaiPhrase=/[\u0e00-\u0e7f]+(?:[ \t]+[\u0e00-\u0e7f]+)*/g;
export function translateSource(source,catalog,name){
 let prefix='';
 // Keep the shared schema and default stored labels byte-for-byte identical.
 if(name==='data'){const marker=source.indexOf('const plain=');if(marker<0)throw new Error('data schema marker missing');prefix=source.slice(0,marker);source=source.slice(marker);}
 const missing=new Set();
 source=source.replace(thaiPhrase,text=>{if(!(text in catalog)){missing.add(text);return text;}return catalog[text].replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/`/g,'\\`').replace(/\$\{/g,'\\${');});
 if(missing.size)throw new Error(`Missing English translations in ${name}: ${[...missing].join(' | ')}`);
 source=prefix+source;
 for(const module of localizedModules)source=source.replaceAll(`'./${module}.js'`,`'./${module}.en.js'`);
 // Keep workbook search semantics; only numeric display follows the locale.
 if(name==='workbook-view')source=source.replace("toLocaleString('th-TH')","toLocaleString('en-GB')");
 return source;
}
export async function buildEnglish(out){const catalog=JSON.parse(await fs.readFile('translations/en.json','utf8'));for(const name of localizedModules){const source=translateSource(await fs.readFile(`public/${name}.js`,'utf8'),catalog,name);await transform(source,{loader:'js',target:'es2022'});await fs.writeFile(path.join(out,`${name}.en.js`),source);}}
