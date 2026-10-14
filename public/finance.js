/** Pure THB financial calculations. Input/output contract: ../finance-contract.md. */
export const RULES_CHECKED_AT = '2026-10-13';
export const TAX_BRACKETS = Object.freeze([
  { lower: 0, upper: 150000, rate: 0 },
  { lower: 150000, upper: 300000, rate: .05 },
  { lower: 300000, upper: 500000, rate: .10 },
  { lower: 500000, upper: 750000, rate: .15 },
  { lower: 750000, upper: 1000000, rate: .20 },
  { lower: 1000000, upper: 2000000, rate: .25 },
  { lower: 2000000, upper: 5000000, rate: .30 },
  { lower: 5000000, upper: Infinity, rate: .35 }
]);
const present = v => v !== null && v !== undefined && v !== '' && typeof v !== 'boolean';
const num = v => present(v) && Number.isFinite(Number(v)) ? Number(v) : null;
const nonnegative = v => num(v) !== null && num(v) >= 0 ? num(v) : null;
const optional = (v, fallback = 0) => !present(v) ? fallback : nonnegative(v);
const rounded = v => Number.isFinite(v) ? Math.round((v + Number.EPSILON) * 100) / 100 : null;
const pct = (v, fallback = 50) => {
  const n = optional(v, fallback); return n !== null && n <= 100 ? n / 100 : null;
};
const yearValue = v => { const n = num(v) ?? 2026; return n > 2400 ? n - 543 : n; };
const sum = rows => rows.reduce((a, b) => a + b, 0);
const missingResult = (missing, fields, warnings = []) => ({ complete: false, missing, warnings, ...Object.fromEntries(fields.map(k => [k, null])) });

export function taxBrackets(netIncome) {
  const net = nonnegative(netIncome);
  if (net === null) return [];
  return TAX_BRACKETS.map(({lower,upper,rate}) => {
    const amount = Math.max(0, Math.min(net, upper) - lower);
    return {lower, upper: upper === Infinity ? null : upper, rate, amount: rounded(amount), tax: rounded(amount * rate)};
  });
}

export function progressiveTax(netIncome) {
  const net = nonnegative(netIncome);
  if (net === null) return null;
  return rounded(sum(TAX_BRACKETS.map(({lower, upper, rate}) => Math.max(0, Math.min(net, upper) - lower) * rate)));
}

/** Standard Section33 employee rate; actual payslip may differ due to relief or partial months. */
export function estimateSocialSecurity(salary, taxYear = 2026) {
  const wage = nonnegative(salary), year = yearValue(taxYear);
  if (wage === null || year < 2024 || year > 2028) return null;
  if (!wage) return 0;
  return rounded(Math.min(Math.max(wage, 1650), year >= 2026 ? 17500 : 15000) * .05);
}

const taxOutputFields = ['grossIncome','sharedEmploymentExpense','expenses','deductions','netIncome','progressiveTax','minimumTaxBase','minimumTaxRaw','minimumTax','annualTax','withheld','taxPaidMidYear','credits','balanceDue','refund','monthlyReserve','marginalRate','effectiveRate'];

