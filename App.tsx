
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LayoutDashboard, ShoppingBag, Database, Users, Lock, Sun, Moon, History, Settings, Building2, ChevronRight, Eye, EyeOff, KeyRound, Loader2, ClipboardList, Power } from 'lucide-react';
import Dashboard from './components/Dashboard';
import TicketManager from './components/TicketManager';
import SalesTerminal from './components/SalesTerminal';
import UserManagement from './components/UserManagement';
import SalesHistory from './components/SalesHistory';
import AgencySettings from './components/AgencySettings';
import AgencyManager from './components/AgencyManager';
import TaskManager from './components/TaskManager';
import { supabase } from './services/supabase';
import { UserProfile, UserRole, Agency } from './types';
import { translations, Language } from './i18n';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentAgency, setCurrentAgency] = useState<Agency | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pinLocked, setPinLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lang] = useState<Language>('fr');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  const t = translations[lang];

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (user) {
      supabase.getAgency(user.agency_id).then(setCurrentAgency);
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const profile = await supabase.signIn(loginEmail, loginPassword);
    setIsLoading(false);
    if (profile) {
      setUser(profile);
      setPinLocked(true);
    } else alert(t.loginError);
  };

  const handleLogout = useCallback(async () => {
    if (user) await supabase.signOut(user);
    setUser(null);
    setPinLocked(false);
  }, [user]);

  const handlePinSubmit = async (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4 && user) {
        setIsLoading(true);
        const ok = await supabase.verifyPin(user.id, newPin);
        if (ok) { setPinLocked(false); setPin(''); }
        else { alert(t.pinError); setPin(''); }
        setIsLoading(false);
      }
    }
  };

  const canAccess = useMemo(() => (module: string) => {
    if (user?.role === UserRole.SUPER_ADMIN) return true;
    return (currentAgency?.settings?.modules as any)?.[module] !== false;
  }, [user, currentAgency]);

  if (!user) return (
    <div className="min-h-screen bg-primary-600 dark:bg-gray-950 flex items-center justify-center p-6 transition-all">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black dark:text-white uppercase tracking-tighter">{t.appName}</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <input type="email" placeholder={t.emailAddress} className="w-full p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none font-bold dark:text-white" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
          <div className="relative">
            <input type={showPassword ? "text" : "password"} placeholder={t.password} className="w-full p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none font-bold dark:text-white" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button disabled={isLoading} className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex justify-center">
            {isLoading ? <Loader2 className="animate-spin" /> : t.confirm}
          </button>
        </form>
      </div>
    </div>
  );

  if (pinLocked) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-8 space-y-10 animate-in fade-in">
      <div className="text-center space-y-2">
        <KeyRound className="w-12 h-12 text-primary-600 mx-auto mb-4" />
        <h2 className="text-2xl font-black dark:text-white">{t.secureAccess}</h2>
      </div>
      <div className="flex gap-4">
        {[0,1,2,3].map(i => <div key={i} className={`w-4 h-4 rounded-full border-2 border-primary-600 transition-all ${pin.length > i ? 'bg-primary-600 scale-125' : ''}`} />)}
      </div>
      <div className="grid grid-cols-3 gap-6">
        {[1,2,3,4,5,6,7,8,9,'C',0,'DEL'].map(val => (
          <button key={val} onClick={() => val === 'C' ? setPin('') : val === 'DEL' ? setPin(pin.slice(0,-1)) : handlePinSubmit(val.toString())} className="w-16 h-16 sm:w-20 sm:h-20 bg-white dark:bg-gray-900 rounded-full font-black text-xl shadow-sm active:bg-primary-600 active:text-white transition-all">
            {val}
          </button>
        ))}
      </div>
      <button onClick={handleLogout} className="text-gray-400 font-bold uppercase tracking-widest text-xs hover:text-red-500">{t.logout}</button>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-[280px] bg-gray-50 dark:bg-gray-950 transition-colors">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b dark:border-gray-800 p-4 flex justify-between lg:hidden">
        <button onClick={handleLogout} className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl"><Power size={20}/></button>
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-black">W</div><span className="font-black text-sm dark:text-white uppercase">Wifi Pro</span></div>
        <button onClick={() => setPinLocked(true)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500"><Lock size={20}/></button>
      </header>

      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-gray-900 border-r dark:border-gray-800 flex-col p-6 overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-black text-xl">W</div>
          <h1 className="text-xl font-black dark:text-white">Wifi <span className="text-primary-600">Pro</span></h1>
          <button onClick={handleLogout} className="ml-auto p-2 text-red-400 hover:text-red-600"><Power size={18}/></button>
        </div>
        <nav className="space-y-1 flex-1">
          <NavItem icon={<LayoutDashboard/>} label={t.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          {canAccess('sales') && <NavItem icon={<ShoppingBag/>} label={t.terminal} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />}
          {canAccess('history') && <NavItem icon={<History/>} label={t.history} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />}
          {canAccess('tickets') && <NavItem icon={<Database/>} label={t.tickets} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />}
          {canAccess('tasks') && <NavItem icon={<ClipboardList/>} label={t.tasks} active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />}
          <div className="pt-6"><p className="text-[10px] font-black text-gray-400 uppercase ml-4 mb-2">Admin</p>
            {user.role === UserRole.SUPER_ADMIN && <NavItem icon={<Building2/>} label={t.agencies} active={activeTab === 'agencies'} onClick={() => setActiveTab('agencies')} />}
            {user.role !== UserRole.SELLER && <NavItem icon={<Users/>} label={t.users} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />}
            {user.role !== UserRole.SELLER && <NavItem icon={<Settings/>} label={t.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
          </div>
        </nav>
        <div className="mt-6 flex gap-2">
          <button onClick={() => setDarkMode(!darkMode)} className="flex-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl flex justify-center text-gray-500">{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
          <button onClick={() => setPinLocked(true)} className="flex-1 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl flex justify-center text-gray-500"><Lock size={20}/></button>
        </div>
      </aside>

      <main className="p-6 lg:p-12 max-w-6xl mx-auto w-full animate-in slide-in-from-bottom-2">
        {activeTab === 'dashboard' && <Dashboard user={user} lang={lang} onNavigate={setActiveTab} />}
        {activeTab === 'sales' && <SalesTerminal user={user} lang={lang} />}
        {activeTab === 'history' && <SalesHistory user={user} lang={lang} />}
        {activeTab === 'tickets' && <TicketManager user={user} lang={lang} />}
        {activeTab === 'tasks' && <TaskManager user={user} lang={lang} />}
        {activeTab === 'agencies' && <AgencyManager user={user} lang={lang} />}
        {activeTab === 'users' && <UserManagement user={user} lang={lang} />}
        {activeTab === 'settings' && <AgencySettings user={user} lang={lang} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t dark:border-gray-800 flex justify-around p-4 lg:hidden z-50">
        <MobNavItem icon={<LayoutDashboard/>} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobNavItem icon={<ShoppingBag/>} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />
        <MobNavItem icon={<Database/>} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />
        <MobNavItem icon={<ClipboardList/>} active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
        <MobNavItem icon={<Settings/>} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-4 w-full p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${active ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'}`}>
    {React.cloneElement(icon, { size: 18 })} <span>{label}</span>
  </button>
);

const MobNavItem = ({ icon, active, onClick }: any) => (
  <button onClick={onClick} className={`p-4 rounded-2xl transition-all ${active ? 'bg-primary-600 text-white scale-110 shadow-lg' : 'text-gray-400'}`}>
    {React.cloneElement(icon, { size: 24 })}
  </button>
);

export default App;
