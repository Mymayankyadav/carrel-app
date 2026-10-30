/* L9 — deterministic, device-only Quick Capture parser. No DOM or network. */
'use strict';
function l9Parse(text, opts) {
  opts = opts || {};
  const now = new Date(opts.now == null ? Date.now() : opts.now);
  const acts = Array.isArray(opts.acts) ? opts.acts : [];
  const selectedType = ['task','deadline','block','ask'].includes(opts.type) ? opts.type : null;
  let s = String(text == null ? '' : text).slice(0, 500).trim();
  const original = s, by = /\bby\s+(?=(?:today|tod|tomorrow|tmr|tmrw|(?:mon|tue|wed|thu|fri|sat|sun)\w*|\d|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)))/i.test(s);
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  const add = (d,n) => {const x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);x.setDate(x.getDate()+n);return x;};
  const valid = (y,m,d) => {const x=new Date(y,m-1,d,12);return x.getFullYear()===y && x.getMonth()===m-1 && x.getDate()===d ? x : null;};
  const remove = (a,b) => {s=s.slice(0,a)+' '+s.slice(b);};
  const prio = /!{1,2}/.test(s) ? 1 : 2;
  s=s.replace(/!{1,}/g,' ');

  // Extract a valid clock time without interpreting durations such as 1h30.
  let time = null, m;
  const clock=/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/ig;
  while ((m=clock.exec(s))) {
    const h=m[3] ? (+m[1]%12)+(m[3].toLowerCase()==='pm'?12:0) : +m[4];
    const min=m[3] ? +(m[2]||0) : +m[5];
    time=pad(h)+':'+pad(min);remove(m.index,m.index+m[0].length);break;
  }

  // Mixed hour/minute tokens: "1h30", "1h 30m", "1.5hr", "45mins".
  let minutes = null;
  const hours=/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)(?:\s*(\d{1,2})\s*(?:minutes?|mins?|m)?\b)?/i;
  m=hours.exec(s);
  if(m){
    minutes=Math.round(+m[1]*60 + +(m[2]||0));
    remove(m.index,m.index+m[0].length);
  }else{
    const mins=/\b(\d+)\s*(?:minutes?|mins?|m)\b/i;
    m=mins.exec(s);
    if(m){minutes=+m[1];remove(m.index,m.index+m[0].length);}
  }

  // Dates are interpreted in device-local calendar time; no UTC-date offset.
  let date=null, match=null, target=null;
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const namedMonths=months.map(x=>x+'(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?').join('|');
  const datePatterns=[
    /\b(?:in)\s+(\d{1,3})\s+(days?|weeks?)\b/i,
    /\b(tomorrow|tmrw|tmr|today|tod)\b/i,
    /\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i,
    /\b([0-3]?\d)\s*(?:\/|-)\s*([01]?\d)\b/i,
    /\b([0-3]?\d)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+([0-3]?\d)\b/i
  ];
  // Explicit ISO dates must not be mistaken for a yearless MM-DD tail.
  // Invalid ISO dates remain visible in the title and fail save validation.
  const isoMatch=/\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  let invalidDate=false;
  if(isoMatch){
    const candidate=valid(+isoMatch[1],+isoMatch[2],+isoMatch[3]);
    if(candidate){date=dayKey(candidate);remove(isoMatch.index,isoMatch.index+isoMatch[0].length);}
    else invalidDate=true;
  }
  if(!isoMatch)for (let i=0;i<datePatterns.length && !date;i++) {
    match=datePatterns[i].exec(s);
    if(!match)continue;
    if(i===0){const n=+match[1];if(n<=3650)target=add(now,n*(match[2].toLowerCase().startsWith('week')?7:1));}
    if(i===1)target=add(now,/^tom|^tmr/i.test(match[1])?1:0);
    if(i===2){
      const ix=['sun','mon','tue','wed','thu','fri','sat'].indexOf(match[1].slice(0,3).toLowerCase());
      let ahead=(ix-now.getDay()+7)%7;
      if(ahead===0 && time){
        const [h,min]=time.split(':').map(Number);
        if(h*60+min<=now.getHours()*60+now.getMinutes())ahead=7;
      }
      target=add(now,ahead);
    }
    if(i===3||i===4||i===5){
      const d=i===5?+match[2]:+match[1];
      const mon=i===3?+match[2]:months.indexOf((i===5?match[1]:match[2]).slice(0,3).toLowerCase())+1;
      // A yearless date means its next calendar occurrence. Leap days can
      // require skipping several years, including non-leap century years.
      const today=dayKey(now),nowClock=pad(now.getHours())+':'+pad(now.getMinutes());
      for(let year=now.getFullYear();year<=now.getFullYear()+8;year++){
        const candidate=valid(year,mon,d);
        if(!candidate)continue;
        const key=dayKey(candidate);
        if(key<today || (key===today && time && time<=nowClock))continue;
        target=candidate;
        break;
      }
    }
    if(target){date=dayKey(target);remove(match.index,match.index+match[0].length);}
    else if(i>=3)invalidDate=true; // Recognized but impossible calendar date: never silently save an undated task.
  }
  if(by)s=s.replace(/\bby\b/i,' ');

  // Recognize a subject only at the beginning. Unknown words stay in the title.
  let activity=null, subjectName='';
  const aliases={maths:['math','mathematics'],math:['mathematics','maths'],phy:['physics'],chem:['chemistry']};
  const head=s.trimStart();
  let best=null;
  for (const a of acts){
    if(!a||!a.id||!a.name)continue;
    const name=String(a.name).toLowerCase(),words=[name];
    for(const [alias,names] of Object.entries(aliases))if(names.some(n=>name===n||name.startsWith(n+' ')))words.push(alias);
    for(const word of words){
      const candidate=head.slice(0,word.length).toLowerCase();
      const exact=candidate===word && (head.length===word.length||!/[a-z]/i.test(head[word.length]));
      const prefix=word.length>=3 && candidate.length>=3 && (name.startsWith(candidate)||word===candidate) &&
        (head.length===word.length||!/[a-z]/i.test(head[word.length]));
      if((exact||prefix) && (!best||word.length>best.length))best={id:a.id,name:a.name,length:word.length};
    }
  }
  if(best){activity=best.id;subjectName=best.name;const lead=s.indexOf(head);remove(lead,lead+best.length);}
  // A leading prefix such as "phys" matches "Physics", but don't swallow text.
  if(!best){
    const first=/^\s*([A-Za-z]{3,})\b/.exec(s);
    if(first){
      const token=first[1].toLowerCase();
      const options=acts.filter(a=>a&&a.id&&a.name&&
        (String(a.name).toLowerCase().startsWith(token) || (aliases[token]||[]).some(n=>String(a.name).toLowerCase().startsWith(n))));
      if(options.length===1){activity=options[0].id;subjectName=options[0].name;remove(first.index,first.index+first[0].length);}
    }
  }

  let kind=null;
  const kinds=/\b(exam|test|quiz|midterm|final|assignment|submit|due)\b/i;
  m=kinds.exec(s);
  if(m){
    kind=/^(assignment|submit|due)$/i.test(m[1])?'due':'exam';
    remove(m.index,m.index+m[0].length);
  }
  let title=s.replace(/\s+/g,' ').trim().replace(/^[,;:.\-]+|[,;:.\-]+$/g,'').trim();
  if(!title)title=subjectName||'';
  if(title)title=title[0].toLocaleUpperCase()+title.slice(1);
  const type=selectedType||(kind?'deadline':time&&date&&minutes!=null?'block':'task');
  return {type,title,activity,minutes,date,time,prio,kind,by,raw:original,invalidDate};
}
if(typeof module!=='undefined'&&module.exports)module.exports={parse:l9Parse};
