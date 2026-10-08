import MarkdownIt from 'markdown-it'
import { frontmatter } from './frontmatter'
export const toolbarItems=[{id:'headings',label:'标题'},{id:'bold',label:'加粗'},{id:'italic',label:'斜体'},{id:'strike',label:'删除线'},{id:'list',label:'无序列表'},{id:'ordered-list',label:'有序列表'},{id:'check',label:'任务列表'},{id:'quote',label:'引用'},{id:'code',label:'代码块'},{id:'inline-code',label:'行内代码'},{id:'link',label:'链接'},{id:'table',label:'表格'},{id:'undo',label:'撤销'},{id:'redo',label:'重做'}]
export const templates=[{id:'blank',name:'空白文档',text:''},{id:'journal',name:'日记',text:'# {{date}}\n\n## 今天的记录\n\n\n## 值得记住的事\n\n'},{id:'meeting',name:'会议记录',text:'# {{title}}\n\n日期：{{date}}\n\n## 议题\n\n## 讨论记录\n\n## 待办\n\n- [ ] '},{id:'project',name:'项目笔记',text:'# {{title}}\n\n## 目标\n\n## 进展\n\n## 下一步\n\n- [ ] '}].map(t=>({...t,text:t.text.replaceAll('\\n','\n')}))
export function templateText(text:string,title:string){return text.replaceAll('{{date}}',new Date().toLocaleDateString('sv-SE')).replaceAll('{{title}}',title.replace(/\.md$/i,''))}
export function tidy(text:string):string{
 const value=frontmatter(text);if(value.error)return text;if(value.prefix)return value.prefix+tidy(value.body)
 let fenced=false,fence='',out:string[]=[],blank=0
 for(const line of text.split('\n')){const match=/^\s*(`{3,}|~{3,})/.exec(line);if(match){if(!fenced){fenced=true;fence=match[1]![0]!}else if(match[1]![0]===fence)fenced=false;out.push(line);blank=0;continue}if(fenced){out.push(line);continue}const clean=line.replace(/[\t ]+$/g,m=>m.length>=2?'  ':'');if(!clean){blank++;if(blank<=2)out.push('');continue}blank=0;out.push(clean.replace(/^([ \t]*)[+*] /,'$1- '))}return out.join('\n')
}
export function fuzzy(query:string,value:string,sensitive=false){let i=0;const q=sensitive?query:query.toLowerCase(),v=sensitive?value:value.toLowerCase();for(const c of v)if(c===q[i])i++;return i===q.length}
const blockParser=new MarkdownIt({html:true})
export function moveParagraph(text:string,start:number,end:number,delta:number){
 const meta=frontmatter(text);if(meta.error||start<meta.prefix.length)return
 const lines=text.split('\n'),prefixLines=meta.prefix.split('\n').length-1,line=text.slice(0,start).split('\n').length-1,last=text.slice(0,end).split('\n').length-1
 const tokens=blockParser.parse(meta.body,{}),blocks=tokens.filter(t=>t.level===0&&t.block&&t.map&&t.nesting!==-1).map(t=>({start:t.map![0]+prefixLines,end:t.map![1]+prefixLines,type:t.type,level:Number(t.tag.slice(1))||0}))
 let index=blocks.findIndex(b=>line>=b.start&&line<b.end);if(index<0)return;const current=blocks[index]!
 let a=current.start,b=current.end,c=0,d=0
 const offset=(i:number)=>lines.slice(0,i).reduce((n,l)=>n+l.length+1,0)
 const swap=()=>{if(delta<0)return{text:[...lines.slice(0,c),...lines.slice(a,b),...lines.slice(d,a),...lines.slice(c,d),...lines.slice(b)].join('\n'),start:offset(c)};return{text:[...lines.slice(0,a),...lines.slice(c,d),...lines.slice(b,c),...lines.slice(a,b),...lines.slice(d)].join('\n'),start:offset(a)+lines.slice(c,d).concat(lines.slice(b,c)).reduce((n,l)=>n+l.length+1,0)}}
 if(current.type==='heading_open'){
  const boundaries=blocks.filter(x=>x.type==='heading_open'&&x.level<=current.level),at=boundaries.indexOf(current);b=boundaries[at+1]?.start||lines.length
  if(delta<0){const other=boundaries[at-1];if(!other||other.level!==current.level)return;c=other.start;d=a}
  else{const other=boundaries[at+1];if(!other||other.level!==current.level)return;c=other.start;d=boundaries[at+2]?.start||lines.length}return swap()
 }
 const item=tokens.filter(t=>t.type==='list_item_open'&&t.map&&line>=t.map[0]+prefixLines&&line<t.map[1]+prefixLines).at(-1)
 if(item&&last===line){const items=tokens.filter(t=>t.type==='list_item_open'&&t.level===item.level&&t.map&&t.map[0]+prefixLines>=current.start&&t.map[1]+prefixLines<=current.end),at=items.indexOf(item),other=items[at+delta];if(!other?.map)return;a=item.map![0]+prefixLines;b=item.map![1]+prefixLines;c=other.map[0]+prefixLines;d=other.map[1]+prefixLines;return swap()}
 const lastBlock=blocks.findIndex(x=>last>=x.start&&last<x.end);if(lastBlock>=index)b=blocks[lastBlock]!.end
 const neighbor=blocks[delta<0?index-1:(lastBlock>=index?lastBlock:index)+1];if(!neighbor)return;c=neighbor.start;d=neighbor.end;return swap()
}
