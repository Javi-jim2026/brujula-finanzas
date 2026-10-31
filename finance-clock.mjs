/* Brújula v1.14: reloj de referencia, hora local contrastada con servidor.
   El reloj no sustituye la fecha del corte bancario. */
const pad=n=>String(n).padStart(2,'0');
export function localDay(at){const d=new Date(at);return [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-')}
export function localTime(at){const d=new Date(at);return pad(d.getHours())+':'+pad(d.getMinutes())}
export function financeClock({now=()=>Date.now(),timeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'Hora local'}={}){
 let offsetMs=0,lastVerifiedMs=null,driftMs=null,status='device';
 const corrected=()=>new Date(now()+offsetMs);
 return {
  now:corrected,
  today:()=>localDay(corrected()),
  snapshot(){
   const d=corrected();
   return Object.freeze({today:localDay(d),time:localTime(d),timeZone:timeZone(),
    checkedAt:lastVerifiedMs,driftMs,source:status,verified:status==='server'});
  },
  compareServer(utcIso,startedMs,finishedMs){
   const serverMs=Date.parse(utcIso);
   if(!Number.isFinite(serverMs)||!Number.isFinite(startedMs)||!Number.isFinite(finishedMs)||
       finishedMs<startedMs||finishedMs-startedMs>30000)return false;
   const midpoint=startedMs+(finishedMs-startedMs)/2;
   driftMs=serverMs-midpoint;
   offsetMs=driftMs;
   lastVerifiedMs=finishedMs;
   status='server';
   return true;
  },
  offline(){status='device';offsetMs=0;lastVerifiedMs=null;driftMs=null},
  needsCheck(minutes=5){return status!=='server'||lastVerifiedMs===null||now()-lastVerifiedMs>minutes*60000}
 };
}
export function timeStatus(snapshot){
 if(!snapshot.verified)return {key:'unverified',label:'Reloj del dispositivo · sin verificar',warning:true};
 const mins=Math.round(Math.abs(snapshot.driftMs||0)/60000);
 if(Math.abs(snapshot.driftMs||0)>120000)return {key:'adjusted',label:'Hora ajustada con servidor ('+mins+' min de diferencia)',warning:true};
 return {key:'verified',label:'Hora contrastada con servidor',warning:false};
}
