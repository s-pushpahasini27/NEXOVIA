import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from './app/landing';
import Nexovia from './app/nexovia';
import {AuthScreen,ProfileSetup} from './app/auth-ui';
import {AppTheme} from './app/theme-ui';
import './app/globals.css';
import './app/theme.css';

function App(){
 const [session,setSession]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/auth/session').then(async r=>{if(!r.ok)throw Error('Could not load your session.');return r.json()}).then(setSession).catch(e=>setError(e.message));},[]);
 if(error)return <main className="onboarding-page"><section className="panel"><h1>Unable to connect</h1><p>{error}</p><button className="primary" onClick={()=>location.reload()}>Try again</button></section></main>;
 if(!session)return <main className="onboarding-page" role="status"><p>Opening your workspace…</p></main>;
 const path=location.pathname.replace(/\/$/,'')||'/';
 const user=session.user;
 if(user){
  const target=user.profileComplete?'/workspace':'/onboarding';
  if(path!==target){location.replace(target+location.hash);return null;}
  if(!user.profileComplete)return <ProfileSetup profile={session.profile}/>;
  const closed=document.cookie.split(';').some(c=>c.trim()==='sidebar_state=false');
  return <Nexovia sidebarDefaultOpen={!closed} googleEnabled={session.googleEnabled}/>;
 }
 if(path==='/workspace'||path==='/onboarding'){location.replace('/login');return null;}
 if(path==='/login'||path==='/signup')return <AuthScreen mode={path==='/login'?'login':'signup'} googleEnabled/>;
 return <Home googleEnabled={session.googleEnabled}/>;
}
createRoot(document.getElementById('root')!).render(<AppTheme><App/></AppTheme>);
