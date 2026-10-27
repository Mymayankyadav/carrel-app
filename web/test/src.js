// Source layout shared by test harnesses after the R0a module split.
const fs=require('fs'),path=require('path');
const manifest=require('../files.json');
const rd=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
module.exports={
  app:manifest.js.filter(n=>!['config.js','supa.js','auth.js','boot.js','native.js'].includes(n)).map(rd).join('\n'),
  css:manifest.css.map(rd).join('\n')
};
