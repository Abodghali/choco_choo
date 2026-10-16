'use client';
import { useCustomerLanguage } from './CustomerLanguage';
import { useEffect, useState } from 'react';
import type { Order } from '@/lib/db';
const STORAGE = 'choco-active-order';
export function rememberOrder(id: string) { try { localStorage.setItem(STORAGE,id); } catch {} }
export default function OrderTracker({ initialOrder }: { initialOrder: Order | null }) {
 const { t } = useCustomerLanguage();
 const [order,setOrder] = useState<Order | null>(null);
 const [id,setId] = useState<string | null>(null);
 const [now,setNow] = useState(0);
 const [offset,setOffset] = useState(0);
 const [minimized,setMinimized] = useState(false);
 const [offline,setOffline] = useState(false);
 useEffect(() => {
  if (initialOrder) { rememberOrder(initialOrder.id); setId(initialOrder.id); setOrder(initialOrder); setMinimized(false); }
  else { try { setId(localStorage.getItem(STORAGE)); } catch {} }
 },[initialOrder]);
 useEffect(() => {
  if (!id) return;
  let cancelled=false; let timer: ReturnType<typeof setTimeout>;
  const poll=async()=>{
   try {
    const response=await fetch('/api/orders?id='+encodeURIComponent(id),{cache:'no-store'});
    if (cancelled) return;
    if (response.status===401 || response.status===404) { setId(null); setOrder(null); try {localStorage.removeItem(STORAGE);} catch {} return; }
    if (!response.ok) throw new Error('Offline');
    const data=await response.json();
    if(cancelled) return;
    setOrder(data);setOffline(false);
    if(typeof data.serverNow==='number') setOffset(data.serverNow-Date.now());
   } catch { if(!cancelled) setOffline(true); }
   if(!cancelled) timer=setTimeout(poll,5000);
  };
  void poll(); return ()=>{cancelled=true;clearTimeout(timer);};
 },[id]);
 useEffect(()=>{setNow(Date.now()+offset);const timer=setInterval(()=>setNow(Date.now()+offset),1000);return()=>clearInterval(timer);},[offset]);
 if(!order) return null;
 const title=order.status==='completed'?t("Vaše objednávka je připravena!"):order.status==='cancelled'?t("Objednávka byla zrušena"):order.status==='preparing'?t("Objednávka přijata — připravujeme"):t("Čekáme na přijetí objednávky");
 const seconds=order.readyAt?Math.max(0,Math.ceil((new Date(order.readyAt).getTime()-now)/1000)):null;
 return <aside className={'order-tracker '+(order.status==='completed'?'is-ready':'')} aria-label={t("Stav objednávky")}>
  <div className="tracker-heading"><strong role="status">#{order.customerNumber} · {title}</strong><button type="button" onClick={()=>setMinimized(!minimized)} aria-expanded={!minimized}>{minimized?t("Zobrazit"):t("Sbalit")}</button></div>
  {!minimized && <div className="tracker-body">
   {order.status==='pending' && <p>{t("Obsluha potvrdí objednávku a nastaví dobu přípravy.")}</p>}
   {order.status==='preparing' && <>{seconds!==null && seconds>0?<p>{t("Předpokládaný zbývající čas:")} <strong className="countdown">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong></p>:<p>{t("Dokončujeme přípravu. Čekáme na potvrzení obsluhy.")}</p>}<small>{t("Čas je orientační. Jakmile bude objednávka hotová, uvidíte potvrzení zde.")}</small></>}
   {order.status==='completed' && <p>{t("Vaše objednávka je připravena k vyzvednutí. Dobrou chuť!")}</p>}
   {order.paymentMethod!=='cash' && order.paymentStatus!=='paid' && <p>{t("Platba zatím není potvrzena.")}</p>}
   {offline && <p role="status">{t("Spojení přerušeno. Zobrazen poslední známý stav; zkoušíme znovu.")}</p>}
   {(order.status==='completed'||order.status==='cancelled') && <button className="btn btn-secondary btn-sm" onClick={()=>{setId(null);setOrder(null);try{localStorage.removeItem(STORAGE);}catch{}}}>{t("Zavřít sledování")}</button>}
  </div>}
 </aside>;
}