export function calculateTax(input = {}) {
  const warnings = [], missing = [], taxYear = yearValue(input.taxYear);
  if (taxYear !== 2026) warnings.push('ใช้ฐานกฎภาษีที่ตรวจสอบปี 2569 โปรดตรวจสอบกฎและสิทธิของปีที่เลือกก่อนยื่นจริง');
  const incomes = Array.isArray(input.incomes) ? input.incomes : [];
  if (!incomes.length) missing.push('incomes');
  const rows = incomes.map((row, index) => {
    const type = String(row.type ?? '').replace(/\s/g, '');
    const amount = nonnegative(row.amount), withheld = optional(row.withheld);
    if (!/^40\([1-8]\)$/.test(type)) missing.push(`incomes[${index}].type`);
    if (amount === null) missing.push(`incomes[${index}].amount`);
    if (withheld === null) missing.push(`incomes[${index}].withheld`);
    let expense = 0;
    if (/^40\([35678]\)$/.test(type)) {
      expense = nonnegative(row.expense);
      if (expense === null) missing.push(`incomes[${index}].expense`);
      else if (amount !== null && expense > amount) missing.push(`incomes[${index}].expense exceeds income`);
    }
    return {type, amount, withheld, expense};
  });
  const socialSecurity = optional(input.socialSecurity), personalAllowance = optional(input.personalAllowance, 60000);
  const taxPaidMidYear = optional(input.taxPaidMidYear), reserveExisting = optional(input.reserveExisting);
  const monthsRemaining = optional(input.monthsRemaining, 12);
  if (socialSecurity === null) missing.push('socialSecurity');
  if (personalAllowance === null || personalAllowance > 60000) missing.push('personalAllowance (0–60000)');
  if (taxPaidMidYear === null) missing.push('taxPaidMidYear');
  if (reserveExisting === null) missing.push('reserveExisting');
  if (monthsRemaining === null || monthsRemaining < 1 || monthsRemaining > 12) missing.push('monthsRemaining (1–12)');
  if (missing.length) return {...missingResult(missing, taxOutputFields, warnings), taxYear, brackets: [], deductionDetails: {}};
  const grossIncome = sum(rows.map(r => r.amount));
  const salaryIncome = sum(rows.filter(r => r.type === '40(1)').map(r => r.amount));
  const employmentIncome = sum(rows.filter(r => ['40(1)','40(2)'].includes(r.type)).map(r => r.amount));
  const sharedEmploymentExpense = Math.min(employmentIncome * .5, 100000);
  const expenses = sharedEmploymentExpense + sum(rows.map(r => r.expense));
  if (rows.some(r => /^40\([35678]\)$/.test(r.type))) warnings.push('ค่าใช้จ่าย 40(3), 40(5)–40(8) ใช้ยอดที่คุณตรวจสอบและกรอก ไม่เหมารวมว่าอาชีพอิสระทุกงานหักได้ 60%');
  if (rows.some(r => r.type === '40(4)')) warnings.push('40(4): รองรับเฉพาะเงินได้ที่เลือกนำมารวมคำนวณ ยังไม่คำนวณการเลือกภาษีสุดท้าย เครดิตเงินปันผล หรือกฎเงินได้ต่างประเทศ');
  const ssoCap = taxYear >= 2026 && taxYear <= 2028 ? 10500 : (taxYear >= 2024 && taxYear <= 2025 ? 9000 : null);
  if (!present(input.socialSecurity)) warnings.push('ยังไม่กรอกประกันสังคมที่จ่ายจริง จึงยังไม่ใช้สิทธิลดหย่อนรายการนี้');
  if (ssoCap !== null && socialSecurity > ssoCap) warnings.push(`จำกัดประกันสังคมตามกรณี ม.33 ปกติไม่เกิน ${ssoCap.toLocaleString('en-US')} บาท/ปี โปรดเทียบยอดจ่ายจริง`);
  if (ssoCap === null) warnings.push('ปีนี้ไม่มีเพดานประกันสังคมที่ยืนยันในระบบ ใช้ยอดที่กรอกและต้องตรวจสอบกฎของปีนั้น');
  const deductionDetails = { personalAllowance, socialSecurity: Math.min(socialSecurity, ssoCap ?? socialSecurity) };
  const d = input.deductions ?? {};
  if (typeof d === 'number' || typeof d === 'string') {
    const other = nonnegative(d);
    if (other === null) missing.push('deductions');
    else { deductionDetails.otherVerified = other; if (other > 0) warnings.push('ยอดลดหย่อนเพิ่มเติมแบบรวมต้องเป็นยอดที่ตรวจสอบสิทธิและเพดานแล้ว ระบบไม่ได้รับรองสิทธิอัตโนมัติ'); }
  } else if (d && typeof d === 'object' && !Array.isArray(d)) {
    const known = ['lifeInsurance','healthInsurance','providentFund','rmf','thaiEsg','otherVerified'];
    const v = {};
    for (const k of known) { v[k] = optional(d[k]); if (v[k] === null) missing.push(`deductions.${k}`); }
    if (Object.keys(d).some(k => !known.includes(k))) warnings.push('มีรายการลดหย่อนที่ระบบไม่รองรับ จึงไม่ได้รวมรายการนั้นโดยอัตโนมัติ');
    if (!missing.length) {
      deductionDetails.lifeInsurance = Math.min(v.lifeInsurance, 100000);
      deductionDetails.healthInsurance = Math.min(v.healthInsurance, 25000, 100000 - deductionDetails.lifeInsurance);
      deductionDetails.providentFund = Math.min(v.providentFund, salaryIncome * .15, 500000);
      deductionDetails.rmf = Math.min(v.rmf, grossIncome * .30, Math.max(0, 500000 - deductionDetails.providentFund));
      deductionDetails.thaiEsg = taxYear >= 2024 && taxYear <= 2026 ? Math.min(v.thaiEsg, grossIncome * .30, 300000) : 0;
      deductionDetails.otherVerified = v.otherVerified;
      if (v.thaiEsg > 0 && !(taxYear >= 2024 && taxYear <= 2026)) warnings.push('ยังไม่ใช้สิทธิ Thai ESG อัตโนมัติสำหรับปีนี้ ต้องตรวจสอบเงื่อนไขปีที่ซื้อและกรอกยอดที่มีสิทธิในรายการที่ตรวจสอบแล้ว');
      if (v.rmf > 0 || v.providentFund > 0) warnings.push('กลุ่มเกษียณรวมไม่เกิน 500,000 บาท หากมี กบข. กอช. ประกันบำนาญ หรือกองทุนครู ต้องหักสิทธิส่วนที่ใช้แล้วออกก่อน กองทุน RMF มีเงื่อนไขอายุและระยะถือครอง');
      if (v.otherVerified > 0) warnings.push('otherVerified ต้องเป็นยอดมีสิทธิหลังตรวจเพดานและสิทธิซ้ำซ้อนแล้ว ไม่ใช้โปรโมชันลดหย่อนโดยอัตโนมัติ');
    }
  } else missing.push('deductions');
  if (missing.length) return {...missingResult(missing, taxOutputFields, warnings), taxYear, brackets: [], deductionDetails: {}};
  const deductions = sum(Object.values(deductionDetails));
  const netIncome = Math.max(0, grossIncome - expenses - deductions);
  const method1 = progressiveTax(netIncome);
  const minimumTaxBase = grossIncome - salaryIncome;
  const minimumTaxRaw = minimumTaxBase >= 120000 ? rounded(minimumTaxBase * .005) : 0;
  const minimumTaxExempt = minimumTaxRaw > 0 && minimumTaxRaw <= 5000;
  const minimumTax = minimumTaxExempt ? 0 : minimumTaxRaw;
  const annualTax = Math.max(method1, minimumTax);
  const withheld = sum(rows.map(r => r.withheld)), credits = withheld + taxPaidMidYear;
  const balanceDue = Math.max(0, annualTax - credits), refund = Math.max(0, credits - annualTax);
  const midYearRelevant = rows.some(r => /^40\([5678]\)$/.test(r.type) && r.amount > 0);
  if (midYearRelevant) warnings.push('มีเงินได้ 40(5)–40(8): ตรวจหน้าที่ยื่น ภ.ง.ด.94 สำหรับรายได้ ม.ค.–มิ.ย. และนำภาษีครึ่งปีที่ชำระแล้วมาเป็นเครดิตตอนสิ้นปี');
  warnings.push('ภาษีหัก ณ ที่จ่ายเป็นเครดิตภาษี ไม่ใช่ภาษีเพิ่มอีกก้อน; อัตรา 3% ใช้เฉพาะการจ่ายที่เข้าเกณฑ์ ไม่ใช่รายได้เสริมทุกประเภท');
  const result = { complete: true, missing: [], warnings, taxYear, grossIncome, sharedEmploymentExpense, expenses, deductions, deductionDetails, netIncome,
    progressiveTax: method1, minimumTaxBase, minimumTaxRaw, minimumTax, minimumTaxExempt, annualTax, withheld, taxPaidMidYear, credits,
    balanceDue, refund, monthlyReserve: Math.max(0, balanceDue - reserveExisting) / monthsRemaining,
    brackets: taxBrackets(netIncome), marginalRate: [...TAX_BRACKETS].reverse().find(b => netIncome > b.lower)?.rate ?? 0,
    effectiveRate: grossIncome > 0 ? annualTax / grossIncome : 0, midYearRelevant };
  for (const key of taxOutputFields) if (!['marginalRate','effectiveRate'].includes(key)) result[key] = rounded(result[key]);
  return result;
}

