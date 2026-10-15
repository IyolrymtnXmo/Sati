import {CATEGORY_SEEDS} from './data.js';
export function getLanguage(){try{return localStorage.getItem('sati-language')==='en'?'en':'th';}catch{return 'th';}}
export function setLanguage(value){try{localStorage.setItem('sati-language',value==='en'?'en':'th');return true;}catch{return false;}}
export const locale=()=>getLanguage()==='en'?'en-GB':'th-TH';
export const calendarYear=y=>Number(y)+(getLanguage()==='en'?0:543);
export function languageButton(){const en=getLanguage()==='en';return `<button type="button" class="icon-btn language-switch" data-action="language" aria-label="${en?'Switch to Thai':'Switch to English'}" title="${en?'ภาษาไทย':'English'}">${en?'TH':'EN'}</button>`;}
const names=['Housing / rent','Water, electricity and internet','Transport','Food','Phone','Subscriptions / AI / Cloud','Personal items','Health / accident insurance','Social / entertainment','Education / certificates','Family support','Fitness','Annual expenses / month','Debt repayments','Buffer / miscellaneous'];
export function categoryLabel(category,language=getLanguage()){if(!category)return '';const index=CATEGORY_SEEDS.findIndex(([id,name])=>id===category.id&&name===category.name);return language==='en'&&index>=0?(names[index]??category.name):category.name;}
