import {getLanguage} from './locale.js';
const en=getLanguage()==='en';
document.documentElement.lang=en?'en':'th';
document.title=en?'SATI — Personal finance, with clarity':'SATI — สร้างอนาคตด้วยเงินที่เข้าใจ';
const heading=document.querySelector('.loading-panel h1'),description=document.querySelector('.loading-panel p'),help=document.querySelector('.loading-help');
if(en){if(heading)heading.textContent='Opening your money planner';if(description)description.textContent='Preparing your SATI workspace…';if(help)help.innerHTML='Taking a while? <a href="./index.html">Reload the page</a>';}
import(en?'./app.en.js':'./app.js').catch(()=>{if(heading)heading.textContent=en?'Could not open SATI':'เปิด SATI ไม่สำเร็จ';if(description)description.textContent=en?'Check your connection and reload. Your saved data has not been changed.':'ตรวจอินเทอร์เน็ตแล้วลองเปิดใหม่ ข้อมูลที่บันทึกไว้ยังไม่ถูกเปลี่ยนแปลง';});