function budgetAmounts(budget) {
  const rows = Array.isArray(budget) ? budget : [];
  const missing = [];
  let total = 0, essential = 0;
  rows.forEach((r, i) => {
    const amount = nonnegative(r.amount);
    if (amount === null) missing.push(`budget[${i}].amount`);
    else { total += amount; if (r.essential) essential += amount; }
  });
  return { total: rounded(total), essential: rounded(essential), missing, count: rows.length };
}

export function calculatePlan(settings = {}, budget = []) {
  const b = budgetAmounts(budget), missing = [...b.missing], warnings = [];
  const salary = nonnegative(settings.salary), sideIncome = optional(settings.sideIncome);
  const savingsRate = pct(settings.savingsRate), sideRate = pct(settings.sideIncomeSavingsRate);
  const sso = present(settings.socialSecurityMonthly) ? nonnegative(settings.socialSecurityMonthly) : estimateSocialSecurity(salary, settings.taxYear);
  const monthlyWithheld = optional(settings.monthlyWithheld), sideWithheld = optional(settings.sideIncomeWithheld);
  const taxReserve = optional(settings.taxReserveMonthly), payrollOther = optional(settings.payrollOther);
  for (const [key, value] of Object.entries({salary,sideIncome,savingsRate,sideIncomeSavingsRate:sideRate,socialSecurityMonthly:sso,monthlyWithheld,sideIncomeWithheld:sideWithheld,taxReserveMonthly:taxReserve,payrollOther})) if (value === null) missing.push(key);
  if (!b.count) missing.push('budget');
  if (!present(settings.socialSecurityMonthly)) warnings.push('ประกันสังคมใช้ประมาณการ ม.33 อัตราปกติ โปรดแก้เป็นยอดตามสลิปเงินจริง');
  const fields = ['grossIncome','salary','sideIncome','savings','salarySavings','sideSavings','socialSecurity','withheld','taxReserve','payrollOther','takeHome','spendingLimit','remaining','feasible','maxSavingsRate'];
  if (missing.length) return {...missingResult(missing,fields,warnings),budgetTotal:b.missing.length ? null : b.total};
  const grossIncome = salary + sideIncome, salarySavings = salary * savingsRate, sideSavings = sideIncome * sideRate;
  const savings = salarySavings + sideSavings, withheld = monthlyWithheld + sideWithheld;
  const takeHome = grossIncome - sso - withheld - payrollOther;
  const spendingLimit = takeHome - savings - taxReserve, remaining = spendingLimit - b.total;
  const maxSavingsRate = salary > 0 ? Math.max(0,Math.min(100,(takeHome-taxReserve-b.total-sideSavings)/salary*100)) : 0;
  if (remaining < 0) warnings.push('งบนี้ใช้เงินมากกว่าเงินที่เหลือหลังออม ลดรายจ่ายหรือปรับเป้าออมเป็น 30–40% ก่อน แล้วเพิ่มเมื่อกระแสเงินสดเป็นบวก');
  return {complete:true,missing:[],warnings,grossIncome:rounded(grossIncome),salary,sideIncome,savings:rounded(savings),salarySavings:rounded(salarySavings),sideSavings:rounded(sideSavings),socialSecurity:sso,withheld:rounded(withheld),taxReserve,payrollOther,takeHome:rounded(takeHome),spendingLimit:rounded(spendingLimit),budgetTotal:b.total,remaining:rounded(remaining),feasible:remaining>=0,maxSavingsRate:rounded(maxSavingsRate)};
}

