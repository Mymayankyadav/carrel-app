'use strict';
const assert=require('node:assert/strict');
const {parse}=require('../logic/parse.js');
const now=new Date(2026,9,28,9,15);
const acts=[{id:'math',name:'Mathematics'},{id:'phy',name:'Physics'},{id:'chem',name:'Chemistry'},{id:'bio',name:'Biology'}];
const P=(s,other={})=>parse(s,{now,acts,...other});
const check=(s,fields,opts)=>{const actual=P(s,opts);for(const [k,value] of Object.entries(fields))assert.deepEqual(actual[k],value,s+' · '+k);};
// Real-world examples from §D11.
check('physics ch7 2h by fri !',{type:'task',title:'Ch7',activity:'phy',minutes:120,date:'2026-10-30',prio:1,by:true});
check('maths test 12 nov 9am',{type:'deadline',activity:'math',date:'2026-11-12',time:'09:00',kind:'exam'});
check('chem revise in 3 days 45m',{type:'task',title:'Revise',activity:'chem',minutes:45,date:'2026-10-31'});
check('read paper tmr 14:30 1h',{type:'block',title:'Read paper',minutes:60,date:'2026-10-29',time:'14:30'});
check('!! essay due 3/11',{type:'deadline',title:'Essay',prio:1,date:'2026-11-03',kind:'due'});
check('bio',{type:'task',title:'Biology',activity:'bio'});
check('',{type:'task',title:'',activity:null,date:null});
check('12 jan',{date:'2027-01-12'});
check('today 25m',{date:'2026-10-28',minutes:25});
check('1h30 optics',{title:'Optics',minutes:90});
// Duration normalization.
check('1h 30m optics',{minutes:90});
check('1.5h optics',{minutes:90});
check('2 hours reading',{minutes:120});
check('2hrs reading',{minutes:120});
check('90min reading',{minutes:90});
check('45 minutes reading',{minutes:45});
check('0.5h maths',{minutes:30,activity:'math'});
check('read 1h30',{minutes:90,title:'Read'});
// Calendar details.
check('tomorrow',{date:'2026-10-29'});
check('tmrw',{date:'2026-10-29'});
check('tod',{date:'2026-10-28'});
check('in 2 weeks',{date:'2026-11-11'});
check('in 1 day',{date:'2026-10-29'});
check('fri',{date:'2026-10-30'});
check('wednesday 8am',{date:'2026-11-04',time:'08:00'});
check('wednesday 10am',{date:'2026-10-28',time:'10:00'});
check('30 oct',{date:'2026-10-30'});
check('nov 12',{date:'2026-11-12'});
check('31/12',{date:'2026-12-31'});
check('1/1',{date:'2027-01-01'});
check('31 feb',{date:null,invalidDate:true});
check('31/02',{date:null,invalidDate:true});
check('feb 31',{date:null,invalidDate:true});
check('due by monday',{date:'2026-11-02',kind:'due',type:'deadline'});

// Explicit ISO dates must not be misread as a yearless MM-DD suffix.
check('essay due 2026-11-12',{type:'deadline',title:'Essay',date:'2026-11-12',invalidDate:false});
check('essay due 2026-01-02',{date:'2026-01-02',invalidDate:false});
check('read 2026-10-30 9am',{date:'2026-10-30',time:'09:00',title:'Read'});
check('essay due 2024-02-29',{date:'2024-02-29',invalidDate:false});
check('essay due 2025-02-29',{date:null,invalidDate:true});
check('essay due 2026-02-31',{date:null,invalidDate:true});
check('essay due 2026-13-10',{date:null,invalidDate:true});
check('essay due 31/02',{date:null,invalidDate:false});

// Yearless leap-day dates resolve to the next *valid* occurrence.
check('29 feb',{date:'2028-02-29'});
check('feb 29 9am',{date:'2028-02-29',time:'09:00'});
check('29/02',{date:'2028-02-29'});
check('29 feb',{date:'2028-02-29'},{now:new Date(2024,2,1,10,0)});
check('29 feb',{date:'2024-02-29'},{now:new Date(2024,1,29,10,0)});
check('29 feb 11am',{date:'2024-02-29',time:'11:00'},{now:new Date(2024,1,29,10,0)});
check('29 feb 9am',{date:'2028-02-29',time:'09:00'},{now:new Date(2024,1,29,10,0)});
check('29 feb',{date:'2104-02-29'},{now:new Date(2097,0,1,10,0)});
check('31 apr',{date:null});
// Time normalization.
check('meeting today 12am',{time:'00:00'});
check('meeting today 12pm',{time:'12:00'});
check('meeting today 7:05pm',{time:'19:05'});
check('meeting today 23:45',{time:'23:45'});
check('meet tomorrow 08:30 30m',{type:'block',date:'2026-10-29',time:'08:30',minutes:30});
// Subject identification and unknown words.
check('maths chapter 4',{activity:'math',title:'Chapter 4'});
check('math chapter 4',{activity:'math',title:'Chapter 4'});
check('phy chapter 4',{activity:'phy',title:'Chapter 4'});
check('chem chapter 5',{activity:'chem',title:'Chapter 5'});
check('biology chapter 5',{activity:'bio',title:'Chapter 5'});
check('unknown science topic',{activity:null,title:'Unknown science topic'});
check('biology notes',{activity:null,title:'Biology notes'},{acts:[]});
// Explicit classification, priorities, and deadline kinds.
check('write test', {type:'deadline',kind:'exam'});
check('submit paper',{type:'deadline',kind:'due'});
check('assignment 2',{type:'deadline',kind:'due'});
check('!! revise',{prio:1,title:'Revise'});
check('! revise',{prio:1});
check('revise',{prio:2});
check('maths test',{type:'task'},{type:'task'});
check('revise',{type:'ask'},{type:'ask'});
check('revise',{type:'block'},{type:'block'});
// No global date clock dependence: deterministic with the same now.
assert.deepEqual(P('next topic by fri'),P('next topic by fri'));
console.log('L9 PARSER TESTS PASSED');
