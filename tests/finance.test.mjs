import {test} from 'node:test';
import assert from 'node:assert/strict';
import {progressiveTax,calculateTax,calculatePlan,emergencyPlan,projectWealth,summarizeTransactions,estimateSocialSecurity,amortizeLoan,compoundInvestment,goalProgress,netWorth} from '../public/finance.js';

const settings={salary:30000,sideIncome:0,savingsRate:50,sideIncomeSavingsRate:50,socialSecurityMonthly:875,monthlyWithheld:0,taxReserveMonthly:0,currentSavings:0,emergencyCurrent:0,emergencyMonths:6,salaryGrowth:0,sideIncomeGrowth:0};
const budget=[{id:'rent',amount:6000,essential:true},{id:'food',amount:4000,essential:true},{id:'leisure',amount:1000,essential:false}];
const salaryTax=(amount,extra={})=>calculateTax({taxYear:2026,incomes:[{type:'40(1)',amount,withheld:0}],socialSecurity:10500,...extra});

test('all progressive bracket boundaries match accumulated statutory rates',()=>{
  const samples=[[0,0],[150000,0],[150001,.05],[300000,7500],[500000,27500],[750000,65000],[1000000,115000],[2000000,365000],[5000000,1265000],[6000000,1615000]];
  for(const [income,expected]of samples)assert.equal(progressiveTax(income),expected);
  assert.equal(progressiveTax(null),null);assert.equal(progressiveTax(-1),null);
});

test('40(1) and40(2) share the100k expense ceiling, withholding is credit',()=>{
  const t=calculateTax({incomes:[{type:'40(1)',amount:360000,withheld:2000},{type:'40(2)',amount:120000,withheld:3600}],socialSecurity:10500});
  assert.equal(t.complete,true);assert.equal(t.sharedEmploymentExpense,100000);assert.equal(t.netIncome,309500);
  assert.equal(t.annualTax,8450);assert.equal(t.credits,5600);assert.equal(t.balanceDue,2850);assert.equal(t.monthlyReserve,237.5);
});

test('refund and tax reserve are separate and paid midyear credit is included once',()=>{
  const t=calculateTax({incomes:[{type:'40(1)',amount:360000,withheld:6000}],socialSecurity:10500,taxPaidMidYear:1000,reserveExisting:5000,monthsRemaining:3});
  assert.equal(t.annualTax,1975);assert.equal(t.balanceDue,0);assert.equal(t.refund,5025);assert.equal(t.monthlyReserve,0);
  const due=salaryTax(600000,{reserveExisting:1000,monthsRemaining:2});
  assert.equal(due.monthlyReserve,(due.balanceDue-1000)/2);
});

test('minimum tax exception through5000 and higher method above it',()=>{
  const at=calculateTax({incomes:[{type:'40(8)',amount:1000000,expense:940000,withheld:0}],socialSecurity:0});
  assert.equal(at.minimumTaxRaw,5000);assert.equal(at.minimumTaxExempt,true);assert.equal(at.annualTax,0);
  const above=calculateTax({incomes:[{type:'40(8)',amount:1000200,expense:940200,withheld:0}],socialSecurity:0});
  assert.equal(above.minimumTax,5001);assert.equal(above.annualTax,5001);assert.equal(above.midYearRelevant,true);
  assert.equal(salaryTax(2000000).minimumTaxBase,0);
});

test('no invented tax for missing or unknown income and unknown expenses',()=>{
  for(const input of [{},{incomes:[]},{incomes:[{type:'40(1)',amount:null}]},{incomes:[{type:'unclassified',amount:12000}]},{incomes:[{type:'40(8)',amount:12000}]}]){
    const t=calculateTax(input);assert.equal(t.complete,false);assert.equal(t.annualTax,null);assert.ok(t.missing.length);
  }
  assert.equal(salaryTax(0,{socialSecurity:0}).annualTax,0);
  assert.equal(calculateTax({incomes:[{type:'40(8)',amount:10,expense:20}]}).complete,false);
});