export function emergencyPlan(settings = {}, budget = []) {
  const b = budgetAmounts(budget), missing = [];
  const essentialMonthly = present(settings.essentialMonthly) ? nonnegative(settings.essentialMonthly) : b.count && !b.missing.length ? b.essential : null;
  const monthsTarget = optional(settings.emergencyMonths,6), current = nonnegative(settings.emergencyCurrent);
  const salary = nonnegative(settings.salary), side = optional(settings.sideIncome), salaryRate = pct(settings.savingsRate), sideRate = pct(settings.sideIncomeSavingsRate);
  const salaryAfterProbation = present(settings.salaryAfterProbation) ? nonnegative(settings.salaryAfterProbation) : salary;
  const probationMonths = optional(settings.probationMonths,0), salaryGrowth = num(settings.salaryGrowth) ?? 0, sideGrowth = num(settings.sideIncomeGrowth) ?? 0;
  for (const [key,value] of Object.entries({essentialMonthly,emergencyMonths:monthsTarget,emergencyCurrent:current,salary,sideIncome:side,savingsRate:salaryRate,sideIncomeSavingsRate:sideRate})) if (value === null) missing.push(key);
  if (salaryAfterProbation === null) missing.push('salaryAfterProbation');
  if (probationMonths === null || !Number.isInteger(probationMonths) || probationMonths > 1200) missing.push('probationMonths');
  if (salaryGrowth <= -100 || sideGrowth <= -100) missing.push('growth must exceed -100');
  if (missing.length) return missingResult(missing,['essentialMonthly','target','current','gap','monthlyContribution','months','progress','phase']);
  const target = essentialMonthly * monthsTarget, gap = Math.max(0,target-current), monthlyContribution = salary*salaryRate + side*sideRate;
  let months=gap===0?0:null, funded=current;
  for(let month=1;months===null && month<=1200;month++){
    const yearIndex=Math.floor((month-1)/12),salaryBase=month<=probationMonths?salary:salaryAfterProbation;
    funded+=salaryBase*(1+salaryGrowth/100)**yearIndex*salaryRate + side*(1+sideGrowth/100)**yearIndex*sideRate;
    if(funded>=target)months=month;
  }
  return {complete:true,missing:[],warnings:[],essentialMonthly,target:rounded(target),current,gap:rounded(gap),monthlyContribution:rounded(monthlyContribution),months,progress:target>0?Math.min(100,current/target*100):100,phase:gap>0?1:2};
}

