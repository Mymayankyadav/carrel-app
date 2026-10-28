/* G2 — Settings subpages. Existing settings keys and actions remain authoritative. */
function g2Nudge(key,value,step,min,max,fmt){
  const output = typeof fmt==='function'?fmt(value):String(value);
  const attrs=(delta,label)=>'data-act="g2-nudge" data-key="'+esc(key)+'" data-d="'+delta+'" aria-label="'+label+'" title="'+label+'"';
  return '<div class="g2-nudge">'+
    '<button type="button" '+attrs(-step,'Decrease')+'>'+icon('minus')+'</button>'+
    '<span class="g2-value">'+esc(output)+'</span>'+
    '<button type="button" '+attrs(step,'Increase')+'>'+icon('add')+'</button></div>';
}
function g2Time(key,value,label){
  return kField(label,'<input type="time" class="k-input" data-change="set-time" data-f="'+esc(key)+'" aria-label="'+esc(label)+'" value="'+esc(value||'')+'">');
}
function g2RadioRows(options,chosen,act){
  return options.map(o=>kRow({label:o.label,right:o.value===chosen?icon('check'):'',
    attrs:'data-act="'+act+'" data-v="'+esc(o.value)+'" aria-pressed="'+(o.value===chosen)+'"'})).join('');
}
function g2Timer(){
  const pd=CFG.pomodoro||PRESETS['25/5'], selected=presetLabel(pd);
  const custom=!!UI.g2Custom;
  const presets=[{value:'25/5',label:'25/5'},{value:'50/10',label:'50/10'},{value:'90/20',label:'90/20'},{value:'custom',label:'Custom'}];
  const presetRows=g2RadioRows(presets,custom?'custom':selected,'g2-preset');
  const fields=custom?'<div class="g2-nudge-fields">'+[
    ['focus',pd.focus,1,1,180,'Focus','m'],
    ['short',pd.short,1,1,60,'Short break','m'],
    ['long',pd.long,1,1,90,'Long break','m'],
    ['every',pd.every,1,2,8,'Long break every','']
  ].map(([k,v,step,min,max,l,suffix])=>kField(l,g2Nudge('pomo.'+k,v,step,min,max,x=>x+suffix))).join('')+'</div>':'';
  return '<div class="g2-page">'+kField('Pomodoro by default',kSwitch({act:'g2-pomo',on:!!UI.pomoOn,label:'Pomodoro by default'}))+
    '<details class="g2-details"><summary class="g2-summary">Length<span>'+esc(selected)+icon('expand')+'</span></summary>'+presetRows+fields+'</details>'+
    kField('Ask if running longer than',g2Nudge('guardHours',CFG.guardHours,1,1,12,x=>x+'h'))+'</div>';
}
function g2Day(){
  return '<div class="g2-page">'+
    g2Time('dayStart',CFG.dayStart,'Day starts at')+
    g2Time('planStart',CFG.planStart,'Plans start at')+
    g2Time('planEnd',CFG.planEnd,'Plans end by')+
    kField('Gap between blocks',g2Nudge('gap',CFG.gap,5,0,60,x=>x+'m'))+
    kField('Daily goal',g2Nudge('dailyGoal',CFG.dailyGoal,30,0,960,x=>x===0?'—':(x/60)+'h'))+
    kField('Minimum streak day',g2Nudge('minDay',CFG.minDay||25,5,5,120,x=>x+'m'))+
    '<details class="g2-details"><summary class="g2-summary">Week starts on<span>'+
      esc(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][+CFG.weekStart||0])+icon('expand')+
      '</span></summary>'+g2RadioRows(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((n,i)=>({label:n,value:String(i)})),String(+CFG.weekStart||0),'g2-week')+'</details>'+
    kField('Clock',kSeg({act:'g2-clock',value:String(CFG.clock||'auto'),options:[{v:'auto',label:'Auto'},{v:'12',label:'12h'},{v:'24',label:'24h'}]}))+'</div>';
}
function g2Calendar(){
  if(!S.mcp) return '<div class="g2-page">'+kEmpty('Not available here')+'</div>';
  const connected=GC.status==='ok'||GC.status==='stale';
  const count=GC.events.filter(x=>x.allDay?x.to>todayKey():x.e>Date.now()).length;
  const rows=kRow({label:'Status',value:connected?'Connected':'Not connected'})+
    kRow({label:'Events',value:count+' upcoming'})+
    kRow({label:'Permissions',open:true,attrs:'data-act="gc-perms"'});
  return '<div class="g2-page">'+rows+
    (!connected?kRow({label:'Connect',icon:'add',attrs:'data-act="gc-connect"' }):'')+'</div>';
}
/* L10: copy-only, chat-initiated prompts. No model API is called by Carrel. */
const l10Prompts=[
  ['Plan my day','Use the Supabase connector for Carrel. Read meta/guide in public.docs, then plan my day: read week_summary and topics_due and write one coach plan proposal for today.'],
  ['Plan my week','Use the Supabase connector for Carrel. Read meta/guide in public.docs, then plan my week: inspect week_summary, current plans, and deadlines, and write one coach plan proposal for a suitable day.'],
  ['Weekly review','Use the Supabase connector for Carrel. Read meta/guide in public.docs, then write my weekly review as one coach review. Use actual study and planned data; do not invent results.'],
  ['Exam plan','Use the Supabase connector for Carrel. Read meta/guide in public.docs, then make an exam plan for the subject I specify. Inspect topics_due, deadlines and existing activities; write one coach proposal after checking the subject ID.']
];
function g2Claude(){
  return '<div class="g2-page g2-prompts">'+l10Prompts.map(([label,prompt])=>
    '<div class="g2-prompt"><span>'+esc(label)+'</span>'+
    kIconBtn('copy','Copy '+label+' prompt','data-act="copy" data-text="'+esc(prompt)+'"')+
    '</div>').join('')+
    '<div class="s2-muted">Open a Claude chat and paste a prompt. Carrel never sends data to an LLM API.</div></div>';
}

