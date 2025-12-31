
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Database, Users, Lock, Sun, Moon, 
  History, Settings, Building2, Eye, EyeOff, 
  KeyRound, Loader2, Power, ShieldAlert, X, ArrowLeft, CalendarDays,
  ClipboardList
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import TicketManager from './components/TicketManager';
import SalesTerminal from './components/SalesTerminal';
import UserManagement from './components/UserManagement';
import SalesHistory from './components/SalesHistory';
import AgencySettings from './components/AgencySettings';
import AgencyManager from './components/AgencyManager';
import TaskManager from './components/TaskManager';
import LandingPage from './components/LandingPage';
import { supabase } from './services/supabase';
import { UserProfile, UserRole, Agency } from './types';
import { translations, Language } from './i18n';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentAgency, setCurrentAgency] = useState<Agency | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLogin, setShowLogin] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [lang] = useState<Language>('fr');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  const t = translations[lang];

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const init = async () => {
      const profile = await supabase.checkPersistedSession();
      if (profile) {
        setUser(profile);
        setPinLocked(true);
      }
      setIsAppLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (user?.agency_id) {
      supabase.getAgency(user.agency_id).then(setCurrentAgency);
    }
  }, [user]);

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  const currentView = useMemo(() => {
    if (!user) return showLogin ? 'LOGIN' : 'LANDING';
    if (pinLocked) return 'LOCKED';
    if (currentAgency?.status === 'inactive') return 'SUSPENDED';
    if (user.role !== UserRole.SUPER_ADMIN && !supabase.isSubscriptionActive(currentAgency)) return 'EXPIRED';
    return 'MAIN';
  }, [user, showLogin, pinLocked, currentAgency]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const profile = await supabase.signIn(loginEmail, loginPassword);
      if (profile) {
        setUser(profile);
        setPinLocked(true);
        setLoginPassword('');
        notify('success', 'Connecté');
      } else {
        notify('error', "Échec");
      }
    } catch (err) {
      notify('error', "Erreur");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (user) supabase.signOut(user);
    setUser(null);
    setCurrentAgency(null);
    setPinLocked(false);
    setPin('');
    setShowLogin(false);
    notify('info', 'Déconnecté');
  };

  const handlePinSubmit = async (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        setIsLoading(true);
        const isValid = await supabase.verifyPin(user!.id, nextPin);
        if (isValid) {
          setPinLocked(false);
          setPin('');
        } else {
          notify('error', 'Invalide');
          setPin('');
        }
        setIsLoading(false);
      }
    }
  };

  const canAccess = (tab: string) => {
    if (user?.role === UserRole.SUPER_ADMIN) return true;
    const modules = currentAgency?.settings?.modules;
    if (!modules) return true;
    return (modules as any)[tab] !== false;
  };

  if (isAppLoading) return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-primary-600 rounded-2xl animate-bounce flex items-center justify-center text-white font-black text-xl">W</div>
      <Loader2 className="animate-spin text-primary-600" size={24} />
    </div>
  );

  return (
    <div className="font-inter transition-colors duration-300">
      {notification && (
        <div className="fixed top-6 left-6 right-6 z-[100] animate-in slide-in-from-top duration-500 max-w-md mx-auto">
          <div className={`px-6 py-4 rounded-3xl shadow-2xl flex justify-between items-center text-white font-black uppercase text-[10px] ${notification.type === 'success' ? 'bg-green-600' : notification.type === 'error' ? 'bg-red-600' : 'bg-primary-600'}`}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)}><X size={16}/></button>
          </div>
        </div>
      )}

      {currentView === 'LANDING' && <LandingPage onLoginClick={() => setShowLogin(true)} />}
      
      {currentView === 'LOGIN' && (
        <div className="min-h-screen bg-primary-600 dark:bg-gray-950 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative animate-in zoom-in">
            <button onClick={() => setShowLogin(false)} className="absolute top-8 left-8 p-3 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all"><ArrowLeft size={24} /></button>
            <div className="text-center pt-10 mb-10">
              <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-inner"><Lock size={32} /></div>
              <h1 className="text-2xl font-black uppercase tracking-tighter dark:text-white">Wifi Pro</h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">SaaS Console</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" placeholder="Email" className="w-full p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold dark:text-white outline-none" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
              <div className="relative">
                <input type={showPassword ? "text" : "password"} placeholder="Password" className="w-full p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold dark:text-white outline-none" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
              </div>
              <button disabled={isLoading} className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-3">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Se Connecter'}
              </button>
            </form>
          </div>
        </div>
      )}

      {currentView === 'LOCKED' && (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-8 space-y-12 animate-in fade-in">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/20 text-primary-600 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-xl"><KeyRound size={32} /></div>
            <h2 className="text-2xl font-black uppercase dark:text-white">Sécurité</h2>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{user?.display_name}</p>
          </div>
          <div className="flex gap-4">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full border-2 border-primary-600 transition-all ${pin.length > i ? 'bg-primary-600 scale-125' : ''}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-6 max-w-[280px]">
            {[1,2,3,4,5,6,7,8,9,'C',0,'<'].map(val => (
              <button key={val} onClick={() => { if(val === 'C') setPin(''); else if(val === '<') setPin(pin.slice(0,-1)); else handlePinSubmit(val.toString()); }} className="aspect-square bg-white dark:bg-gray-900 rounded-full font-black text-xl shadow-md active:bg-primary-600 active:text-white active:scale-90 transition-all dark:text-white border dark:border-gray-800">
                {val}
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500">Se déconnecter</button>
        </div>
      )}

      {(currentView === 'SUSPENDED' || currentView === 'EXPIRED') && (
        <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-10 text-center space-y-6">
          <div className={`w-24 h-24 rounded-[2rem] shadow-2xl flex items-center justify-center ${currentView === 'SUSPENDED' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
            {currentView === 'SUSPENDED' ? <ShieldAlert size={48} /> : <CalendarDays size={48} />}
          </div>
          <h2 className="text-3xl font-black uppercase">{currentView === 'SUSPENDED' ? 'Accès Bloqué' : 'Licence Expirée'}</h2>
          <p className="text-gray-500 max-w-xs">{currentView === 'SUSPENDED' ? 'Contactez le support.' : 'Renouvelez votre abonnement.'}</p>
          <button onClick={handleLogout} className="px-10 py-4 bg-gray-900 dark:bg-white dark:text-gray-950 text-white rounded-2xl font-black uppercase text-[10px]">Déconnexion</button>
        </div>
      )}

      {currentView === 'MAIN' && (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col lg:flex-row transition-colors">
          <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-gray-900 border-r dark:border-gray-800 flex-col p-8 z-50">
            <div className="flex items-center gap-4 mb-14">
              <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl">W</div>
              <h1 className="text-xl font-black dark:text-white uppercase tracking-tighter">Wifi Pro</h1>
            </div>
            <nav className="space-y-1 flex-1">
              <NavItem icon={<LayoutDashboard/>} label={t.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              {canAccess('sales') && <NavItem icon={<ShoppingBag/>} label={t.terminal} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />}
              {canAccess('history') && <NavItem icon={<History/>} label={t.history} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />}
              {canAccess('tickets') && <NavItem icon={<Database/>} label={t.tickets} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />}
              {canAccess('tasks') && <NavItem icon={<ClipboardList/>} label={t.tasks} active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />}
              <div className="pt-8 pb-4 opacity-30 text-[9px] font-black uppercase tracking-widest ml-4">Gestion</div>
              {user!.role === UserRole.SUPER_ADMIN && <NavItem icon={<Building2/>} label={t.agencies} active={activeTab === 'agencies'} onClick={() => setActiveTab('agencies')} />}
              {user!.role !== UserRole.SELLER && <NavItem icon={<Users/>} label={t.users} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />}
              {user!.role !== UserRole.SELLER && <NavItem icon={<Settings/>} label={t.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
            </nav>
            <div className="mt-8 pt-8 border-t dark:border-gray-800 flex gap-2">
              <button onClick={() => setDarkMode(!darkMode)} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-400 hover:text-primary-600 transition-all flex-1 flex justify-center">{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
              <button onClick={() => setPinLocked(true)} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-400 flex-1 flex justify-center"><Lock size={20}/></button>
              <button onClick={handleLogout} className="p-4 bg-red-50 text-red-500 rounded-2xl flex-1 flex justify-center transition-all hover:bg-red-100"><Power size={20}/></button>
            </div>
          </aside>

          <main className="flex-1 lg:ml-[280px] p-4 md:p-10 lg:p-16 pb-32 max-w-full relative">
            <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              {activeTab === 'dashboard' && <Dashboard user={user!} lang={lang} onNavigate={setActiveTab} notify={notify} />}
              {activeTab === 'sales' && <SalesTerminal user={user!} lang={lang} notify={notify} />}
              {activeTab === 'history' && <SalesHistory user={user!} lang={lang} />}
              {activeTab === 'tickets' && <TicketManager user={user!} lang={lang} notify={notify} />}
              {activeTab === 'tasks' && <TaskManager user={user!} lang={lang} />}
              {activeTab === 'agencies' && <AgencyManager user={user!} lang={lang} notify={notify} />}
              {activeTab === 'users' && <UserManagement user={user!} lang={lang} />}
              {activeTab === 'settings' && <AgencySettings user={user!} lang={lang} />}
            </div>
          </main>

          <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-950/90 backdrop-blur-2xl border-t dark:border-gray-800 flex justify-around p-4 safe-bottom z-50 rounded-t-[2.5rem] shadow-2xl">
            <MobNavItem icon={<LayoutDashboard/>} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            {canAccess('sales') && <MobNavItem icon={<ShoppingBag/>} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />}
            {canAccess('tickets') && <MobNavItem icon={<Database/>} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />}
            {canAccess('history') && <MobNavItem icon={<History/>} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />}
            <MobNavItem icon={<Settings/>} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </nav>
        </div>
      )}
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-4 w-full p-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${active ? 'bg-primary-600 text-white shadow-xl shadow-primary-500/30' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900'}`}>
    {React.cloneElement(icon, { size: 18 })} 
    <span>{label}</span>
  </button>
);

const MobNavItem = ({ icon, active, onClick }: any) => (
  <button onClick={onClick} className={`p-4 rounded-2xl transition-all ${active ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600' : 'text-gray-400 opacity-60'}`}>
    {React.cloneElement(icon, { size: 24 })}
  </button>
);

export default App;
