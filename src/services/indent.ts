export function indentSelection(text:string,start:number,end:number,outdent=false){
 if(start===end&&!outdent)return {text:text.slice(0,start)+'  '+text.slice(end),start:start+2,end:start+2}
 const from=start===0?0:text.lastIndexOf('\n',start-1)+1,through=end>start&&text[end-1]==='\n'?end-1:end,to=text.indexOf('\n',through),limit=to<0?text.length:to
 const lines=text.slice(from,limit).split('\n'),deltas:number[]=[]
 const changed=lines.map(line=>{const count=outdent?(line.match(/^(?: {1,2}|\t)/)?.[0].length||0):0;deltas.push(outdent?-count:2);return outdent?line.slice(count):'  '+line}).join('\n')
 return {text:text.slice(0,from)+changed+text.slice(limit),start:Math.max(from,start+(deltas[0]||0)),end:Math.max(from,end+deltas.reduce((a,b)=>a+b,0))}
}
