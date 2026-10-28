/* F1: ranked, snoozable smart stack. */
const CARDS={};
function cardCtx(){return {now:Date.now(),k:todayKey()};}
function topCards(max){
 const ctx=cardCtx(),snoozed=store.get('cardSnooze:'+ctx.k)||[];
 return Object.keys(CARDS).filter(id=>!snoozed.includes(id))
   .map(id=>({id,r:typeof CARDS[id].rank==='function'?(+CARDS[id].rank(ctx)||0):0}))
   .filter(c=>c.r>0).sort((a,b)=>b.r-a.r||a.id.localeCompare(b.id))
   .slice(0,max==null?3:Math.max(0,max));
}
function cardFrame(id,ctx){
 const c=CARDS[id];if(!c||typeof c.render!=='function')return '';
 return '<section class="k-card f1-card" data-card="'+esc(id)+'"><div class="f1-card-head"><div class="f1-card-body">'+
   c.render(ctx||cardCtx())+'</div>'+kIconBtn('close','Hide for today','data-act="card-snooze" data-id="'+esc(id)+'"')+'</div></section>';
}
function renderTopCards(max){const ctx=cardCtx();return topCards(max).map(({id})=>cardFrame(id,ctx)).join('');}
ACT['card-snooze']=el=>{
 const id=el.getAttribute('data-id'),key='cardSnooze:'+todayKey();
 if(!CARDS[id])return;
 const ids=store.get(key)||[];
 if(!ids.includes(id))store.set(key,ids.concat(id));
 render();
};
