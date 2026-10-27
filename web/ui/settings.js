/* G1 — Settings home screen (no legacy Setup sheet). */
function g1Settings() {
  const studies=ACTS.filter(a=>a.kind==='study'&&!a.archived).length;
  const timer=CFG.pomodoro?CFG.pomodoro.focus+'/'+CFG.pomodoro.short:'25/5';
  const calendar=(typeof GC!=='undefined'&&['ok','stale'].includes(GC.status))?'Connected':'Not connected';
  const account=S.user&&S.user.email?S.user.email:'';
  const updater=typeof UPDI!=='undefined'?UPDI:null;
  const updated=updater&&(updater.apk||store.get('updReady'));
  const link=(id,label,iconName,value)=>kRow({label,icon:iconName,value,open:true,
    attrs:'data-act="g1-page" data-page="'+id+'"'});
  const first=link('settings.activities','Activities','activity',studies+' study')+
    link('settings.timer','Timer','pomodoro',timer)+
    link('settings.day','Day','sun',fmtHM(CFG.dayStart))+
    (typeof NATIVE!=='undefined'&&NATIVE?link('settings.notifications','Notifications','bell',NP.notifications===false?'Off':'On'):'');
  const second=link('settings.calendar','Google Calendar','calendar',calendar)+
    link('settings.claude','Claude prompts','sparkles')+
    link('settings.data','Export','download');
  const third=link('settings.account','Account','user',account)+
    kRow({label:'About',icon:'info',right:'<span class="g1-about-value">'+esc(updater&&updater.bundle||'')+(updated?'<i class="g1-update-dot"></i>':'')+icon('open')+'</span>',
      attrs:'data-act="g1-page" data-page="settings.about"'})+
    (typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(pointer:fine)').matches?
      link('settings.keys','Keyboard','keyboard'):'');
  return '<div class="g1-root"><header class="k-head"><h1 class="k-h1">Settings</h1></header>'+
    '<div class="g1-section">'+first+'</div><div class="g1-section">'+second+'</div><div class="g1-section">'+third+'</div></div>';
}
VIEWS.settings=g1Settings;
Object.assign(ACT,{
  'g1-page'(el){
    const id=el.getAttribute('data-page');
    if(id && PAGES[id])pushPage(id);
  }
});
