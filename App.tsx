
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Database, Users, Lock, Sun, Moon, 
  History, Settings, Building2, Eye, EyeOff, 
  KeyRound, Loader2, ClipboardList, Power, ShieldAlert, 
  CheckCircle, Info, XCircle, X, ArrowLeft,
  CalendarDays, Smartphone
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

  // Session auto-check
  useEffect(() => {
    const checkSession = async () => {
      const profile = await supabase.checkPersistedSession();
      if (profile) {
        setUser(profile);
        setPinLocked(true);
      }
      setIsAppLoading(false);
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (user?.agency_id) {
      const fetchAgency = async () => {
        const data = await supabase.getAgency(user.agency_id);
        setCurrentAgency(data);
      };
      fetchAgency();
    }
  }, [user]);

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const currentView = useMemo(() => {
    if (!user) return showLogin ? 'LOGIN' : 'LANDING';
    if (pinLocked) return 'LOCKED';
    if (currentAgency?.status === 'inactive') return 'SUSPENDED';
    if (user.role !== UserRole.SUPER_ADMIN && currentAgency && !supabase.isSubscriptionActive(currentAgency)) {
        return 'EXPIRED';
    }
    return 'DASHBOARD';
  }, [user, showLogin, pinLocked, currentAgency]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const profile = await supabase.signIn(loginEmail, loginPassword);
    if (profile) {
      setUser(profile);
      setPinLocked(true);
      setLoginPassword('');
      notify('success', `Bienvenue, ${profile.display_name}`);
    } else {
      notify('error', "Identifiants invalides.");
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    if (user) await supabase.signOut(user);
    setUser(null);
    setCurrentAgency(null);
    setPinLocked(false);
    setPin('');
    setShowLogin(false);
    notify('info', 'Session fermée.');
  };

  const handlePinSubmit = async (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        setIsLoading(true);
        const isValid = await supabase.verifyPin(user!.id, newPin);
        if (isValid) {
          setPinLocked(false);
          setPin('');
          notify('success', 'Accès autorisé');
        } else {
          notify('error', 'PIN invalide');
          setPin('');
        }
        setIsLoading(false);
      }
    }
  };

  const canAccess = (module: string) => {
    if (user?.role === UserRole.SUPER_ADMIN) return true;
    const modules = currentAgency?.settings?.modules;
    return !modules || (modules as any)[module] !== false;
  };

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 bg-primary-600 rounded-3xl animate-bounce flex items-center justify-center text-white font-black text-2xl shadow-2xl">W</div>
        <div className="flex items-center gap-2 text-primary-600 font-black text-xs uppercase tracking-widest animate-pulse">
          <Loader2 className="animate-spin" size={16} /> Chargement...
        </div>
      </div>
    );
  }

  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col lg:flex-row transition-colors duration-500">
      {/* HEADER MOBILE */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b dark:border-gray-800 p-4 flex justify-between items-center safe-top">
        <button onClick={handleLogout} className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl active:scale-90 transition-all"><Power size={22}/></button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-primary-500/20">W</div>
          <span className="font-black dark:text-white uppercase tracking-tighter text-sm">Wifi Pro</span>
        </div>
        <button onClick={() => setPinLocked(true)} className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl active:scale-90 transition-all"><Lock size={22}/></button>
      </header>

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[300px] bg-white dark:bg-gray-900 border-r dark:border-gray-800 flex-col p-8 z-50">
        <div className="flex items-center gap-4 mb-14">
          <div className="w-14 h-14 bg-primary-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-2xl shadow-primary-500/20">W</div>
          <div>
            <h1 className="text-xl font-black dark:text-white leading-none tracking-tight">Wifi <span className="text-primary-600">Pro</span></h1>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mt-1">SaaS Mobile</p>
          </div>
        </div>
        <nav className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
          <NavItem icon={<LayoutDashboard/>} label={t.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          {canAccess('sales') && <NavItem icon={<ShoppingBag/>} label={t.terminal} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />}
          {canAccess('history') && <NavItem icon={<History/>} label={t.history} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />}
          {canAccess('tickets') && <NavItem icon={<Database/>} label={t.tickets} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />}
          
          <div className="pt-10 pb-4 ml-4"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-50">Gestion</p></div>
          
          {user!.role === UserRole.SUPER_ADMIN && <NavItem icon={<Building2/>} label={t.agencies} active={activeTab === 'agencies'} onClick={() => setActiveTab('agencies')} />}
          {user!.role !== UserRole.SELLER && <NavItem icon={<Users/>} label={t.users} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />}
          {user!.role !== UserRole.SELLER && <NavItem icon={<Settings/>} label={t.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
        </nav>
        <div className="mt-8 pt-8 border-t dark:border-gray-800 flex gap-4">
          <button onClick={() => setDarkMode(!darkMode)} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-500 hover:text-primary-600 transition-all flex-1 flex justify-center">{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
          <button onClick={handleLogout} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl flex-1 flex justify-center hover:bg-red-100 transition-all"><Power size={20}/></button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 lg:ml-[300px] p-4 md:p-10 lg:p-16 pb-32 lg:pb-16 max-w-full overflow-x-hidden min-h-screen relative">
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

      {/* BOTTOM NAV MOBILE */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-950/90 backdrop-blur-2xl border-t dark:border-gray-800 flex justify-around items-center px-4 py-4 safe-bottom z-50 rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.1)]">
        <MobNavItem icon={<LayoutDashboard/>} label={t.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        {canAccess('sales') && <MobNavItem icon={<ShoppingBag/>} label={t.terminal} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />}
        {canAccess('tickets') && <MobNavItem icon={<Database/>} label={t.tickets} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />}
        {canAccess('history') && <MobNavItem icon={<History/>} label={t.history} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />}
        {user!.role !== UserRole.SELLER && <MobNavItem icon={<Settings/>} label={t.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
      </nav>
    </div>
  );

  return (
    <div className="font-inter">
      {notification && (
        <div className="fixed top-6 left-6 right-6 lg:left-auto lg:right-10 z-[100] animate-in slide-in-from-top lg:slide-in-from-right duration-500">
          <div className={`flex items-center gap-4 px-6 py-4 rounded-3xl shadow-2xl border backdrop-blur-xl ${notification.type === 'success' ? 'bg-green-600/95 border-green-400 text-white' : notification.type === 'error' ? 'bg-red-600/95 border-red-400 text-white' : 'bg-blue-600/95 border-blue-400 text-white'}`}>
            <span className="text-xs font-black uppercase tracking-widest flex-1">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="p-1 hover:opacity-50 transition-opacity"><X size={18}/></button>
          </div>
        </div>
      )}
      {currentView === 'LANDING' && <LandingPage onLoginClick={() => setShowLogin(true)} />}
      {currentView === 'LOGIN' && (
        <div className="min-h-screen bg-primary-600 dark:bg-gray-950 flex items-center justify-center p-6 transition-all">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl space-y-10 animate-in zoom-in duration-500 relative">
            <button onClick={() => setShowLogin(false)} className="absolute top-8 left-8 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl text-gray-500 transition-all"><ArrowLeft size={24} /></button>
            <div className="text-center pt-8 space-y-4">
              <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner"><Lock size={32} /></div>
              <h1 className="text-3xl font-black dark:text-white uppercase tracking-tighter">Wifi <span className="text-primary-600">Pro</span></h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Console d'accès SaaS</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <input type="email" placeholder={t.emailAddress} className="w-full p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl outline-none font-bold dark:text-white border-2 border-transparent focus:border-primary-500 transition-all" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
              <div className="relative">
                <input type={showPassword ? "text" : "password"} placeholder={t.password} className="w-full p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl outline-none font-bold dark:text-white border-2 border-transparent focus:border-primary-500 transition-all" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff size={22} /> : <Eye size={22} />}</button>
              </div>
              <button disabled={isLoading} className="w-full py-6 bg-primary-600 text-white rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary-500/30 active:scale-[0.98] transition-all flex justify-center items-center gap-4 disabled:opacity-50">
                {isLoading ? <Loader2 className="animate-spin" /> : t.confirm}
              </button>
            </form>
          </div>
        </div>
      )}
      {currentView === 'LOCKED' && (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-8 space-y-10 animate-in fade-in duration-500">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl"><KeyRound size={32} /></div>
            <h2 className="text-3xl font-black dark:text-white uppercase tracking-tight">{t.secureAccess}</h2>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">{user?.display_name}</p>
          </div>
          <div className="flex gap-4">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 border-primary-600 transition-all duration-300 ${pin.length > i ? 'bg-primary-600 scale-150 shadow-[0_0_20px_rgba(2,132,199,0.5)]' : ''}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-6 max-w-[320px] w-full">
            {[1,2,3,4,5,6,7,8,9,'C',0,'<'].map(val => (
              <button 
                key={val} 
                onClick={() => {
                  if (val === 'C') setPin('');
                  else if (val === '<') setPin(pin.slice(0,-1));
                  else handlePinSubmit(val.toString());
                }} 
                className="aspect-square bg-white dark:bg-gray-900 rounded-full font-black text-2xl shadow-xl border dark:border-gray-800 active:bg-primary-600 active:text-white active:scale-90 transition-all flex items-center justify-center dark:text-white"
              >
                {val}
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="text-gray-400 font-black uppercase tracking-widest text-xs hover:text-red-500 transition-colors">Déconnexion</button>
        </div>
      )}
      {currentView === 'SUSPENDED' && (
        <div className="min-h-screen bg-red-50 dark:bg-gray-950 flex flex-col items-center justify-center p-8 text-center space-y-8 animate-in zoom-in duration-700">
          <div className="w-32 h-32 bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl flex items-center justify-center text-red-500 animate-pulse"><ShieldAlert size={64} /></div>
          <div className="space-y-4 max-w-md">
            <h2 className="text-4xl font-black uppercase tracking-tight">Accès Suspendu</h2>
            <p className="text-gray-500 font-medium leading-relaxed">Cette agence a été temporairement désactivée par un administrateur système.</p>
            <button onClick={handleLogout} className="w-full py-5 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Déconnexion</button>
          </div>
        </div>
      )}
      {currentView === 'EXPIRED' && (
        <div className="min-h-screen bg-amber-50 dark:bg-gray-950 flex flex-col items-center justify-center p-8 text-center space-y-8 animate-in zoom-in duration-700">
          <div className="w-32 h-32 bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl flex items-center justify-center text-amber-500"><CalendarDays size={64} /></div>
          <div className="space-y-4 max-w-md">
            <h2 className="text-4xl font-black uppercase tracking-tight">Licence Expirée</h2>
            <p className="text-gray-500 font-medium leading-relaxed">Votre abonnement a expiré. Contactez un administrateur pour réactiver vos services.</p>
            <div className="pt-6 flex flex-col gap-4">
              <button onClick={handleLogout} className="w-full py-5 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Se déconnecter</button>
            </div>
          </div>
        </div>
      )}
      {currentView === 'DASHBOARD' && renderDashboard()}
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-5 w-full p-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${active ? 'bg-primary-600 text-white shadow-2xl shadow-primary-500/40 translate-x-3' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}>
    {React.cloneElement(icon, { size: 20, strokeWidth: active ? 3 : 2 })} 
    <span>{label}</span>
  </button>
);

const MobNavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-2 flex-1 transition-all ${active ? 'text-primary-600 scale-110' : 'text-gray-400 opacity-60'}`}>
    <div className={`p-3 rounded-2xl transition-all ${active ? 'bg-primary-50 dark:bg-primary-900/30 shadow-sm' : ''}`}>
      {React.cloneElement(icon, { size: 24, strokeWidth: active ? 3 : 2 })}
    </div>
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

export default App;
