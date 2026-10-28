/* L10 — optional, validated Claude inbox. All actions remain inside Carrel's
 * existing offline queue; there is no LLM API client or background chat. */
const l10Kinds=new Set(['note','plan','review','ask']);
const l10States=new Set(['new','seen','accepted','dismissed']);
function l10DateValue(k) {
  if(typeof k!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(k))return null;
  const n=Date.parse(k+'T12:00:00Z');
  return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===k?n:null;
}
/* A proposal must be valid for the current real session at accept time too. */
function l10ValidProposal(raw,nowKey,activities){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const date=l10DateValue(raw.date),today=l10DateValue(nowKey);
  if(date==null||today==null||date-today< -86400000||date-today>14*86400000)return null;
  if(!Array.isArray(raw.blocks)||raw.blocks.length===0||raw.blocks.length>12)return null;
  const blocks=[];
  for(const b of raw.blocks){
    if(!b||typeof b!=='object'||Array.isArray(b))return null;
    if(typeof b.activity!=='string'||!Object.prototype.hasOwnProperty.call(activities||{},b.activity))return null;
    const a=activities[b.activity];
    if(!a||a.archived||a.kind!=='study')return null;
    if(typeof b.title!=='string'||!b.title.trim()||b.title.length>120)return null;
    if(!Number.isInteger(b.minutes)||b.minutes<5||b.minutes>240)return null;
    if(b.at!=null&&(typeof b.at!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.at)))return null;
    blocks.push({activity:b.activity,title:b.title.trim(),minutes:b.minutes,at:b.at||null});
  }
  return {date:raw.date,blocks};
}
function l10ValidCoach(id,raw){
  if(typeof id!=='string'||!/^[A-Za-z0-9_.:@+~-]{1,100}$/.test(id)||
     !raw||typeof raw!=='object'||Array.isArray(raw)||raw.v!==1||
     !l10Kinds.has(raw.kind)||!['claude','me'].includes(raw.from)||
     !l10States.has(raw.status)||typeof raw.title!=='string'||
     !raw.title.trim()||raw.title.length>120||typeof raw.body!=='string'||
     raw.body.length>5000||typeof raw.at!=='string'||raw.at.length>48||
     !Number.isFinite(Date.parse(raw.at)))return null;
  return {id,kind:raw.kind,from:raw.from,title:raw.title.trim(),body:raw.body,
    at:raw.at,status:raw.status,proposal:raw.kind==='plan'?raw.proposal:null};
}
function l10CoachItems(){
  const docs=typeof V!=='undefined'&&V.coach||{};
  return Object.entries(docs).map(([id,doc])=>l10ValidCoach(id,doc))
    .filter(item=>item&&item.from==='claude')
    .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}
function l10PlanFor(item){
  return item&&item.kind==='plan'?
    l10ValidProposal(item.proposal,todayKey(),ACTMAP):null;
}
function l10CoachBody(item){
  let html='<div class="l10-coach-content"><strong>'+esc(item.title)+'</strong>'+
    (item.body?'<p>'+esc(item.body)+'</p>':'')+'</div>';
  const plan=l10PlanFor(item);
  if(plan){
    html+='<div class="l10-proposal"><div class="l10-coach-caption">Proposed for '+
      esc(shortDay(plan.date))+'</div>'+
      plan.blocks.map(b=>kRow({dot:ACTMAP[b.activity].color,label:b.title,
        sub:act(b.activity).name,value:fmtDur(b.minutes*MIN)+(b.at?' · '+b.at:'')})).join('')+
      '</div>';
  }else if(item.kind==='plan'){
    html+='<div class="l10-coach-caption">This plan cannot be accepted. Check its date or subjects.</div>';
  }
  return html;
}
function l10CoachSheet(sh){
  const item=l10CoachItems().find(x=>x.id===sh.id);
  if(!item)return kSheetHead('From Claude')+'<div class="k-sheet-body">'+
    kEmpty('This message is no longer available.')+'</div>';
  const plan=l10PlanFor(item);
  const actions=kBtn('Dismiss','data-act="l10-dismiss"',{kind:'text'})+
    (item.status==='new'&&plan?kBtn('Accept plan','data-act="l10-accept"',{kind:'primary'}):'');
  return kSheetHead('From Claude')+'<div class="k-sheet-body l10-coach-sheet">'+
    l10CoachBody(item)+'</div>'+kSheetFoot(actions);
}
SHEETS.coach=l10CoachSheet;
function l10FromClaude(){
  const recent=l10CoachItems().slice(0,5);
  if(!recent.length)return '';
  return kGroup('From Claude',recent.map(item=>
    kRow({label:item.title,sub:item.kind+' · '+item.status,
      open:true,attrs:'data-act="l10-open" data-id="'+esc(item.id)+'"'})).join(''));
}
CARDS.coach={
  rank(){
    return l10CoachItems().some(x=>x.status==='new')?78:0;
  },
  render(){
    const item=l10CoachItems().find(x=>x.status==='new');
    return item?'<button type="button" class="l10-coach-card" data-act="l10-open" data-id="'+
      esc(item.id)+'"><span><strong>'+esc(item.title)+'</strong>'+
      (item.body?'<small>'+esc(item.body.slice(0,120))+'</small>':'')+
      '</span>'+icon('open')+'</button>':'';
  }
};
Object.assign(ACT,{
  'l10-open'(el){
    const id=el&&el.getAttribute('data-id');
    if(l10CoachItems().some(item=>item.id===id))openSheet({type:'coach',id});
  },
  'l10-dismiss'(){
    const sh=UI.sheet,item=sh&&l10CoachItems().find(x=>x.id===sh.id);
    if(!item||!canWrite())return;
    closeSheet(true);
    commit('Dismissed Claude suggestion.',W().update('coach/'+item.id,{status:'dismissed'}),{undo:true});
  },
  'l10-accept'(){
    const sh=UI.sheet,item=sh&&l10CoachItems().find(x=>x.id===sh.id);
    const proposal=l10PlanFor(item);
    if(!item||item.status!=='new'||!proposal||!canWrite())return;
    const w=W(),date=proposal.date,start=nextOrder(date);
    const blocks={};
    for(let i=0;i<proposal.blocks.length;i++){
      const b=proposal.blocks[i];
      blocks[uid('b')]=blockDoc({activity:b.activity,title:b.title,
        minutes:b.minutes,at:b.at,order:start+i,from:'claude'});
    }
    w.plan(date,{blocks});
    w.update('coach/'+item.id,{status:'accepted'});
    closeSheet(true);
    commit('Accepted study plan.',w,{undo:true});
  }
});
if(typeof module!=='undefined'&&module.exports)
  module.exports={l10ValidCoach,l10ValidProposal,l10DateValue};
