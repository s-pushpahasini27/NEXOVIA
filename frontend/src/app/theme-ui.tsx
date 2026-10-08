'use client';

import {useEffect,useState} from 'react';
import {ThemeProvider,useTheme} from 'next-themes';
import {Moon,Sun} from 'lucide-react';
import {ParticleBackground} from './particle-background';

export function AppTheme({children}:{children:React.ReactNode}){
 return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="nexovia-theme" disableTransitionOnChange><ParticleBackground/><div className="app-shell">{children}</div></ThemeProvider>;
}

export function ThemeToggle(){
 const {resolvedTheme,setTheme}=useTheme();
 const [ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 const dark=ready&&resolvedTheme==='dark';
 const label=dark?'Switch to light mode':'Switch to dark mode';
 return <button type="button" className="icon-button theme-toggle" aria-label={label} title={label} disabled={!ready} onClick={()=>setTheme(dark?'light':'dark')}><Sun size={18} className="theme-sun"/><Moon size={18} className="theme-moon"/></button>;
}

export function UserGreeting({name}:{name?:string}){
 const [greeting,setGreeting]=useState('Welcome back');
 useEffect(()=>{
  const update=()=>{const hour=new Date().getHours();setGreeting(hour<12?'Good morning':hour<17?'Good afternoon':'Good evening');};
  update();const timer=setInterval(update,60000);return()=>clearInterval(timer);
 },[]);
 const displayName=name?.trim();
 return <h1 className="user-greeting">{greeting}{displayName?<>, <span className="greeting-name">{displayName}</span></>:null}<span aria-hidden="true">.</span></h1>;
}
