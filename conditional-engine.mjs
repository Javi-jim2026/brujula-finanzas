/* Brújula v1.13 · condiciones temporales deterministas.
 * - Un histórico se registra, pero YA forma parte del saldo inicial.
 * - Una compra cae en el corte siguiente solo cuando ocurre DESPUÉS del día de corte.
 * - La fecha real del banco y el importe oficial prevalecen sobre proyecciones.
 */
import {addMonths,monthlyDate,cash} from './planning-rules.mjs';
import {cycleDates,cycleRule,cardPaymentTimeline} from './card-cycle.mjs';
const ISO=/^\d{4}-\d{2}-\d{2}$/;
const spendKinds=new Set(['purchase','expense','fee','interest']);
const creditKinds=new Set(['purchase','fee','interest']);
export const isHistoricalMovement=(account,date)=>Boolean(account?.opening_balance_date&&date&&date<=account.opening_balance_date);
export function transactionCycle(card,date){
 if(!ISO.test(String(date||''))||card?.kind!=='credit'||!Number(card.cutoff_day))return null;
 const month=date.slice(0,7);
 const cutoffThis=monthlyDate(month,Number(card.cutoff_day));
 const closeMonth=date<=cutoffThis?month:addMonths(month,1);
 const cutoff=monthlyDate(closeMonth,Number(card.cutoff_day));
 const schedule=cycleDates(card,closeMonth);
 return {closeMonth,cutoff,alreadyPastCutoff:date>cutoffThis,
  estimatedDue:schedule?.earliest||null,estimatedDueEnd:schedule?.latest||null};
}
export function evaluateMovement(account,movement,today){
 const date=String(movement.transaction_date||''),kind=String(movement.kind||''),
 historical=isHistoricalMovement(account,date);
 if(!ISO.test(date)||date>today)return {ok:false,historical:false,
  message:!ISO.test(date)?'Selecciona una fecha válida.':'Para una compra o pago futuro utiliza un compromiso programado; Movimientos registra operaciones que ya ocurrieron.'};
 if(historical&&!spendKinds.has(kind))return {ok:false,historical:true,
  message:'Los pagos, ingresos y transferencias anteriores al saldo inicial ya están incluidos allí. No pueden registrarse como un nuevo abono. Solo se permiten gastos históricos sin afectar el saldo.'};
 const cycle=creditKinds.has(kind)?transactionCycle(account,date):null;
 const status=historical?'historical':cycle?.alreadyPastCutoff?'after-cutoff':cycle?'before-cutoff':'current';
 return {ok:true,historical,status,cycle,changesBalance:!historical,
  message:historical?'Movimiento histórico: se conserva para tus reportes, pero ya está incluido en el saldo inicial. No aumenta la deuda ni reduce el crédito disponible.':
   cycle?.estimatedDue?'Compra del ciclo que corta el '+cycle.cutoff+'. Vencimiento habitual previsto: '+cycle.estimatedDue+
    (cycle.estimatedDueEnd!==cycle.estimatedDue?' a '+cycle.estimatedDueEnd:'')+
    '. La cifra a pagar solo se confirma con el estado de cuenta del banco.':
   cycle?'Compra del ciclo que cierra el '+cycle.cutoff+'. Falta configurar cuándo vence ese corte.':
   'Se aplicará una sola vez al saldo estimado de la cuenta.'};
}
function expenseForCredit(m,a){return m.account_id===a.id&&creditKinds.has(m.kind)}
export function accountCycleDecisions(state,account,today){
 if(account.kind!=='credit'||account.active===false)return null;
 const thisDate=transactionCycle(account,today);
 if(!thisDate)return {configured:false,accountId:account.id,accountName:account.name};
 const month=today.slice(0,7),closeThis=monthlyDate(month,Number(account.cutoff_day));
 const current=transactionCycle(account,today);
 const previousClose=monthlyDate(addMonths(current.closeMonth,-1),Number(account.cutoff_day));
 const past=state.movements.filter(m=>expenseForCredit(m,account));
 const inCycle=past.filter(m=>m.transaction_date>previousClose&&m.transaction_date<=current.cutoff);
 const historical=inCycle.filter(m=>m.historical_only||isHistoricalMovement(account,m.transaction_date));
 const newSpend=inCycle.filter(m=>!m.historical_only&&!isHistoricalMovement(account,m.transaction_date));
 const todayCut=today===closeThis;
 const cutPassed=today>closeThis;
 const timeline=cardPaymentTimeline(account,state.statements||[],state.movements||[],today);
 // Prefer overdue official obligation if one is still outstanding; otherwise next upcoming.
 const unpaid=timeline.filter(x=>x.source==='official'&&x.amount>0);
 const overdue=unpaid.filter(x=>x.date<today).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
 const next=unpaid.filter(x=>x.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]||
 timeline.filter(x=>x.source==='estimated'&&x.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
 const actual=overdue||next;
 const recordedCut=(state.statements||[]).some(s=>s.account_id===account.id&&s.close_date===closeThis);
 return {configured:true,accountId:account.id,accountName:account.name,currentClose:current.cutoff,
  previousClose,cutoffToday:todayCut,cutoffPassed:cutPassed,
  cycleLabel:todayCut?'El corte habitual es hoy':cutPassed?'Corte habitual del mes ya pasó':'Aún dentro del periodo previo al corte',
  purchaseCount:newSpend.length,cycleSpend:cash(newSpend.reduce((n,m)=>n+Number(m.amount),0)),
  historicalSpend:cash(historical.reduce((n,m)=>n+Number(m.amount),0)),
  payment:actual,cutRecorded:recordedCut,closeThisMonth:closeThis,
  cycleRuleComplete:Boolean(cycleRule(account))};
}
export function cycleSpendSummary(state,accounts,today){
 return (accounts||[]).filter(a=>a.kind==='credit'&&a.active!==false)
  .map(a=>accountCycleDecisions(state,a,today));
}