export function projectWealth(settings = {}, budget = []) {
  const emergency = emergencyPlan(settings,budget), missing = [...(emergency.missing ?? [])];
  const opening = nonnegative(settings.currentSavings);
  const salaryGrowth = num(settings.salaryGrowth) ?? 0, sideGrowth = num(settings.sideIncomeGrowth) ?? 0;
  const horizonYears = optional(settings.horizonYears,10), probationMonths = optional(settings.probationMonths,0);
  const salaryAfterProbation = present(settings.salaryAfterProbation) ? nonnegative(settings.salaryAfterProbation) : nonnegative(settings.salary);
  if (opening === null) missing.push('currentSavings');
  if (opening !== null && emergency.current !== null && emergency.current > opening) missing.push('currentSavings must include emergencyCurrent');
  if (salaryGrowth <= -100) missing.push('salaryGrowth must exceed -100');
  if (sideGrowth <= -100) missing.push('sideIncomeGrowth must exceed -100');
  if (horizonYears === null || !Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 100) missing.push('horizonYears (1–100 integer)');
  if (probationMonths === null || !Number.isInteger(probationMonths) || probationMonths > 1200) missing.push('probationMonths (0–1200 integer)');
  if (salaryAfterProbation === null) missing.push('salaryAfterProbation');
  if (missing.length) return {complete:false,missing:[...new Set(missing)],scenarios:[],assumptions:[]};
  const target = emergency.target, salary = nonnegative(settings.salary), side = optional(settings.sideIncome), sr = pct(settings.savingsRate), ssr = pct(settings.sideIncomeSavingsRate);
  const rates = settings.scenarioRates ?? [0,2,5];
  if (!Array.isArray(rates) || rates.length!==3 || rates.some(r=>num(r)===null || num(r)<=-100 || num(r)>100)) return {complete:false,missing:['scenarioRates (three annual percentages, >-100 to100)'],scenarios:[],assumptions:[]};
  const scenarios = rates.map((rate,index) => {
    let cash = Math.min(emergency.current,target), invested = opening-cash, contributed=opening, completion = cash>=target?0:null;
    const monthlyRate = (1+Number(rate)/100)**(1/12)-1, points = [{year:0,month:0,balance:opening,contributed:opening,returns:0,emergency:cash,invested}];
    for (let month=1;month<=horizonYears*12;month++) {
      const yearIndex = Math.floor((month-1)/12);
      const salaryBase = month <= probationMonths ? salary : salaryAfterProbation;
      const payment = salaryBase*(1+salaryGrowth/100)**yearIndex*sr + side*(1+sideGrowth/100)**yearIndex*ssr;
      // Existing non-emergency assets earn the scenario rate; new money enters at month-end.
      invested *= 1+monthlyRate;
      const toEmergency = Math.min(payment,Math.max(0,target-cash));
      cash += toEmergency; invested += payment-toEmergency; contributed += payment;
      if (completion===null && cash>=target) completion=month;
      if (month%12===0) points.push({year:month/12,month,balance:rounded(cash+invested),contributed:rounded(contributed),returns:rounded(cash+invested-contributed),emergency:rounded(cash),invested:rounded(invested)});
    }
    return {id:['saving','lowRisk','balanced'][index],label:['ออมอย่างเดียว','ลงทุนความเสี่ยงต่ำ','ลงทุนแบบสมดุล'][index],annualRate:Number(rate),points,milestones:points.filter(p=>[1,3,5,10].includes(p.year)),emergencyCompletionMonth:completion};
  });
  return {complete:true,missing:[],scenarios,emergencyTarget:target,assumptions:[`ออม ${settings.savingsRate ?? 50}% ของเงินเดือนก่อนหัก; ออมรายได้เสริม ${settings.sideIncomeSavingsRate ?? 50}%`, `เงินเดือนเพิ่ม ${salaryGrowth}%/ปี รายได้เสริมเพิ่ม ${sideGrowth}%/ปี หลังครบทุก12เดือน`, `เงินเดือนฐานช่วง ${probationMonths} เดือนแรก ${salary} บาท หลังจากนั้น ${salaryAfterProbation} บาท; การขึ้นรายปีคูณฐานของเดือนนั้น`, `ผลตอบแทนสมมติ ${rates.join(' / ')}% ต่อปีแบบ effective rate; เงินสำรองฉุกเฉินไม่รับผลตอบแทนในแบบจำลอง`, 'เติมเงินปลายเดือน เติมกองฉุกเฉินก่อน ลงทุนเฉพาะส่วนที่เกินเป้า; ยอดเริ่มต้นรวมเงินฉุกเฉินแล้ว', 'ยอดเป็นมูลค่าอนาคตก่อนค่าธรรมเนียม ภาษีจากการลงทุน และเงินเฟ้อ ไม่ใช่ผลตอบแทนรับประกัน', 'แบบจำลองตามเป้าออม ไม่ยืนยันว่าจ่ายไหว โปรดตรวจงบรายเดือนและหนี้ก่อนใช้แผน']};
}