function g2Data(){
  if(!S.dl)return '<div class="g2-page">'+kEmpty('Export not available here')+'</div>';
  return '<div class="g2-page">'+
    kRow({label:'Entries',value:String(ENTRIES.filter(e=>!e.running).length)})+
    kRow({label:'CSV',icon:'export',attrs:'data-act="export" data-f="csv"'})+
    kRow({label:'JSON backup',icon:'export',attrs:'data-act="export" data-f="json"'})+'</div>';
}
function g2Account(){
  const legacy = store.get('pending');
  const recover = S.uid && Array.isArray(legacy) && legacy.length ?
    kRow({label:'Older unsaved edits',value:legacy.length+' waiting',icon:'refresh',open:true,
      attrs:'data-act="a1-recover-legacy-pending"'}) : '';
  return '<div class="g2-page">'+
    kRow({label:'Signed in as',value:S.user&&S.user.email?S.user.email:'—'})+
    recover+
    '<div class="g2-danger-row">'+kRow({label:'Sign out',icon:'log-out',attrs:'data-act="signout"'})+'</div></div>';
}
function g2About(){
  const web=UPDI.bundle||'built in',apk=UPDI.build||'—';
  const ready=!!store.get('updReady');
  const status=UPDI.busy?'Downloading':ready?'Update ready':(UPDI.web||'Check now');
  return '<div class="g2-page">'+
    kRow({label:'Version',value:'web '+web+' · app '+apk})+
    kRow({label:ready&&ACT['upd-restart']?'Restart':'Check for updates',icon:'refresh',
      value:status,attrs:'data-act="'+(ready&&ACT['upd-restart']?'upd-restart':'upd-check')+'"'} )+
    (UPDI.apk?kRow({label:'New app version',icon:'download',attrs:'data-act="upd-apk"'}):'')+'</div>';
}
function g2Keys(){
  const keys=[['1–9','Start an activity'],['S','Stop timer'],['B','Break or resume'],['R','Resume last'],['M','Toggle Pomodoro'],['D','Focus mode'],['N','New entry'],['← →','Page Plan or Stats'],['T','Today'],['C','Plan'],['W','Stats'],['P','Patterns'],['Ctrl Z','Undo']];
  return '<div class="g2-page">'+keys.map(([key,desc])=>'<div class="g2-key-row"><kbd>'+esc(key)+'</kbd><span>'+esc(desc)+'</span></div>').join('')+'</div>';
}
PAGES['settings.timer']={title:'Timer',render:g2Timer};
PAGES['settings.day']={title:'Day',render:g2Day};
PAGES['settings.calendar']={title:'Google Calendar',render:g2Calendar,
  actions:()=>kIconBtn('refresh','Refresh','data-act="gc-refresh"')};
PAGES['settings.claude']={title:'Claude prompts',render:g2Claude};
PAGES['settings.data']={title:'Export',render:g2Data};
PAGES['settings.account']={title:'Account',render:g2Account};
PAGES['settings.about']={title:'About',render:g2About};
PAGES['settings.keys']={title:'Keyboard',render:g2Keys};

Object.assign(ACT,{
  'g2-pomo'(){ACT['pomo-toggle']();},
  'g2-preset'(el){
    const p=el.getAttribute('data-v');
    if(p==='custom'){UI.g2Custom=true;render();return;}
    if(!PRESETS[p])return;
    UI.g2Custom=false;
    saveSetting({pomodoro:Object.assign({},PRESETS[p])});
  },
  'g2-nudge'(el){
    const k=el.getAttribute('data-key'),d=+el.getAttribute('data-d');
    const spec={guardHours:[1,12],gap:[0,60],dailyGoal:[0,960],minDay:[5,120],
      'pomo.focus':[1,180],'pomo.short':[1,60],'pomo.long':[1,90],'pomo.every':[2,8]};
    if(!spec[k]||!Number.isFinite(d))return;
    const n=k.startsWith('pomo.')?+CFG.pomodoro[k.slice(5)]:
      k==='minDay'?(+CFG.minDay||25):+CFG[k];
    const val=Math.max(spec[k][0],Math.min(spec[k][1],n+d));
    if(!Number.isFinite(val)||val===n)return;
    if(k.startsWith('pomo.'))saveSetting({pomodoro:{[k.slice(5)]:val}});
    else saveSetting({[k]:val});
  },
  'g2-week'(el){const v=+el.getAttribute('data-v');if(Number.isInteger(v)&&v>=0&&v<=6)saveSetting({weekStart:v});},
  'g2-clock'(el){const v=el.getAttribute('data-v');if(['auto','12','24'].includes(v))saveSetting({clock:v});}
});
