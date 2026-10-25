import {BrandMark} from './identity';
'use client';
import {useState,useEffect} from 'react';
import {ArrowRight,ArrowLeft,Check,Eye,EyeOff,LockKeyhole,Loader2,Mail,ShieldCheck,Sparkles} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {ThemeToggle} from './theme-ui';
import {ProfilePicturePicker,SkillPicker} from './profile-fields';
import './auth.css';
async function auth(action:string,data:any){const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})});const result:any=await response.json();if(!response.ok)throw Error(result.error||'Please try again.');return result;}
function EmailVerification({email,resendAfter=60,onBack}:{email:string;resendAfter?:number;onBack:()=>void}) {
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[remaining,setRemaining]=useState(resendAfter),[note,setNote]=useState('');
 useEffect(()=>{const timer=window.setInterval(()=>setRemaining(value=>Math.max(0,value-1)),1000);return()=>window.clearInterval(timer);},[]);
 async function verify(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const result=await auth('verifyEmail',{code});window.location.assign(result.redirect);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function resend(){setBusy(true);setError('');try{const result=await auth('resendVerification',{});setRemaining(result.resendAfter);setCode('');setNote('A new code was sent. Use the latest email.');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <section><h2>Verify your email</h2><p>Enter the six-digit code sent to {email}. The code expires in 10 minutes.</p><form onSubmit={verify}><label className="field"><span>Verification code</span><input name="code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus/></label>{error&&<p className="auth-error" role="alert">{error}</p>}{note&&<p role="status">{note}</p>}<button className="primary" disabled={busy||code.length!==6}>{busy?'Verifying…':'Verify email & continue'}</button></form><button className="secondary" disabled={busy||remaining>0} onClick={resend}>{remaining>0?`Resend in ${remaining}s`:'Resend code'}</button><button className="secondary" disabled={busy} onClick={onBack}>Use another email</button></section>;
}
function PasswordField({label,name,autoComplete='new-password'}:{label:string;name:string;autoComplete?:string}){const [visible,setVisible]=useState(false);return <label className="field"><span>{label}</span><div className="password-input"><input name={name} type={visible?'text':'password'} autoComplete={autoComplete} required minLength={autoComplete==='new-password'?12:undefined} maxLength={128}/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>;}
export function GoogleSignIn(){return <div className="google-signin"><span>OR CONTINUE WITH</span><a className="secondary google-button" href="/api/auth/google/start"><span className="google-mark" aria-hidden="true">G</span> Continue with Google</a></div>}
export function AuthScreen({mode,suggestedEmail='',googleEnabled=false,pendingVerification=null}:{mode:'signup'|'login';suggestedEmail?:string;googleEnabled?:boolean;pendingVerification?:any}){
 const signup=mode==='signup';
 const [verification,setVerification]=useState<any>(pendingVerification);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const message=new URLSearchParams(window.location.search).get('google_error');if(message)setError(message.slice(0,220));},[]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');
  try{const r=await auth(mode,Object.fromEntries(new FormData(e.currentTarget)));if(r.requiresVerification){setVerification(r);setBusy(false);}else window.location.assign(r.redirect);}
  catch(e:any){setError(e.message);setBusy(false);}
 }
 return <main className={`auth-layout auth-layout--${mode}`}>
  <aside className="auth-story">
   <a href="/" className="public-brand"><span className="brand-icon"><BrandMark/></span>Nexovia</a>
   <div className="auth-story-body">
    <span className="eyebrow">A MORE INTENTIONAL WAY TO LEARN</span>
    <h2>Make space for<br/><em>what matters.</em></h2>
    <p>Plan your days, understand the difficult bits, and see how far you’ve come. All in one study space.</p>
    <div className="auth-study-card" aria-label="A glimpse of your study space">
     <div className="auth-study-top"><span>YOUR STUDY SPACE</span><span className="auth-study-spark"><Sparkles size={15}/></span></div>
     <strong>One step at a time.</strong>
     <div className="auth-study-row"><span className="auth-study-dot"/>A plan that fits your day <Check size={15}/></div>
     <div className="auth-study-row"><span className="auth-study-dot"/>Answers when you need them <Check size={15}/></div>
     <div className="auth-study-bottom"><span>PLAN</span><span className="auth-study-line"/><span>LEARN</span><span className="auth-study-line"/><span>GROW</span></div>
    </div>
   </div>
   <small>YOUR WORK, YOUR PACE, YOUR NEXT CHAPTER <span>© NEXOVIA</span></small>
  </aside>
  <section className="auth-main">
   <div className="auth-topline"><a href="/" className="public-brand auth-mobile-brand"><span className="brand-icon"><BrandMark/></span>Nexovia</a><a className="auth-back" href="/"><ArrowLeft size={15}/> Back to home</a><ThemeToggle/></div>
   <div className="auth-card">
    <div className="auth-form-heading"><span className="auth-symbol">{signup?<Sparkles size={22}/>:<LockKeyhole size={22}/>}</span><span className="eyebrow">{signup?'BEGIN YOUR NEXT CHAPTER':'WELCOME BACK TO NEXOVIA'}</span></div>
    <h1>{verification?'Check your inbox.':signup?'Your space starts here.':'Good to have you back.'}</h1>
    <p>{verification?'One quick step before you begin.':signup?'Create your account and build a study rhythm that feels like yours.':'Pick up your plans, notes, and progress right where you left them.'}</p>
    {verification?<EmailVerification email={verification.email} resendAfter={verification.resendAfter} onBack={()=>setVerification(null)}/>:<form onSubmit={submit}>
     <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={suggestedEmail} placeholder="you@example.com"/></label>
     {signup&&suggestedEmail&&<p className="help"><ShieldCheck size={14}/> Use the email above to keep your existing Nexovia plans and progress.</p>}
     <PasswordField label="Password" name="password" autoComplete={signup?'new-password':'current-password'}/>
     {signup&&<><p className="password-help">At least 12 characters. A memorable phrase works well.</p><PasswordField label="Confirm password" name="confirmPassword"/></>}
     {error&&<p className="auth-error" role="alert">{error}</p>}
     <button className="primary" disabled={busy}>{signup?'Create my account':'Continue to my workspace'} {busy?<Loader2 className="spin" size={17}/>:<ArrowRight size={17}/>}</button>
    </form>}
    {!verification&&googleEnabled&&<GoogleSignIn/>}
    <p className="auth-switch">{signup?'Already have an account?':'New to Nexovia?'} <a href={signup?'/login':'/signup'}>{signup?'Log in':'Create an account'}</a></p>
    <div className="auth-session-note"><ShieldCheck size={15}/><span>{signup?'Your study space is private by default. Make it yours at your own pace.':'Your session stays signed in for up to 30 days. Log out on shared devices.'}</span></div>
   </div>
   <span className="auth-main-foot">A LITTLE PROGRESS. EVERY DAY.</span>
  </section>
 </main>;
}
export function ProfileSetup({profile,userId}:any){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [subjects,setSubjects]=useState(profile?.subjects||'');
 const [photo,setPhoto]=useState(profile);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{const r=await auth('profile',{...Object.fromEntries(new FormData(e.currentTarget)),subjects});window.location.assign(r.redirect);}catch(e:any){setError(e.message);setBusy(false);}}
 return <main className="onboarding-page"><header><a href="/" className="public-brand"><span className="brand-icon"><BrandMark/></span>Nexovia</a><div className="account-header-actions"><ThemeToggle/><form method="post" action="/api/auth"><input type="hidden" name="action" value="logout"/><button className="secondary small">Log out</button></form></div></header><section className="onboarding-card panel"><span className="auth-symbol"><Sparkles size={25}/></span><p className="eyebrow">A SPACE THAT FEELS LIKE YOU</p><h1>Your learning profile.</h1><p>Tell us a little about yourself. You can change these details in Settings anytime.</p>
 <ProfilePicturePicker profile={photo} id={userId} onSaved={avatar_updated=>setPhoto({...photo,avatar_source:'upload',avatar_updated})}/>
 <form onSubmit={submit}><label className="field"><span>What should we call you?</span><input name="name" required maxLength={100} autoComplete="name" defaultValue={profile?.name||''} placeholder="Your name"/></label><label className="field"><span>A little about you (optional)</span><textarea name="bio" rows={3} maxLength={1000} defaultValue={profile?.bio||''} placeholder="What are you working towards?"/></label><div className="field"><span>Subjects and technical skills (optional)</span><SkillPicker value={subjects} onChange={setSubjects}/></div><label className="field"><span>Weekly study goal in minutes</span><input name="goal" type="number" min={30} max={3360} required defaultValue={profile?.goal||600}/></label><p className="help"><ShieldCheck size={14}/> Your profile starts private. You can choose community visibility later.</p>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?<Loader2 className="spin" size={17}/>:<ArrowRight size={17}/>} Save & open my workspace</button></form></section></main>;
}
export function AccountSecurity({email,hasPassword=true}:{email?:string;hasPassword?:boolean}){const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{await auth('password',Object.fromEntries(new FormData(e.currentTarget)));setSaved(true);}catch(e:any){setError(e.message);}finally{setBusy(false);}}return <><section className="panel below account-security"><h2>Account & security</h2><div className="setting-row"><div><b>Email address</b><p>{email}</p></div><Mail size={19}/></div><button className="secondary" onClick={()=>{setOpen(true);setSaved(false);setError('')}}><LockKeyhole size={16}/> {hasPassword?'Change password':'Set a password'}</button></section><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{saved?'Password updated.':(hasPassword?'Change your password':'Set a password')}</DialogTitle><DialogDescription>{saved?'Your other sessions are signed out. You can continue using this session.':(hasPassword?'Confirm your current password to choose a new one.':'Add an email password to your Google account.')}</DialogDescription></DialogHeader>{saved?<button className="primary" onClick={()=>setOpen(false)}>Done</button>:<form onSubmit={submit}>{hasPassword&&<PasswordField name="currentPassword" label="Current password" autoComplete="current-password"/>}<PasswordField name="password" label="New password"/><p className="password-help">Use 12–128 characters.</p><PasswordField name="confirmPassword" label="Confirm new password"/>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<Check size={16}/>} Update password</button></form>}</DialogContent></Dialog></>;}