/** Fixed-rate, monthly reducing-balance loan. Not the special GYS repayment waterfall. */
export function amortizeLoan(input = {}) {
  const principal=nonnegative(input.principal),annualRate=nonnegative(input.annualRate),years=nonnegative(input.years),extraPayment=optional(input.extraPayment),missing=[];
  for(const [key,value] of Object.entries({principal,annualRate,years,extraPayment}))if(value===null)missing.push(key);
  if(years!==null && (years<=0 || years>100))missing.push('years (0–100]');
  const supplied=present(input.monthlyPayment)?nonnegative(input.monthlyPayment):null;
  if(present(input.monthlyPayment) && supplied===null)missing.push('monthlyPayment');
  if(missing.length)return {...missingResult(missing,['months','totalInterest','payment','remaining','negativeAmortization']),schedule:[]};
  const termMonths=Math.ceil(years*12),r=annualRate/1200;
  const standardPayment=principal===0?0:r===0?principal/termMonths:principal*r/(1-(1+r)**(-termMonths));
  const payment=supplied??standardPayment;
  if(principal===0)return {complete:true,missing:[],schedule:[],months:0,totalInterest:0,totalPaid:0,payment:rounded(payment),remaining:0,negativeAmortization:false,paidOff:true,termMonths};
  const negativeAmortization=payment+extraPayment<=principal*r || payment+extraPayment===0;
  let remaining=principal,totalInterest=0,totalPaid=0;
  const schedule=[];
  for(let month=1;month<=termMonths && remaining>1e-7;month++){
    const opening=remaining,interest=remaining*r,paid=Math.min(payment+extraPayment,remaining+interest),principalPaid=paid-interest;
    remaining=Math.max(0,remaining+interest-paid);totalInterest+=interest;totalPaid+=paid;
    if(remaining<1e-7)remaining=0;
    schedule.push({month,opening:rounded(opening),payment:rounded(paid),interest:rounded(interest),principal:rounded(principalPaid),remaining:rounded(remaining),cumulativeInterest:rounded(totalInterest)});
  }
  return {complete:true,missing:[],schedule,months:schedule.length,totalInterest:rounded(totalInterest),totalPaid:rounded(totalPaid),payment:rounded(payment),extraPayment,remaining:rounded(remaining),negativeAmortization,paidOff:remaining===0,termMonths,warnings:negativeAmortization?['ค่างวดไม่มากกว่าดอกเบี้ย หนี้จะไม่ลดลงตามแผน']:remaining>0?['ยังมีเงินต้นเหลือเมื่อสิ้นสุดระยะเวลาที่เลือก']:[]};
}

