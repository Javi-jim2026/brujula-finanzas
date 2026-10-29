import test from 'node:test';
import assert from 'node:assert/strict';
import {payDate,salaryPeriod,weekPeriod,paymentPlan,treasurySummary} from '../payday-planning.mjs';
import {renderPaydayPanel,paydayAction} from '../payday-panel.mjs';
test('Nómina cada día 15 y 30, en febrero último día real',()=>{
 assert.equal(payDate('2026-02',30),'2026-02-28');
 assert.equal(payDate('2028-02',30),'2028-02-29');
 assert.equal(payDate('2026-10',30),'2026-10-30');
 assert.deepEqual(salaryPeriod('2026-10-29'),{start:'2026-10-15',end:'2026-10-29',nextPayday:'2026-10-30',label:'Quincena actual'});
 assert.deepEqual(salaryPeriod('2026-10-30'),{start:'2026-10-30',end:'2026-11-14',nextPayday:'2026-11-15',label:'Quincena actual'});
 assert.deepEqual(salaryPeriod('2026-02-28'),{start:'2026-02-28',end:'2026-03-14',nextPayday:'2026-03-15',label:'Quincena actual'});
 assert.equal(salaryPeriod('2026-10-29',1).start,'2026-10-30');
});
test('Ventana semanal incluye exactamente siete fechas',()=>{
 assert.deepEqual(weekPeriod('2026-10-29'),{start:'2026-10-29',end:'2026-11-04',nextPayday:null,label:'Próximos 7 días'});
 assert.equal(weekPeriod('2026-10-29',1).start,'2026-11-05');
});
const state={
 accounts:[{id:'cc',kind:'credit',credit_limit:10000,opening_balance:4000,active:true},
 {id:'debit',kind:'debit',opening_balance:3500,active:true}],
 statements:[{id:'statement1',account_id:'cc',close_date:'2026-10-20',due_date:'2026-11-01',no_interest_amount:1400,paid_before_baseline:0}],
 movements:[{statement_id:'statement1',kind:'payment',account_id:'cc',transaction_date:'2026-10-28',amount:400}],
 recurring_bills:[{id:'net',name:'Internet',amount:500,active:true,frequency:'monthly',next_date:'2026-11-03',due_day:3,account_id:'debit',direction:'expense'},
 {id:'tv',name:'Streaming',amount:200,active:true,frequency:'monthly',next_date:'2026-11-02',due_day:2,account_id:'cc',direction:'expense'},
 {id:'salary',name:'Nómina',amount:7000,active:true,frequency:'monthly',next_date:'2026-10-30',due_day:30,direction:'income'}],
 recurring_postings:[],recurring_checks:[],
 loans:[{id:'loan',name:'Auto',status:'active',monthly_payment:900,next_due_date:'2026-11-04',payroll_deduction:true}],
 loan_payments:[],installments:[{id:'msi',months:18,installments_paid:11,original_amount:9000}]
};
test('No duplicar MSI, cargos a crédito, ni descuentos directos de nómina',()=>{
 const p=paymentPlan(state,'2026-10-29','2026-11-04',{today:'2026-10-29'});
 assert.equal(p.required,1500); // 1000 de tarjeta ya descontando pago + 500 internet
 assert.equal(p.incomePlanned,7000);
 assert.equal(p.creditCharges,200);
 assert.equal(p.payrollDeductions,900);
 assert.equal(p.payable.length,2);
 assert.equal(p.duplicates.length,0);
});
test('No contar cargos fijos confirmados y guardar separación del crédito disponible',()=>{
 const copy={...state,recurring_postings:[{bill_id:'net',occurrence_date:'2026-11-03',status:'posted'}]};
 assert.equal(paymentPlan(copy,'2026-10-29','2026-11-04').required,1000);
 const a=treasurySummary(state,a=>a.opening_balance,a=>a.credit_limit-a.opening_balance,'2026-10-29');
 assert.equal(a.liquid,3500);
 assert.equal(a.cards,4000);
 assert.equal(a.credit,6000);
 assert.equal(a.weekly.required,1500);
 assert.equal(a.weeklyDifference,2000);
 assert.equal(a.period.nextPayday,'2026-10-30');
 assert.equal(a.upcoming.required,0);
});
test('No contar dos veces compromiso de préstamo que también se registró como gasto fijo',()=>{
 const data={...state,recurring_bills:[{id:'auto-fijo',name:'Pago crédito auto',amount:900,active:true,frequency:'monthly',next_date:'2026-11-04',due_day:4,direction:'expense'}],
 loans:[{...state.loans[0],payroll_deduction:false}]};
 const plan=paymentPlan(data,'2026-11-01','2026-11-07');
 assert.equal(plan.required,1900); // préstamo 900 + corte bancario pendiente de 1000
 assert.equal(plan.duplicates.length,1);
});
test('Panel de resumen de nómina muestra fechas, totales y pagos sin escribir datos',()=>{
 const original=JSON.stringify(state);
 const html=renderPaydayPanel({state,dateToday:()=> '2026-10-29',accountBalance:a=>a.opening_balance,shownAvailable:a=>a.credit_limit-a.opening_balance});
 assert.match(html,/Mi dinero entre nóminas/);
 assert.match(html,/Crédito disponible total/);
 assert.match(html,/Pagos hasta la próxima nómina/);
 assert.match(html,/Streaming/);
 assert.match(html,/cash-week-next/);
 assert.equal(JSON.stringify(state),original);
 assert.equal(paydayAction({dataset:{act:'not-a-payday'}},()=>{}),false);
});