test('deduction caps prevent life-health and PVD-RMF double allowances',()=>{
  const t=salaryTax(2000000,{deductions:{lifeInsurance:90000,healthInsurance:25000,providentFund:300000,rmf:500000,thaiEsg:400000}});
  assert.equal(t.deductionDetails.lifeInsurance,90000);assert.equal(t.deductionDetails.healthInsurance,10000);
  assert.equal(t.deductionDetails.providentFund,300000);assert.equal(t.deductionDetails.rmf,200000);assert.equal(t.deductionDetails.thaiEsg,300000);
  const future=salaryTax(500000,{taxYear:2027,deductions:{thaiEsg:30000}});assert.equal(future.deductionDetails.thaiEsg,0);assert.ok(future.warnings.length);
});

test('SSO2026 cap differs from2025 and explicit actual zero remains zero',()=>{
  assert.equal(estimateSocialSecurity(21000,2026),875);assert.equal(estimateSocialSecurity(21000,2025),750);
  assert.equal(estimateSocialSecurity(10000,2026),500);assert.equal(estimateSocialSecurity(null),null);
  assert.equal(estimateSocialSecurity(21000,2030),null);
  assert.equal(salaryTax(360000,{socialSecurity:90000}).deductionDetails.socialSecurity,10500);
  const p=calculatePlan({...settings,socialSecurityMonthly:0},budget);assert.equal(p.socialSecurity,0);
});

test('gross50% is not50% of take-home; SSO and WHT reduce actual spending room',()=>{
  const p=calculatePlan({...settings,monthlyWithheld:500,taxReserveMonthly:200},budget);
  assert.equal(p.savings,15000);assert.equal(p.takeHome,28625);assert.equal(p.spendingLimit,13425);assert.equal(p.remaining,2425);assert.equal(p.feasible,true);
  assert.equal(calculatePlan({...settings,salary:18000},budget).feasible,false);
  assert.equal(calculatePlan({...settings,salary:null},budget).savings,null);
  assert.equal(calculatePlan(settings,[{amount:null}]).complete,false);
  assert.equal(calculatePlan(settings,[]).complete,false);
});

test('emergency goal uses essential costs only, supports zero and unreachable',()=>{
  const e=emergencyPlan(settings,budget);assert.equal(e.target,60000);assert.equal(e.months,4);
  assert.equal(emergencyPlan({...settings,emergencyCurrent:60000},budget).months,0);
  assert.equal(emergencyPlan({...settings,savingsRate:0},budget).months,null);
  assert.equal(emergencyPlan({...settings,emergencyCurrent:null},budget).complete,false);
});

test('confirmed probation uplift funds54000 after five months and annual growth follows stated anniversary',()=>{
  const s={...settings,salary:21000,salaryAfterProbation:23000,probationMonths:3,salaryGrowth:20,essentialMonthly:9000,socialSecurityMonthly:0};
  assert.equal(emergencyPlan(s,budget).months,5);
  const p=projectWealth(s,budget);assert.equal(p.complete,true);assert.equal(p.scenarios[0].points[1].balance,135000);
  assert.equal(p.scenarios[0].points[2].balance,300600);assert.equal(p.scenarios[0].emergencyCompletionMonth,5);
});

test('projections conserve principal at0%, keep emergency cash separate, never double initial savings',()=>{
  const p=projectWealth(settings,budget);assert.equal(p.complete,true);
  assert.equal(p.scenarios[0].points[1].balance,180000);assert.equal(p.scenarios[0].points[10].balance,1800000);
  assert.equal(p.scenarios[0].points[10].returns,0);assert.equal(p.scenarios[2].points[10].emergency,60000);
  assert.ok(p.scenarios[2].points[10].balance>p.scenarios[1].points[10].balance);
  const funded=projectWealth({...settings,currentSavings:100000,emergencyCurrent:60000},budget);
  assert.equal(funded.scenarios[0].points[1].balance,280000);
  assert.equal(projectWealth({...settings,currentSavings:0,emergencyCurrent:1},budget).complete,false);
  assert.equal(projectWealth({...settings,currentSavings:null},budget).complete,false);
});