/** Workbook-equivalent annual compounding with contributions at end of year. */
export function compoundInvestment(input = {}) {
  const initial=nonnegative(input.initial),annualContribution=nonnegative(input.annualContribution),annualRate=num(input.annualRate),contributionYears=nonnegative(input.contributionYears),horizonYears=optional(input.horizonYears,40),missing=[];
  for(const [k,v] of Object.entries({initial,annualContribution,annualRate,contributionYears,horizonYears}))if(v===null)missing.push(k);
  if(annualRate!==null && annualRate<=-100)missing.push('annualRate must exceed -100');
  if(contributionYears!==null && !Number.isInteger(contributionYears))missing.push('contributionYears integer');
  if(horizonYears!==null && (!Number.isInteger(horizonYears)||horizonYears<1||horizonYears>100))missing.push('horizonYears (1–100 integer)');
  if(missing.length)return {complete:false,missing,points:[]};
  let balance=initial,principal=initial;
  const points=[{year:0,contribution:0,balance:rounded(initial),principal:rounded(initial),returns:0}];
  for(let year=1;year<=horizonYears;year++){
    const contribution=year<=contributionYears?annualContribution:0;
    balance=balance*(1+annualRate/100)+contribution;principal+=contribution;
    points.push({year,contribution,balance:rounded(balance),principal:rounded(principal),returns:rounded(balance-principal)});
  }
  return {complete:true,missing:[],points,final:points.at(-1),assumptions:['เงินสมทบเข้าปลายปี ผลตอบแทนทบต้นปีละครั้ง','ผลตอบแทนเป็นสมมติฐาน ก่อนภาษี ค่าธรรมเนียม และเงินเฟ้อ ไม่รับประกันเงินต้น']};
}

