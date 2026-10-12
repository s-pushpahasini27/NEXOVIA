import {useEffect,useState,type ReactNode} from 'react';
import {useTheme} from 'next-themes';
import LiquidFilm from './originkit/liquid-film';

/** One Originkit canvas shared by every route; never mounted inside a panel. */
export function FilmEnvironment({children}:{children:ReactNode}){
 const {resolvedTheme}=useTheme();
 const [reducedMotion,setReducedMotion]=useState(true);
 const [visible,setVisible]=useState(true);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const preference=()=>setReducedMotion(media.matches);
  const visibility=()=>setVisible(!document.hidden);
  preference();visibility();
  media.addEventListener('change',preference);
  document.addEventListener('visibilitychange',visibility);
  return()=>{media.removeEventListener('change',preference);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 return <>
  <div className="liquid-environment" aria-hidden="true">
   {!reducedMotion&&visible&&<LiquidFilm background={resolvedTheme==='dark'?'#0B0A10':'#f3f5fa'} color1="#29F0C4" color2="#4800FF" speed={25} style={{minWidth:0,minHeight:0,width:'100%',height:'100%'}}/>}
   <div className="environment-scrim"/>
  </div>
  {children}
 </>;
}
