export function StudyVisual({ visual }: { visual: any }) {
  if (!visual) return null;
  if (visual.kind === 'image') return <figure><img src={visual.url} alt={visual.alt} style={{maxWidth:'100%',borderRadius:16}}/><figcaption>AI-generated study illustration. Check labels against your course material.</figcaption><a href={visual.url} download>Download image</a></figure>;
  const nodes = visual.nodes || [];
  const position = (index:number) => ({ x: 155 + (index % 2) * 320, y: 65 + Math.floor(index / 2) * 150 });
  return <figure><svg viewBox={`0 0 640 ${Math.ceil(nodes.length/2)*150}`} role="img" aria-label="Study diagram" style={{width:'100%',minWidth:280}}>
    <defs><marker id="study-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>
    {(visual.edges || []).map((edge:any,index:number)=>{const from=position(nodes.findIndex((n:any)=>n.id===edge.from)),to=position(nodes.findIndex((n:any)=>n.id===edge.to));return <g key={index}><line x1={from.x} y1={from.y+26} x2={to.x} y2={to.y-26} stroke="currentColor" opacity=".55" markerEnd="url(#study-arrow)"/><text x={(from.x+to.x)/2} y={(from.y+to.y)/2-8} textAnchor="middle" fill="currentColor" fontSize="11">{edge.label}</text></g>})}
    {nodes.map((node:any,index:number)=>{const p=position(index);const words=node.label.split(' ');const lines:string[]=[];for(const word of words){if(!lines.length || lines[lines.length-1].length+word.length>24)lines.push(word);else lines[lines.length-1]+=' '+word;}return <g key={node.id}><rect x={p.x-140} y={p.y-30} width={280} height={Math.max(60,lines.length*18+16)} rx="14" fill="var(--background, #111827)" stroke="var(--primary)"/><text x={p.x} y={p.y-((lines.length-1)*8)} textAnchor="middle" fill="currentColor" fontSize="13">{lines.map((line,i)=><tspan key={i} x={p.x} dy={i?18:0}>{line}</tspan>)}</text></g>})}
  </svg><figcaption>{(visual.edges||[]).map((e:any)=>`${nodes.find((n:any)=>n.id===e.from)?.label} → ${nodes.find((n:any)=>n.id===e.to)?.label}${e.label?': '+e.label:''}`).join('; ')}</figcaption></figure>;
}
