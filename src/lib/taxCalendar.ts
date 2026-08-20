import type { AppState, TaxPayment } from '@/types'
import { calcTax, fmtMoney } from './tax'

export type ObligationKind = 'notification' | 'tax' | 'patent' | 'insurance' | 'declaration'
export type ObligationStatus = 'paid' | 'overdue' | 'soon' | 'upcoming' | 'future'
export interface TaxObligation { id:string; organizationId:string; organizationName:string; kind:ObligationKind; title:string; dueDate:string; amount?:number; paidAmount:number; balance?:number; status:ObligationStatus; note?:string; source?:string }
const toIso=(d:Date)=>d.toISOString().slice(0,10); const parse=(s:string)=>new Date(`${s}T00:00:00`)
function baseStatus(due:string,today:string):Exclude<ObligationStatus,'paid'>{ const days=Math.ceil((parse(due).getTime()-parse(today).getTime())/86400000); return days<0?'overdue':days<=14?'soon':days<=60?'upcoming':'future' }
function paidFor(payments:TaxPayment[], id:string){ return payments.filter(p=>p.obligationId===id).reduce((s,p)=>s+p.amount,0) }
function add(rows:TaxObligation[], state:AppState, item:Omit<TaxObligation,'paidAmount'|'balance'|'status'>, today:string){ const paidAmount=paidFor(state.taxPayments??[],item.id); const balance=item.amount==null?undefined:Math.max(0,item.amount-paidAmount); const status:ObligationStatus=item.amount!=null&&balance===0?'paid':baseStatus(item.dueDate,today); rows.push({...item,paidAmount,balance,status}) }

export function buildTaxCalendar(state:AppState, year=2026, today=toIso(new Date())):TaxObligation[]{
 const rows:TaxObligation[]=[]
 for(const org of state.organizations??[]){
  const stores=state.stores.filter(s=>s.organizationId===org.id); const usn=stores.filter(s=>s.regime==='usn6'||s.regime==='usn15')
  if(year===2026&&usn.length){
   const ds=[['1 квартал','2026-04-27','2026-04-28','2026-03-31'],['полугодие','2026-07-27','2026-07-28','2026-06-30'],['9 месяцев','2026-10-26','2026-10-28','2026-09-30']] as const
   let previousCumulative=0
   for(const [label,notice,pay,end] of ds){
    const cumulative=usn.reduce((sum,s)=>sum+calcTax(s,state.operations.filter(o=>o.storeId===s.id&&o.date>='2026-01-01'&&o.date<=end)).taxDue,0)
    const advance=Math.max(0,cumulative-previousCumulative); previousCumulative=cumulative
    add(rows,state,{id:`${org.id}-usn-notice-${label}`,organizationId:org.id,organizationName:org.name,kind:'notification',title:`Уведомление по УСН — ${label}`,dueDate:notice,amount:advance||undefined,note:'Сумма предварительная: зависит от полноты операций и ранее учтённых вычетов.',source:'Налоговый календарь 2026'},today)
    add(rows,state,{id:`${org.id}-usn-pay-${label}`,organizationId:org.id,organizationName:org.name,kind:'tax',title:`Аванс УСН — ${label}`,dueDate:pay,amount:advance,note:'После внесения фактической оплаты остаток уменьшается автоматически.',source:'Налоговый календарь 2026'},today)
   }
   add(rows,state,{id:`${org.id}-usn-year-pay`,organizationId:org.id,organizationName:org.name,kind:'tax',title:'УСН за 2026 год — ИП',dueDate:'2027-04-28',note:'Итоговая сумма появится после полного годового расчёта.',source:'Налоговый календарь 2026'},today)
  }
  if(year===2026&&stores.some(s=>s.legalForm==='ip')){
   add(rows,state,{id:`${org.id}-insurance-fixed-2026`,organizationId:org.id,organizationName:org.name,kind:'insurance',title:'Фиксированные страховые взносы ИП за 2026 год',dueDate:'2026-12-28',amount:57390,note:'Фактическую оплату можно отметить в календаре.',source:'Налоговый календарь 2026'},today)
   add(rows,state,{id:`${org.id}-insurance-1pct-2026`,organizationId:org.id,organizationName:org.name,kind:'insurance',title:'Дополнительный страховой взнос 1% за 2026 год',dueDate:'2027-07-01',note:'Сумма определяется после расчёта базы свыше 300 000 ₽.',source:'Налоговый календарь 2026'},today)
  }
  for(const reg of (state.taxRegistrations??[]).filter(r=>r.organizationId===org.id&&r.regime==='psn')) for(const [i,p] of (reg.patent?.payments??[]).entries()) add(rows,state,{id:`${org.id}-patent-${reg.id}-${i}`,organizationId:org.id,organizationName:org.name,kind:'patent',title:i===0?'ПСН — первый платеж':'ПСН — оставшаяся часть',dueDate:p.dueDate,amount:p.amount,note:reg.patent?.patentNumber?`Патент № ${reg.patent.patentNumber}`:'Сумма из карточки патента.',source:'Патент ФНС'},today)
 }
 return rows.sort((a,b)=>a.dueDate.localeCompare(b.dueDate))
}
export function calendarSummary(rows:TaxObligation[]){return{paid:rows.filter(r=>r.status==='paid').length,overdue:rows.filter(r=>r.status==='overdue').length,soon:rows.filter(r=>r.status==='soon').length,upcoming:rows.filter(r=>r.status==='upcoming').length,amountSoon:rows.filter(r=>r.status==='soon').reduce((s,r)=>s+(r.balance??r.amount??0),0),overdueBalance:rows.filter(r=>r.status==='overdue').reduce((s,r)=>s+(r.balance??r.amount??0),0)}}
export const obligationKindLabel:Record<ObligationKind,string>={notification:'Уведомление',tax:'Налог',patent:'ПСН',insurance:'Взносы',declaration:'Декларация'}
export const formatObligationAmount=(n?:number)=>n==null?'сумма уточняется':fmtMoney(n)
