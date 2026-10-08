export function luminance(color:string){return [1,3,5].map(n=>parseInt(color.slice(n,n+2),16)/255).reduce((sum,v,i)=>sum+(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)*[.2126,.7152,.0722][i]!,0)}
export function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
export function readableText(background:string,requested:string){return /^#[0-9a-f]{6}$/i.test(requested)&&contrast(background,requested)>=4.5?requested:luminance(background)>.179?'#111111':'#ffffff'}
