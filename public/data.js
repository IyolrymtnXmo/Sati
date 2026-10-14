export const SCHEMA_VERSION=1;
export const STORAGE_KEY='sati-finance-v1';
export const CATEGORY_SEEDS=[
 ['housing','ที่พัก / ค่าเช่า','fixed',true],['utilities','น้ำ ไฟ และอินเทอร์เน็ต','variable',true],
 ['transport','การเดินทาง','variable',true],['food','อาหาร','variable',true],['phone','โทรศัพท์','fixed',true],
 ['tools','Subscription / AI / Cloud','fixed',false],['personal','ของใช้ส่วนตัว','variable',true],
 ['insurance','ประกันสุขภาพ / อุบัติเหตุ','fixed',true],['social','สังคม / งานเลี้ยง','variable',false],
 ['education','พัฒนาตัวเอง / Certificate','variable',false],['family','ให้ครอบครัว','fixed',true],
 ['fitness','ออกกำลังกาย','fixed',false],['annual','รายจ่ายรายปีเฉลี่ยต่อเดือน','fixed',true],
 ['debt','ผ่อนชำระหนี้','fixed',true],['buffer','เงินกันชน / เบ็ดเตล็ด','variable',false]
];
export const defaultBudget=()=>CATEGORY_SEEDS.map(([id,name,type,essential])=>({id,name,type,essential,amount:null}));
export function defaultPlan(year){return {settings:{salary:null,sideIncome:0,savingsRate:50,savingsBasis:'gross',sideIncomeSavingsRate:50,salaryGrowth:0,sideIncomeGrowth:0,emergencyMonths:6,emergencyCurrent:null,currentSavings:null,essentialMonthly:null,socialSecurityMonthly:null,monthlyWithheld:0,sideIncomeWithheld:0,taxReserveMonthly:0,payrollOther:0,bonusAnnual:0,taxYear:Number(year),risk:'',payDay:null},budget:defaultBudget(),streams:[],tax:{mode:'annual',salaryAnnual:null,ssoAnnual:null,monthsRemaining:12,taxPaidMidYear:0,reserveExisting:0,deductions:{lifeInsurance:0,healthInsurance:0,providentFund:0,rmf:0,thaiEsg:0,otherVerified:0}}};}
export function defaultState(year){const plan=defaultPlan(year);Object.assign(plan.settings,{bucketSafePercent:30,bucketInvestmentPercent:50,bucketGoalsPercent:20});return {schemaVersion:SCHEMA_VERSION,updatedAt:null,plans:{[year]:plan},budgets:{},transactions:[],snapshots:{},goals:[],checklist:[],loan:{principal:null,annualRate:null,years:null,extraPayment:0},investment:{initial:null,annualContribution:null,annualRate:null,contributionYears:null,horizonYears:40}};}
export function ensurePlan(state,year){if(!state.plans[year]) state.plans[year]=defaultPlan(year);return state.plans[year];}
export function budgetFor(state,month){return state.budgets[month]||ensurePlan(state,month.slice(0,4)).budget;}
export function parseAmount(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
const goodAmount=x=>x===null||(typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e15);
const monthPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
export function isDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;}
export function validateBackup(data){
  if(!plain(data)||data.schemaVersion!==SCHEMA_VERSION||!plain(data.plans)||!plain(data.budgets)||!plain(data.snapshots))throw new Error('ไฟล์ไม่ใช่ข้อมูลสำรอง SATI รุ่นที่รองรับ');
  const rejectUnsafe=(v,depth=0)=>{if(depth>15)throw new Error('โครงสร้างข้อมูลซ้อนลึกเกินไป');if(typeof v==='number'&&!Number.isFinite(v))throw new Error('พบตัวเลขที่ไม่ถูกต้อง');if(typeof v==='string'&&v.length>10000)throw new Error('ข้อความยาวเกินขอบเขต');if(v&&typeof v==='object')for(const k of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('พบโครงสร้างไฟล์ที่ไม่ปลอดภัย');rejectUnsafe(v[k],depth+1);}};rejectUnsafe(data);
  for(const key of ['transactions','goals','checklist'])if(!Array.isArray(data[key]))throw new Error('ข้อมูล '+key+' ไม่ครบ');
  if(data.transactions.length>100000)throw new Error('รองรับไม่เกิน 100,000 รายการต่อไฟล์');
  const unique=rows=>new Set(rows.map(r=>r.id)).size===rows.length;
  const checkRows=rows=>{if(!Array.isArray(rows)||rows.length>500||rows.some(r=>!plain(r)||typeof r.id!=='string'||typeof r.name!=='string'||!goodAmount(r.amount)||!['fixed','variable'].includes(r.type)||typeof r.essential!=='boolean')||!unique(rows))throw new Error('ข้อมูลหมวดงบประมาณไม่ถูกต้อง');};
  if(Object.keys(data.plans).length>201)throw new Error('จำนวนปีเกินขอบเขต');
  for(const [year,p] of Object.entries(data.plans)){
    if(!/^\d{4}$/.test(year)||!plain(p)||!plain(p.settings)||!plain(p.tax)||!Array.isArray(p.streams))throw new Error('แผนรายปีไม่ถูกต้อง');
    checkRows(p.budget);
    if(!['annual','forecast'].includes(p.tax.mode)||!plain(p.tax.deductions))throw new Error('การตั้งค่าภาษีไม่ครบ');
    for(const [key,value] of Object.entries(p.tax))if(!['mode','deductions'].includes(key)&&!goodAmount(value))throw new Error('ข้อมูลภาษีไม่ถูกต้อง');
    if(!Number.isInteger(p.tax.monthsRemaining)||p.tax.monthsRemaining<1||p.tax.monthsRemaining>12)throw new Error('จำนวนเดือนกันภาษีต้องเป็น 1–12');
    for(const value of Object.values(p.tax.deductions))if(!goodAmount(value))throw new Error('ค่าลดหย่อนไม่ถูกต้อง');
    for(const [key,value] of Object.entries(p.settings))if(!['savingsBasis','risk'].includes(key)&&!goodAmount(value))throw new Error('ค่าตั้งค่า '+key+' ไม่ถูกต้อง');
    for(const key of ['savingsRate','sideIncomeSavingsRate'])if(p.settings[key]>100)throw new Error('สัดส่วนออมต้องไม่เกิน 100%');
    if(typeof p.settings.risk!=='string'||p.settings.savingsBasis!=='gross')throw new Error('ฐานแผนการเงินไม่ถูกต้อง');
    if(!unique(p.streams))throw new Error('แหล่งรายได้ ID ซ้ำ');
    for(const r of p.streams)if(!plain(r)||typeof r.name!=='string'||!/^40\([1-8]\)$/.test(r.type)||!goodAmount(r.amount)||!goodAmount(r.expense)||!goodAmount(r.withheld))throw new Error('แหล่งรายได้ไม่ถูกต้อง');
  }
  for(const [month,rows] of Object.entries(data.budgets)){if(!monthPattern.test(month))throw new Error('เดือนงบประมาณไม่ถูกต้อง');checkRows(rows);}
  const ids=new Set();for(const r of data.transactions){if(!plain(r)||typeof r.id!=='string'||ids.has(r.id)||!isDate(r.date)||!['income','expense','transfer'].includes(r.type)||!goodAmount(r.amount)||!(r.amount>0)||typeof r.description!=='string'||typeof r.categoryId!=='string'||(r.savingsContribution!==undefined&&typeof r.savingsContribution!=='boolean'))throw new Error('รายการรายรับรายจ่ายไม่ถูกต้องหรือ ID ซ้ำ');ids.add(r.id);}
  for(const [month,s] of Object.entries(data.snapshots)){if(!monthPattern.test(month)||!plain(s)||!Array.isArray(s.assets)||!Array.isArray(s.liabilities))throw new Error('งบฐานะการเงินไม่ถูกต้อง');for(const r of [...s.assets,...s.liabilities])if(!plain(r)||typeof r.name!=='string'||!goodAmount(r.amount))throw new Error('ยอดทรัพย์สิน/หนี้ไม่ถูกต้อง');}
  for(const g of data.goals)if(!plain(g)||typeof g.name!=='string'||!['target','current','monthlyContribution'].every(k=>goodAmount(g[k])))throw new Error('เป้าหมายไม่ถูกต้อง');
  if(!unique(data.goals)||data.checklist.some(x=>typeof x!=='string'))throw new Error('รายการเป้าหมาย/เช็กลิสต์ไม่ถูกต้อง');
  if(!plain(data.loan)||!plain(data.investment))throw new Error('ข้อมูลเครื่องคำนวณไม่ครบ');
  for(const [key,value] of Object.entries(data.loan))if(!goodAmount(value))throw new Error('ข้อมูลเงินกู้ไม่ถูกต้อง: '+key);
  for(const [key,value] of Object.entries(data.investment))if(key==='annualRate'){if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<=-100||value>100))throw new Error('ผลตอบแทนสมมติไม่ถูกต้อง');}else if(!goodAmount(value))throw new Error('ข้อมูลลงทุนไม่ถูกต้อง');
  return JSON.parse(JSON.stringify(data));
}
export function exportCSV(headers,rows){const cell=v=>{let t=String(v??'');if(/^[=+@\-\t\r]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';};return '\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');}