const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const d = new Date(`${value}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value;
};

export function summarizeTransactions(transactions = [], month = null) {
  if (month!==null && !/^\d{4}(-(?:0[1-9]|1[0-2]))?$/.test(String(month))) throw new RangeError('month must be YYYY or YYYY-MM');
  let income=0,expense=0,transfers=0,count=0,invalidCount=0;
  const byCategory=Object.create(null),byMonth=Object.create(null);
  for (const t of transactions) {
    const amount=nonnegative(t.amount);
    if (!validDate(t.date) || amount===null || !['income','expense','transfer'].includes(t.type)) { invalidCount++; continue; }
    if (month && !t.date.startsWith(month)) continue;
    count++;
    const ym=t.date.slice(0,7),category=String(t.categoryId ?? t.category ?? 'ไม่ระบุ');
    byMonth[ym] ??= {income:0,expense:0,transfers:0,net:0};
    if(t.type==='income'){income+=amount;byMonth[ym].income+=amount;}
    if(t.type==='expense'){expense+=amount;byMonth[ym].expense+=amount;byCategory[category]=rounded((byCategory[category]??0)+amount);}
    if(t.type==='transfer'){transfers+=amount;byMonth[ym].transfers+=amount;}
  }
  Object.values(byMonth).forEach(m=>{m.income=rounded(m.income);m.expense=rounded(m.expense);m.transfers=rounded(m.transfers);m.net=rounded(m.income-m.expense);});
  return {income:rounded(income),expense:rounded(expense),transfers:rounded(transfers),net:rounded(income-expense),count,byCategory,byMonth,invalidCount};
}

export function goalProgress(goal = {}, startMonth = null) {
  const target=nonnegative(goal.target),current=nonnegative(goal.current),monthlyContribution=nonnegative(goal.monthlyContribution),missing=[];
  for(const [k,v] of Object.entries({target,current,monthlyContribution}))if(v===null)missing.push(k);
  if(missing.length)return missingResult(missing,['gap','progress','months','targetMonth']);
  const gap=Math.max(0,target-current),months=gap===0?0:monthlyContribution>0?Math.ceil(gap/monthlyContribution):null;
  let targetMonth=null;
  if(startMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) && months!==null){
    const [y,m]=startMonth.split('-').map(Number),d=new Date(Date.UTC(y,m-1+months,1));targetMonth=d.toISOString().slice(0,7);
  }
  return {complete:true,missing:[],gap:rounded(gap),progress:target>0?Math.min(100,current/target*100):100,months,targetMonth};
}

export function netWorth(assets = [], liabilities = []) {
  const missing=[];
  const total=(rows,label)=>sum(rows.map((r,i)=>{const v=nonnegative(r.amount??r.value);if(v===null)missing.push(`${label}[${i}]`);return v??0;}));
  const assetTotal=total(assets,'assets'),liabilityTotal=total(liabilities,'liabilities');
  if(missing.length)return missingResult(missing,['assets','liabilities','netWorth']);
  return {complete:true,missing:[],assets:rounded(assetTotal),liabilities:rounded(liabilityTotal),netWorth:rounded(assetTotal-liabilityTotal)};
}