test('effective annual return, no first-month return on month-end deposits',()=>{
  const p=projectWealth({...settings,salary:0,currentSavings:100000,emergencyCurrent:0,essentialMonthly:0,scenarioRates:[0,2,5]},[]);
  assert.equal(p.scenarios[2].points[1].balance,105000);
  const allEmergency=projectWealth({...settings,essentialMonthly:1000000},[]);
  assert.equal(allEmergency.scenarios[2].points[1].balance,180000);
});

test('ledger transfer is neither income nor expense; invalid and leap dates handled',()=>{
  const rows=[{date:'2026-10-01',type:'income',amount:21000},{date:'2026-10-02',type:'transfer',amount:10500},{date:'2026-10-02',type:'expense',amount:300,categoryId:'food'},{date:'2026-09-01',type:'expense',amount:100},{date:'2026-02-30',type:'expense',amount:900},{date:'2026-10-03',type:'expense',amount:-10}];
  const s=summarizeTransactions(rows,'2026-10');assert.equal(s.income,21000);assert.equal(s.expense,300);assert.equal(s.transfers,10500);assert.equal(s.net,20700);assert.equal(s.count,3);assert.equal(s.invalidCount,2);assert.equal(s.byCategory.food,300);
  assert.equal(summarizeTransactions(rows,'2026').expense,400);assert.throws(()=>summarizeTransactions(rows,'2026-13'));
});

test('loan zero-rate and ordinary monthly amortization balance identity',()=>{
  const zero=amortizeLoan({principal:120000,annualRate:0,years:1});assert.equal(zero.payment,10000);assert.equal(zero.totalInterest,0);assert.equal(zero.months,12);assert.equal(zero.remaining,0);
  const normal=amortizeLoan({principal:1000000,annualRate:6,years:30});assert.equal(normal.payment,5995.51);assert.equal(normal.remaining,0);assert.equal(normal.schedule.length,360);assert.equal(normal.negativeAmortization,false);
  assert.ok(Math.abs(normal.totalPaid-normal.totalInterest-1000000)<.02);
  const extra=amortizeLoan({principal:1000000,annualRate:6,years:30,extraPayment:1000});assert.ok(extra.months<normal.months);assert.ok(extra.totalInterest<normal.totalInterest);
});

test('loan underpayment exposes remaining debt; final payment is clipped',()=>{
  const bad=amortizeLoan({principal:100000,annualRate:12,years:1,monthlyPayment:500});assert.equal(bad.negativeAmortization,true);assert.equal(bad.paidOff,false);assert.ok(bad.remaining>100000);
  const over=amortizeLoan({principal:100,annualRate:0,years:1,monthlyPayment:200});assert.equal(over.months,1);assert.equal(over.totalPaid,100);
  assert.equal(amortizeLoan({principal:null,annualRate:6,years:3}).complete,false);
});

test('annual investment workbook end-year deposits and contribution stop rule',()=>{
  const zero=compoundInvestment({initial:1000,annualContribution:12000,annualRate:0,contributionYears:3,horizonYears:40});assert.equal(zero.final.balance,37000);assert.equal(zero.final.returns,0);assert.equal(zero.points.length,41);
  const fv=compoundInvestment({initial:1000,annualContribution:100,annualRate:10,contributionYears:2,horizonYears:3});assert.equal(fv.points[1].balance,1200);assert.equal(fv.points[2].balance,1420);assert.equal(fv.final.balance,1562);assert.equal(fv.final.principal,1200);assert.equal(fv.final.returns,362);
  assert.equal(compoundInvestment({initial:null,annualContribution:100,annualRate:10,contributionYears:2}).complete,false);
});

test('goals and net worth preserve unknown amounts and cross year correctly',()=>{
  assert.equal(goalProgress({target:1000,current:200,monthlyContribution:200},'2026-10').targetMonth,'2027-02');
  assert.equal(goalProgress({target:1000,current:200,monthlyContribution:0}).months,null);
  assert.equal(netWorth([{amount:1000}],[{value:200}]).netWorth,800);
  assert.equal(netWorth([{amount:null}],[]).netWorth,null);
});
