/* F1: additive Labs flags with defaults. */
const LABS={};
function lab(name){
 const v=CFG.labs&&CFG.labs[name];
 return v==null?!!(LABS[name]&&LABS[name].def):!!v;
}
PAGES['settings.labs']={title:'Labs',render(){
 const names=Object.keys(LABS);
 if(!names.length)return kEmpty('No experimental features yet');
 return kGroup('Experimental',names.map(name=>kRow({
   label:LABS[name].label||name,
   right:kSwitch({act:'f1-lab-toggle',on:lab(name),label:LABS[name].label||name})
     .replace('data-act="f1-lab-toggle"','data-act="f1-lab-toggle" data-lab="'+esc(name)+'"')
 })).join(''));
}};
ACT['f1-lab-toggle']=el=>{
 const name=el.getAttribute('data-lab');
 if(!Object.prototype.hasOwnProperty.call(LABS,name))return;
 saveSetting({labs:{[name]:el.getAttribute('data-v')==='true'}});
};
