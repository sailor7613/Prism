// Pull every inline <script> block out of index.html and node --check each.
const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m,i=0,bad=0;
fs.rmSync('/tmp/blocks',{recursive:true,force:true});
fs.mkdirSync('/tmp/blocks',{recursive:true});
while((m=re.exec(src))){
  const attrs=m[1]||'';
  if(/\bsrc\s*=/.test(attrs)) continue;
  if(/type\s*=\s*["'](?!text\/javascript|application\/javascript)/.test(attrs)) continue;
  i++;
  const start=src.slice(0,m.index).split('\n').length;
  fs.writeFileSync(`/tmp/blocks/block${i}.js`,m[2]);
  console.log(`block ${i}: line ${start}, ${m[2].length} bytes`);
}
console.log('TOTAL BLOCKS',i);
