
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingBag, Database, Users, LogOut, Lock, Sun, Moon, History, Settings, Building2, ChevronRight, Eye, EyeOff, KeyRound, Loader2, ClipboardList, Power } from 'lucide-react';
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [lang, setLang] = useState<Language>('fr');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const t = translations[lang];

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const fetchAgency = async () => {
      if (user) {
        const ag = await supabase.getAgency(user.agency_id);
        setCurrentAgency(ag);
      } else {
        setCurrentAgency(null);
      }
    };
    fetchAgency();
  }, [user]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn || !loginEmail || !loginPassword) return;
    
    setIsLoggingIn(true);
    
    // Appel sécurisé au service
    const profile = await supabase.signIn(loginEmail, loginPassword);
    
    setIsLoggingIn(false);
    
    if (profile) {
      setUser(profile);
      setPinLocked(true); // Demande du PIN pour la première session ou accès sécurisé
      setLoginEmail('');
      setLoginPassword('');
    } else {
      alert(t.loginError);
    }
  };

  const handleLogout = async () => {
      if (user) {
          await supabase.signOut(user);
      }
      setUser(null);
  };

  const handlePinSubmit = async (digit: string) => {
    if (isVerifyingPin) return;

    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      
      if (newPin.length === 4) {
        if (!user) return;
        
        setIsVerifyingPin(true);
        // Vérification sécurisée côté "serveur" (service)
        const isValid = await supabase.verifyPin(user.id, newPin);
        
        // Petit délai pour l'UX
        await new Promise(r => setTimeout(r, 300));

        if (isValid) {
          setPinLocked(false);
          setPin('');
        } else {
          alert(t.pinError);
          setPin('');
        }
        setIsVerifyingPin(false);
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-primary-600 dark:bg-gray-950 flex items-center justify-center p-6 transition-colors duration-300">
        <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl space-y-10 border border-white/10 relative animate-in zoom-in duration-500">
          <div className="absolute top-8 right-8 flex gap-2">
            <button onClick={toggleDarkMode} className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700 active:scale-95 transition-all shadow-sm">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <div className="text-center space-y-3">
            <div className="w-24 h-24 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-primary-50 dark:ring-primary-950">
              <Lock className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">{t.appName}</h1>
            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">Mikhmon SaaS Pro</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">{t.emailAddress}</label>
              <input 
                type="email" 
                className="w-full px-7 py-5 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent focus:border-primary-500 rounded-[1.5rem] transition-all outline-none text-gray-900 dark:text-white font-bold"
                placeholder="Ex: admin@wifiproximite.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-2">{t.password}</label>
              <div className="relative">
                <input 
                    type={showPassword ? "text" : "password"}
                    className="w-full px-7 py-5 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent focus:border-primary-500 rounded-[1.5rem] transition-all outline-none text-gray-900 dark:text-white font-bold pr-14"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600 transition-colors p-2"
                >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full py-5 rounded-[1.5rem] font-black bg-primary-600 text-white shadow-xl shadow-primary-500/40 active:scale-[0.98] transition-all text-lg uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {t.loggingIn}</>
              ) : (
                t.confirm
              )}
            </button>
          </form>
          
          <div className="text-center opacity-40">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">DÉMO ACCÈS</p>
            <p className="text-[9px] text-gray-500">admin@wifiproximite.com | Pass: admin | PIN: 1234</p>
          </div>
        </div>
      </div>
    );
  }

  if (pinLocked) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-8 space-y-14 transition-colors duration-300">
        <div className="text-center space-y-4 animate-in slide-in-from-top-4 duration-500">
          <div className="w-20 h-20 bg-primary-50 dark:bg-gray-900 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl border border-primary-100 dark:border-gray-800 ring-8 ring-primary-50/50 dark:ring-gray-900/50">
            <KeyRound className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{t.secureAccess}</h2>
          <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">{t.enterPin}</p>
        </div>
        
        <div className="flex gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-5 h-5 rounded-full border-2 border-primary-600 transition-all duration-300 ${pin.length > i ? 'bg-primary-600 scale-150 shadow-[0_0_15px_rgba(14,165,233,0.5)]' : 'bg-transparent dark:border-gray-700'}`} />
          ))}
        </div>
        
        <div className="grid grid-cols-3 gap-6 sm:gap-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'DEL'].map((val, idx) => (
            <button 
                key={idx} 
                onClick={() => { 
                    if (val === 'C') setPin(''); 
                    else if (val === 'DEL') setPin(prev => prev.slice(0, -1)); 
                    else handlePinSubmit(val.toString()); 
                }} 
                disabled={isVerifyingPin}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-black bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-800 active:bg-primary-600 active:text-white active:scale-90 transition-all disabled:opacity-50"
            >
                {val}
            </button>
          ))}
        </div>
        
        <button onClick={handleLogout} className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] hover:text-red-500 transition-colors py-4">
            {t.logout}
        </button>
      </div>
    );
  }

  const isSuper = user.role === UserRole.SUPER_ADMIN;

  // Helper pour vérifier les permissions (Le SuperAdmin voit tout, les autres dépendent des settings de l'agence)
  const canAccess = (module: 'dashboard' | 'sales' | 'history' | 'tickets' | 'team' | 'tasks') => {
    if (isSuper) return true;
    if (!currentAgency?.settings?.modules) return true; // Par sécurité, accès par défaut si pas de config
    return currentAgency.settings.modules[module];
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-[300px] flex flex-col transition-colors duration-300 bg-gray-50 dark:bg-gray-950">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 p-5 flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleLogout} 
            className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl active:scale-90 transition-all shadow-sm border border-red-100 dark:border-red-900/30 flex items-center justify-center"
            title={t.logout}
          >
            <Power className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-xl shadow-primary-500/30">W</div>
          <div>
            <h1 className="font-black text-sm text-gray-900 dark:text-white tracking-tight">{t.appName}</h1>
            <p className="text-[9px] text-primary-500 font-black uppercase tracking-widest">{user.role.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={toggleDarkMode} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl active:scale-90 transition-transform">
             {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
           <button onClick={() => setPinLocked(true)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl active:scale-90 transition-transform">
             <Lock className="w-5 h-5" />
           </button>
        </div>
      </header>

      {/* Modern Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[300px] bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col z-50 overflow-hidden">
        <div className="p-8 pb-10">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-2xl shadow-primary-500/40">W</div>
              <h1 className="font-black text-2xl tracking-tighter dark:text-white leading-none">Wifi <span className="text-primary-600">Pro</span></h1>
            </div>
            {/* Nouveau bouton déconnexion Desktop Top-Left (dans le header de la sidebar) */}
            <button 
              onClick={handleLogout}
              className="p-2.5 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-all active:scale-90"
              title={t.logout}
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-1.5">
            {canAccess('dashboard') && (
                <NavItem icon={<LayoutDashboard />} label={t.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            )}
            {canAccess('sales') && (
                <NavItem icon={<ShoppingBag />} label={t.terminal} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />
            )}
            {canAccess('history') && (
                <NavItem icon={<History />} label={t.history} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
            )}
            {canAccess('tickets') && (
                <NavItem icon={<Database />} label={t.tickets} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />
            )}
            {canAccess('tasks') && (
                <NavItem icon={<ClipboardList />} label={t.tasks} active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
            )}
            
            <div className="pt-6 pb-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4 mb-2">Administration</p>
              {isSuper && (
                <NavItem icon={<Building2 />} label={t.agencies} active={activeTab === 'agencies'} onClick={() => setActiveTab('agencies')} />
              )}
              {user.role !== UserRole.SELLER && canAccess('team') && (
                <NavItem icon={<Users />} label={t.users} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
              )}
              {/* Masqué pour les vendeurs */}
              {user.role !== UserRole.SELLER && (
                <NavItem icon={<Settings />} label={t.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto p-8 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
           <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-primary-500">
               <Users className="w-6 h-6" />
             </div>
             <div className="flex-1 overflow-hidden">
               <p className="font-black text-xs truncate dark:text-white uppercase tracking-tight">{user.display_name}</p>
               <p className="text-[9px] text-gray-400 font-black uppercase mt-0.5 tracking-[0.1em]">{user.role.replace('_', ' ')}</p>
             </div>
           </div>
           
           <div className="flex gap-2">
             <button onClick={toggleDarkMode} className="flex-1 p-3.5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-gray-500 hover:text-primary-600 transition-all flex items-center justify-center">
               {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
             </button>
             <button onClick={() => setPinLocked(true)} className="flex-1 p-3.5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-gray-500 hover:text-primary-600 transition-all flex items-center justify-center">
               <Lock className="w-4 h-4" />
             </button>
           </div>
        </div>
      </aside>

      <main className="flex-1 p-8 lg:p-14 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        {activeTab === 'dashboard' && canAccess('dashboard') && <Dashboard user={user} lang={lang} onNavigate={setActiveTab} />}
        {activeTab === 'sales' && canAccess('sales') && <SalesTerminal user={user} lang={lang} />}
        {activeTab === 'history' && canAccess('history') && <SalesHistory user={user} lang={lang} />}
        {activeTab === 'tickets' && canAccess('tickets') && <TicketManager user={user} lang={lang} />}
        {activeTab === 'tasks' && canAccess('tasks') && <TaskManager user={user} lang={lang} />}
        {activeTab === 'agencies' && isSuper && <AgencyManager user={user} lang={lang} />}
        {activeTab === 'users' && user.role !== UserRole.SELLER && canAccess('team') && <UserManagement user={user} lang={lang} />}
        {activeTab === 'settings' && user.role !== UserRole.SELLER && <AgencySettings user={user} lang={lang} />}
      </main>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border-t border-gray-100 dark:border-gray-800 flex justify-around p-5 pb-10 lg:hidden z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {canAccess('dashboard') && <MobNavItem icon={<LayoutDashboard />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />}
        {canAccess('sales') && <MobNavItem icon={<ShoppingBag />} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />}
        {canAccess('history') && <MobNavItem icon={<History />} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />}
        {canAccess('tasks') && <MobNavItem icon={<ClipboardList />} active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />}
        {canAccess('tickets') && <MobNavItem icon={<Database />} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />}
        {isSuper && <MobNavItem icon={<Building2 />} active={activeTab === 'agencies'} onClick={() => setActiveTab('agencies')} />}
      </nav>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-4 w-full p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all group ${active ? 'bg-primary-600 text-white shadow-xl shadow-primary-500/30' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'}`}>
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:translate-x-1'}`}>
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
    </div>
    <span className="flex-1 text-left">{label}</span>
    {active && <ChevronRight className="w-4 h-4 opacity-50" />}
  </button>
);

const MobNavItem = ({ icon, active, onClick }: any) => (
  <button onClick={onClick} className={`p-4 rounded-2xl transition-all active:scale-75 ${active ? 'bg-primary-600 text-white shadow-xl shadow-primary-500/30 scale-110' : 'text-gray-400 dark:text-gray-500'}`}>
    {React.cloneElement(icon, { className: 'w-6 h-6' })}
  </button>
);

export default App;
