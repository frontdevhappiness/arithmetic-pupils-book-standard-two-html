import assert from 'node:assert/strict';
import fs from 'node:fs';
const root='content/i18n/en-GB/';
const texts=JSON.parse(fs.readFileSync(root+'texts.json','utf8'));
const audios=JSON.parse(fs.readFileSync(root+'audios.json','utf8'));
const timing=JSON.parse(fs.readFileSync(root+'timecode/timecode_output.json','utf8'));
const source=fs.readFileSync('assets/offline-data.js','utf8');
const start=source.indexOf('  var INLINE = ')+'  var INLINE = '.length;
const offline=JSON.parse(source.slice(start,source.indexOf(';\n  var BASE_DIR',start)));
const digits=['zero','one','two','three','four','five','six','seven','eight','nine'];
const counts={24:[[3,2,5],[2,3,4],[4,3,0]],25:[[2,2,5],[2,5,4],[5,3,4],[9,9,9],[3,0,4],[1,0,9]],31:[[0,2,5],[2,2,5],[0,3,3],[4,0,4],[1,3,3],[3,7,5]]};
const ids=[];
for(const [page,rows] of Object.entries(counts)) rows.forEach((row,index)=>{
 const id=`pg${page.padStart(3,'0')}_im${String(index+1).padStart(3,'0')}`;ids.push(id);
 const sentences=texts[id].split('.').filter(Boolean);
 row.forEach((count,column)=>{
  const noun=page==='24'?'cup':'cap';
  assert.ok(sentences[column].includes(['hundreds','tens','ones'][column]));
  assert.ok(sentences[column].includes(count?`${digits[count]} ${['green','blue','red'][column]} ${noun}${count===1?'':'s'}`:`no ${noun}s`));
 });
});
const numberNames={224:'two hundred and twenty-four',185:'one hundred and eighty-five',402:'four hundred and two',306:'three hundred and six',247:'two hundred and forty-seven',87:'eighty-seven',93:'ninety-three',210:'two hundred and ten',179:'one hundred and seventy-nine',500:'five hundred'};
for(const [page,offset,values] of [[26,2,[224,185,402,306]],[27,1,[247,87,93,210,179,500]]]) values.forEach((number,index)=>{
 const id=`pg0${page}_im${String(index+offset).padStart(3,'0')}`;ids.push(id);
 assert.ok(texts[id].startsWith(`The number shown is ${numberNames[number]}.`));
 assert.ok(texts[id].includes(`From left to right, its digits are ${String(number).split('').map(d=>digits[Number(d)]).join(', ')}.`));
 assert.equal(audios[id],id+'_full_alloy.mp3');
 assert.ok(texts[id].includes('blank space for its place value'));
});
for(const id of ids){
 const page=id.slice(0,5)+'_sec001.html';const html=fs.readFileSync(page,'utf8');
 assert.ok(html.includes(`alt="${texts[id]}"`));
 assert.equal(offline['./'+page],html);
 assert.equal(offline['./'+root+'texts.json'][id],texts[id]);
 assert.equal(offline['./'+root+'audios.json'][id],audios[id]);
 assert.deepEqual(offline['./'+root+'timecode/timecode_output.json'][id],timing[id]);
 assert.ok(fs.statSync(root+'audio/'+audios[id]).size>1000);
 const words=timing[id].timecodes[1].word_timestamps;
 assert.deepEqual(words.map(w=>w.text),texts[id].match(/[\p{L}\p{N}]+/gu));
 words.forEach((w,i)=>{assert.ok(w.end>=w.start);if(i)assert.ok(w.start>=words[i-1].end);});
}
console.log('All 25 picture descriptions provide the printed counts or digits with matching audio and offline content.');
