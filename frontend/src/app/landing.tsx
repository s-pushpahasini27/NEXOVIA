import {useEffect,useState,type CSSProperties} from 'react';
import {ArrowDown,ArrowRight,ArrowUpRight,BookOpenText,CalendarDays,ChartNoAxesCombined,Check,Clock3,Menu,MessageCircleMore,Sparkles,X} from 'lucide-react';
import {ThemeToggle} from './theme-ui';
import {BrandMark} from './identity';

const features=[
 {id:'planner',number:'01',name:'AI Study Planner',eyebrow:'A clearer starting point',title:'A plan that makes room for real life.',description:'Shape a study schedule around your subjects, deadlines, priorities, and available hours. Preview it, make changes, and return when plans shift.',points:['Adaptive schedules','Deadline-aware priorities'],Icon:CalendarDays},
 {id:'tutors',number:'02',name:'AI Tutors',eyebrow:'Understanding, on demand',title:'Stay with the question a little longer.',description:'Ask about a difficult concept, bring in your own notes or PDFs, and turn a useful explanation into quizzes and flashcards for practice.',points:['Study with your materials','Move from answers to practice'],Icon:MessageCircleMore},
 {id:'sessions',number:'03',name:'Study Sessions',eyebrow:'Focus with intention',title:'Make the time you have count.',description:'Settle into a focused session, track the time you actually study, and pick up missed tasks without losing your place.',points:['Focus timer','Session history'],Icon:Clock3},
 {id:'analytics',number:'04',name:'Progress Analytics',eyebrow:'See the bigger picture',title:'Notice the progress you’re making.',description:'See your study history, goals, and areas that need more attention in one place, so the next step feels easier to choose.',points:['Progress and goals','Insights for what comes next'],Icon:ChartNoAxesCombined},
];

function OpeningSequence({onFinish}:{onFinish:()=>void}){
 useEffect(()=>{
  const timer=window.setTimeout(onFinish,3300);
  const dismiss=(event:KeyboardEvent)=>{if(event.key==='Escape')onFinish();};
  window.addEventListener('keydown',dismiss);
  return()=>{window.clearTimeout(timer);window.removeEventListener('keydown',dismiss);};
 },[onFinish]);
 return <div className="nex-intro" aria-label="Nexovia introduction">
  <div className="nex-intro-orbit" aria-hidden="true"/>
  <p className="nex-intro-kicker">A NEW WAY TO FIND YOUR FLOW</p>
  <div className="nex-intro-word" aria-label="Nexovia" role="img">{'NEXOVIA'.split('').map((letter,index)=><span aria-hidden="true" key={`${letter}-${index}`} style={{'--letter-index':index} as CSSProperties}>{letter}</span>)}</div>
  <p className="nex-intro-caption">A place for the moment it clicks.</p>
  <button type="button" className="nex-intro-skip" onClick={onFinish}>Skip intro <ArrowRight size={16} aria-hidden="true"/></button>
 </div>;
}

function useLandingMotion(){
 useEffect(()=>{
  const root=document.querySelector('.nex-landing');
  if(!root)return;
  const targets=Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
  if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){targets.forEach(target=>target.classList.add('is-visible'));return;}
  root.classList.add('motion-ready');
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}});},{threshold:.12,rootMargin:'0px 0px -30px 0px'});
  targets.forEach(target=>observer.observe(target));
  return()=>observer.disconnect();
 },[]);
}

