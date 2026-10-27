/* G1 — activity list and editor, fully backed by existing saveAct/addActivity. */
function g1ActivityName(a) {return a?a.name:'New activity';}
function g1ActRows(kind) {
  return ACTS.filter(a=>a.kind===kind&&!a.archived).map(a=>kRow({
    label:a.name,dot:a.color,open:true,
    value:kind==='study'&&a.goal?fmtDur(a.goal*MIN):'',
    attrs:'data-act="g1-open-activity" data-id="'+esc(a.id)+'"'
  })).join('');
}
function g1Activities() {
  const archived=ACTS.filter(a=>a.archived);
  return '<div class="g1-activities">'+
    kGroup('Study',g1ActRows('study')||kEmpty('No study activities'))+
    kGroup('Other',g1ActRows('life')||kEmpty('No other activities'))+
    (archived.length?'<details class="g1-archived"><summary>Archived ('+archived.length+')</summary>'+
      archived.map(a=>kRow({label:a.name,dot:a.color,open:true,attrs:'data-act="g1-open-activity" data-id="'+esc(a.id)+'"'})).join('')+
      '</details>':'')+'</div>';
}
function g1PageId(){
  const pages=UI.pages||[];
  return pages.length?pages[pages.length-1].params.id:null;
}
function g1SelectedAct() {const id=g1PageId();return id?ACTMAP[id]||null:null;}
function g1PinValue(a){return a.today==null?(a.kind==='study'||a.role==='break'):!!a.today;}
function g1Control(label,html){return kField(label,html);}
function g1ActivityEditor(){
  const a=g1SelectedAct();
  if(!a){
    return '<div class="g1-editor">'+
      '<label class="g1-name-label">Name<input class="k-input g1-name" data-change="g1-name" type="text" maxlength="40" '+
      'value="'+esc(UI.g1DraftName||'')+'" placeholder="Activity name" aria-label="Activity name" enterkeyhint="done" autocomplete="off" autofocus></label>'+
      g1Control('Type',kSeg({act:'g1-new-kind',value:UI.g1NewKind||'study',options:[{v:'study',label:'Study'},{v:'life',label:'Other'}]}))+
      '</div>';
  }
  const actions=kIconBtn('more','Activity options','data-act="g1-menu"');
  const goal=a.goal||0;
  const swatch=kSwatches({act:'g1-colour',color:a.color,palette:PALETTE});
  const pin=kSwitch({act:'g1-pin',on:g1PinValue(a),label:'On Today'});
  const roleList=a.kind!=='study'?kCollapse('g1-more',
      '<span>More</span>',
      g1Control('Role',kSeg({act:'g1-role',value:a.role||'',
        options:[{v:'',label:'None'},{v:'break',label:'Break'},{v:'sleep',label:'Sleep'},{v:'drift',label:'Drift'}]}))+
      g1Control('Ask after',g1Stepper('g1-guard',a.guard||4,x=>x+'h'))):'';
  return '<div class="g1-editor">'+
    '<label class="g1-name-label">Name<input class="k-input g1-name" data-change="g1-name" type="text" maxlength="40"'+
      ' value="'+esc(a.name)+'" aria-label="Activity name" enterkeyhint="done"></label>'+
    g1Control('Colour',swatch)+
    g1Control('Type',kSeg({act:'g1-kind',value:a.kind,options:[{v:'study',label:'Study'},{v:'life',label:'Other'}]}))+
    (a.kind==='study'?g1Control('Weekly goal',g1Stepper('g1-goal',goal,x=>x?fmtDur(x*MIN):'—')):'')+
    g1Control('On Today',pin)+roleList+
    '<div class="g1-options">'+actions+'</div></div>';
}
function g1Stepper(act,value,fmt){
  return '<div class="g1-stepper">'+
    kIconBtn('minus','Decrease','data-act="'+act+'" data-d="-1"')+
    '<span>'+esc(fmt(value))+'</span>'+
    kIconBtn('add','Increase','data-act="'+act+'" data-d="1"')+'</div>';
}
PAGES['settings.activities']={
  title:'Activities',
  render:g1Activities,
  actions:()=>kIconBtn('add','New activity','data-act="g1-new"')
};
PAGES['settings.activity']={
  title:()=>g1ActivityName(g1SelectedAct()),
  render:g1ActivityEditor
};
Object.assign(ACT,{
  'g1-new'(){
    UI.g1DraftName=''; UI.g1NewKind='study';
    pushPage('settings.activity',{id:null});
  },
  'g1-open-activity'(el){pushPage('settings.activity',{id:el.getAttribute('data-id')});},
  'g1-name'(el){
    const name=String(el.value||'').trim().replace(/\s+/g,' ').slice(0,40);
    if(!name){const a=g1SelectedAct();if(a)el.value=a.name;return;}
    const a=g1SelectedAct();
    if(a){if(name!==a.name)saveAct(a.id,{name});return;}
    const created=addActivity(name,UI.g1NewKind||'study');
    if(!created)return;
    const pages=UI.pages||[];
    if(pages.length)pages[pages.length-1].params.id=created.id;
    const w=W();w.update('config/activities',{items:{[created.id]:created.doc}},{items:{}});
    commit(null,w,{undo:false});
  },
  'g1-new-kind'(el){UI.g1NewKind=el.getAttribute('data-v')==='life'?'life':'study';render();},
  'g1-kind'(el){
    const a=g1SelectedAct(),kind=el.getAttribute('data-v');
    if(a&&['study','life'].includes(kind)&&kind!==a.kind)saveAct(a.id,{kind});
  },
  'g1-colour'(el){
    const a=g1SelectedAct(),colour=el.getAttribute('data-v');
    if(a&&PALETTE.includes(colour)&&a.color!==colour)saveAct(a.id,{color:colour});
  },
  'g1-pin'(){
    const a=g1SelectedAct();if(a)saveAct(a.id,{today:!g1PinValue(a)});
  },
  'g1-goal'(el){
    const a=g1SelectedAct();
    if(!a||a.kind!=='study')return;
    const v=Math.max(0,Math.min(80*60,(a.goal||0)+ +el.getAttribute('data-d')*30));
    if(v!==(a.goal||0))saveAct(a.id,{goal:v||null});
  },
  'g1-guard'(el){
    const a=g1SelectedAct();if(!a)return;
    const v=Math.max(1,Math.min(24,(a.guard||4)+ +el.getAttribute('data-d')));
    saveAct(a.id,{guard:v});
  },
  'g1-role'(el){
    const a=g1SelectedAct(),r=el.getAttribute('data-v');
    if(a&&a.kind!=='study'&&['','break','sleep','drift'].includes(r))saveAct(a.id,{role:r||null});
  },
  'g1-menu'(el){
    const a=g1SelectedAct();if(!a)return;
    openMenu(el,[
      {icon:'up',label:'Move up',act:'g1-up'},
      {icon:'down',label:'Move down',act:'g1-down'},
      {icon:a.archived?'undo':'archive',label:a.archived?'Restore':'Archive',act:'g1-archive',danger:!a.archived}
    ]);
  },
  'g1-up'(){const a=g1SelectedAct();if(a)ACT['act-move']({getAttribute:k=>k==='data-id'?a.id:k==='data-d'?'-1':null});},
  'g1-down'(){const a=g1SelectedAct();if(a)ACT['act-move']({getAttribute:k=>k==='data-id'?a.id:k==='data-d'?'1':null});},
  'g1-archive'(){const a=g1SelectedAct();if(a)saveAct(a.id,{archived:!a.archived});}
});
