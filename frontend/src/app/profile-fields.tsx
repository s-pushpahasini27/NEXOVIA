import {useEffect,useState} from 'react';

const groups:Record<string,string[]> = {
  'Core engineering':['Engineering Mathematics','Engineering Physics','Engineering Chemistry','Engineering Drawing','Basic Electrical Engineering','Engineering Mechanics','Environmental Studies','Professional Communication'],
  'CSE & IT':['Programming in C','C++','Java','Python','JavaScript','Data Structures','Algorithms','DBMS','Operating Systems','Computer Networks','Software Engineering','Web Development','Mobile App Development','Cloud Computing','Cybersecurity','System Design','Distributed Systems','DevOps','Git','Linux'],
  'AI, ML & Data':['Artificial Intelligence','Machine Learning','Deep Learning','Data Science','Statistics','Natural Language Processing','Computer Vision','Generative AI','LLMs','MLOps','Data Analytics','Big Data','Neural Networks','Robotics'],
  'ECE & Electrical':['Circuit Theory','Digital Electronics','Analog Electronics','Signals and Systems','VLSI','Embedded Systems','Microcontrollers','IoT','Communication Systems','Control Systems','Power Systems','Power Electronics','Electrical Machines','PCB Design'],
  'Mechanical & Aerospace':['Thermodynamics','Fluid Mechanics','Strength of Materials','Machine Design','Manufacturing','CAD','CAM','Automobile Engineering','Heat Transfer','Mechatronics','Finite Element Analysis','Aerodynamics'],
  'Civil & Architecture':['Structural Analysis','Surveying','Geotechnical Engineering','Transportation Engineering','Construction Management','Concrete Technology','Hydraulics','Building Information Modeling','AutoCAD Civil','Environmental Engineering'],
  'Other engineering':['Chemical Engineering','Biotechnology','Biomedical Engineering','Materials Science','Metallurgy','Agricultural Engineering','Industrial Engineering','Renewable Energy','3D Modeling','Project Management'],
};
const catalog = new Set(Object.values(groups).flat());
export const avatarUrl=(profile:any,id?:string)=>profile?.avatar_source && id ? `/api/profile-picture/${encodeURIComponent(id)}?v=${encodeURIComponent(profile.avatar_updated||'1')}` : '';
export function Avatar({profile,id,name,className='avatar'}:{profile?:any;id?:string;name?:string;className?:string}){
 const [failed,setFailed]=useState(false);
 const url=avatarUrl(profile,id);
 useEffect(()=>setFailed(false),[url]);
 const initials=(name||'N').split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();
 return <span className={className}>{url&&!failed?<img src={url} alt="" onError={()=>setFailed(true)}/>:initials}</span>;
}
export function SkillPicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const selected=value.split(',').map(s=>s.trim()).filter(Boolean);
 const [query,setQuery]=useState(''),[custom,setCustom]=useState(''),[showOther,setShowOther]=useState(false),[showCatalog,setShowCatalog]=useState(false);
 const set=(items:string[])=>{const next=items.join(', ');if(next.length<=1500)onChange(next)};
 const toggle=(name:string)=>set(selected.includes(name)?selected.filter(s=>s!==name):[...selected,name]);
 const addCustom=()=>{const name=custom.trim().replace(/,/g,' ');if(name && name.length<=60 && !selected.some(s=>s.toLowerCase()===name.toLowerCase()))set([...selected,name]);setCustom('')};
 return <div className="skill-picker">
   <input aria-label="Search engineering subjects and skills" value={query} onFocus={()=>setShowCatalog(true)} onChange={e=>{setQuery(e.target.value);setShowCatalog(true)}} placeholder="Search subjects or skills…"/>
   {selected.length>0&&<div className="skill-selected">{selected.map(name=><button key={name} type="button" onClick={()=>toggle(name)} aria-label={`Remove ${name}`}>{name} ×</button>)}</div>}
   <button type="button" className="skill-browse" aria-expanded={showCatalog} onClick={()=>setShowCatalog(!showCatalog)}>{showCatalog?'Hide subject catalog':'Browse subjects by category'}</button>
   {showCatalog&&<div className="skill-groups">{Object.entries(groups).map(([group,items])=>{
     const visible=items.filter(s=>s.toLowerCase().includes(query.toLowerCase())||group.toLowerCase().includes(query.toLowerCase()));
     return visible.length?<div key={group}><b>{group}</b><div className="skill-options">{visible.map(name=><button type="button" key={name} className={selected.includes(name)?'selected':''} aria-pressed={selected.includes(name)} onClick={()=>toggle(name)}>{name}</button>)}</div></div>:null;
   })}{query.trim()&&!Object.values(groups).flat().some(s=>s.toLowerCase().includes(query.toLowerCase()))&&<p className="skill-empty">No matching catalog skills. Add your own below.</p>}</div>}
   <div className="skill-actions">
     {!catalog.has(query.trim())&&query.trim()&&<button type="button" className="secondary" onClick={()=>{setCustom(query);setShowOther(true)}}>Add “{query.trim()}”</button>}
     <button type="button" className="secondary" aria-expanded={showOther} onClick={()=>setShowOther(!showOther)}>+ Other custom skill</button>
   </div>
   {showOther&&<div className="skill-custom"><input aria-label="Custom skill" value={custom} maxLength={60} onChange={e=>setCustom(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCustom()}}} placeholder="Enter a custom skill"/><button type="button" onClick={addCustom}>Add</button></div>}
 </div>;
}
export function ProfilePicturePicker({profile,id,onSaved}:{profile:any;id:string;onSaved:(updated:string)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function upload(file?:File){if(!file)return;setError('');setBusy(true);try{
   const form=new FormData();form.append('file',file);
   const response=await fetch('/api/profile-picture',{method:'POST',body:form});const data=await response.json();
   if(!response.ok)throw Error(data.error||'Picture could not be uploaded.');onSaved(data.avatarUpdated);
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <div className="picture-picker"><Avatar profile={profile} id={id} name={profile?.name} className="avatar large"/><label className="secondary">{busy?'Uploading…':'Upload or change picture'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/></label><small>JPG, PNG or WebP · up to 2 MB</small>{error&&<p role="alert" className="auth-error">{error}</p>}</div>;
}