export default function Home({googleEnabled=false}:{googleEnabled?:boolean}){
 const [introVisible,setIntroVisible]=useState(()=>{
  if(typeof window==='undefined')return false;
  try{return !window.matchMedia('(prefers-reduced-motion: reduce)').matches&&sessionStorage.getItem('nexovia-intro-seen')!=='true';}catch{return false;}
 });
 const [menuOpen,setMenuOpen]=useState(false);
 useLandingMotion();
 useEffect(()=>{if(!menuOpen)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenuOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[menuOpen]);
 const finishIntro=()=>{try{sessionStorage.setItem('nexovia-intro-seen','true');}catch{}setIntroVisible(false);};
 return <main className="liquid-landing nex-landing" id="top">
  {introVisible&&<OpeningSequence onFinish={finishIntro}/>}
  <header className="nex-header" inert={introVisible}>
   <a className="nex-brand" href="/" aria-label="Nexovia home"><span className="nex-brand-symbol"><BrandMark/></span><span>NEXOVIA</span></a>
   <nav className={menuOpen?'nex-nav is-open':'nex-nav'} aria-label="Main navigation" id="nex-navigation">
    <a href="#experience" onClick={()=>setMenuOpen(false)}>The experience</a><a href="#features" onClick={()=>setMenuOpen(false)}>Features</a><a href="/login">Log in</a>
    <ThemeToggle/>
    <a href="/signup" className="nex-nav-cta">Get started <ArrowUpRight size={15} aria-hidden="true"/></a>
   </nav>
   <button type="button" className="nex-menu-button" aria-label={menuOpen?'Close menu':'Open menu'} aria-controls="nex-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X size={21}/>:<Menu size={21}/>}</button>
  </header>

  <section className="nex-hero" aria-labelledby="landing-headline" inert={introVisible}>
   <div className="nex-hero-grid">
    <div className="nex-hero-copy">
     <p className="nex-eyebrow"><span className="nex-signal"/> YOUR SPACE TO LEARN BRILLIANTLY</p>
     <h1 id="landing-headline">Make room for<br/><em>the moment</em><br/>it clicks<span className="nex-period">.</span></h1>
     <p className="nex-hero-lede">A more considered way to plan, focus, understand, and grow. Everything you need to move from “I should” to “I’ve got this.”</p>
     <div className="nex-actions"><a className="nex-button nex-button-primary" href="/signup">Get started <span><ArrowUpRight size={18} aria-hidden="true"/></span></a><a className="nex-button nex-button-outline" href="#features">Explore features <ArrowDown size={17} aria-hidden="true"/></a></div>
     <div className="nex-hero-footnote"><span className="nex-footnote-line"/> BUILT FOR THE WAY YOU ACTUALLY LEARN</div>
    </div>
    <div className="nex-hero-art" aria-label="Illustrative preview of a Nexovia study workflow">
     <div className="nex-art-halo" aria-hidden="true"/>
     <div className="nex-art-card nex-art-plan"><div className="nex-art-head"><span><CalendarDays size={16}/> STUDY PLAN</span><span className="nex-art-dots">···</span></div><p className="nex-art-date">Today’s focus</p><strong>Find your rhythm.</strong><div className="nex-art-task"><span className="nex-art-checkbox"><Check size={13}/></span><span><b>Review the essentials</b><small>Build your foundation</small></span><span className="nex-art-time">25 MIN</span></div><div className="nex-art-task"><span className="nex-art-checkbox empty"/><span><b>Ask a better question</b><small>Go deeper with AI Tutors</small></span><span className="nex-art-time">NEXT</span></div></div>
     <div className="nex-art-card nex-art-tutor"><span className="nex-art-tutor-icon"><Sparkles size={17}/></span><div><small>AI TUTORS</small><p>Curiosity looks good on you.</p></div><ArrowUpRight size={17} aria-hidden="true"/></div>
     <div className="nex-art-caption">ILLUSTRATIVE PREVIEW <span>↗</span></div>
    </div>
   </div>
   <div className="nex-hero-bottom"><span>PLAN BETTER <i/> LEARN DEEPER <i/> GO FURTHER</span><a href="#experience">Scroll to discover <ArrowDown size={16} aria-hidden="true"/></a></div>
  </section>

  <section className="nex-feature-strip" aria-label="Nexovia features" inert={introVisible}>{features.map(({id,number,name,Icon})=><a href={`#${id}`} key={id}><span>{number}</span><Icon size={19} strokeWidth={1.6} aria-hidden="true"/><b>{name}</b><ArrowUpRight size={16} aria-hidden="true"/></a>)}</section>

  <section className="nex-story" id="experience" aria-labelledby="experience-heading" inert={introVisible}>
   <div className="nex-story-heading" data-reveal><p className="nex-eyebrow">ONE SPACE. A BETTER FLOW.</p><h2 id="experience-heading">Learning feels different<br/>when it all <em>connects.</em></h2></div>
   <div className="nex-story-content" data-reveal><p>Some days you need a plan. Some days you need an explanation that finally makes sense. Nexovia keeps the pieces together, so you can spend less energy switching gears and more energy moving forward.</p><a className="nex-text-link" href="/signup">Find your flow <ArrowUpRight size={17}/></a></div>
   <div className="nex-story-line" aria-hidden="true"><span>01 / SET A DIRECTION</span><span>02 / FIND FOCUS</span><span>03 / SEE YOUR GROWTH</span></div>
  </section>

  <section className="nex-features" id="features" aria-labelledby="features-heading" inert={introVisible}><div className="nex-features-top" data-reveal><p className="nex-eyebrow">THE TOOLS BEHIND YOUR MOMENTUM</p><h2 id="features-heading">Thoughtful tools for<br/><em>every kind of progress.</em></h2><p>Start with what you need today. Everything works better together tomorrow.</p></div><div className="nex-feature-grid">{features.map(({id,number,name,eyebrow,title,description,points,Icon})=><article className="nex-feature-card" id={id} key={id} data-reveal><div className="nex-feature-card-top"><span>{number} / 04</span><span className="nex-feature-icon"><Icon size={25} strokeWidth={1.45} aria-hidden="true"/></span></div><div className="nex-feature-card-body"><p className="nex-card-kicker">{eyebrow}</p><h3>{name}</h3><strong>{title}</strong><p>{description}</p></div><div className="nex-feature-card-bottom"><div>{points.map(point=><span key={point}><Check size={13} aria-hidden="true"/>{point}</span>)}</div><a href="/signup" aria-label={`Get started with ${name}`}><ArrowUpRight size={18} aria-hidden="true"/></a></div></article>)}</div></section>

  <section className="nex-closing" aria-labelledby="closing-heading" inert={introVisible}><div className="nex-closing-orbit" aria-hidden="true"/><div data-reveal><p className="nex-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h2 id="closing-heading">Make a little space<br/>for <em>what’s possible.</em></h2><p>One plan, one question, one focused session. Start where you are and see how far you can go.</p><div className="nex-actions"><a className="nex-button nex-button-primary" href="/signup">Get started <span><ArrowUpRight size={18} aria-hidden="true"/></span></a>{googleEnabled&&<a className="nex-text-link" href="/api/auth/google/start">Continue with Google <ArrowRight size={16}/></a>}</div></div><div className="nex-closing-mark" aria-hidden="true"><BookOpenText size={96} strokeWidth={.6}/></div></section>
  <footer className="nex-footer" inert={introVisible}><a className="nex-brand" href="/" aria-label="Nexovia home"><span className="nex-brand-symbol"><BrandMark/></span><span>NEXOVIA</span></a><p>For the beautifully curious.</p><div><a href="#top">Back to top ↑</a><a href="/login">Log in <ArrowUpRight size={14}/></a></div></footer>
 </main>;
}
