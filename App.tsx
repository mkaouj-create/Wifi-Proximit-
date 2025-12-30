
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Database, Users, Lock, Sun, Moon, 
  History, Settings, Building2, Eye, EyeOff, 
  KeyRound, Loader2, ClipboardList, Power, ShieldAlert, 
  CheckCircle, Info, XCircle, X, ExternalLink, ArrowLeft 
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

// --- TYPES & COMPOSANTS UTILITAIRES ---

export const Tooltip: React.FC<{ text: string, children: React.ReactNode }> = ({ text, children }) => (
  <div className="group relative flex items-center">
    {children}
    <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-gray-900 dark:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-2xl whitespace-nowrap z-[100] transition-all duration-300 pointer-events-none border border-white/10">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900 dark:border-t-black"></div>
    </div>
  </div>
);

type AppViewState = 'LANDING' | 'LOGIN' | 'LOCKED' | 'SUSPENDED' | 'DASHBOARD';

const App: React.FC = () => {
  // --- ETAT GLOBAL ---
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentAgency, setCurrentAgency] = useState<Agency | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Navigation & Auth States
  const [showLogin, setShowLogin] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form States
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // UI Preferences
  const [lang] = useState<Language>('fr');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  const t = translations[lang];

  // --- EFFETS DE BORD ---

  // Gestion du thème sombre/clair
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Auto-fermeture des notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Chargement des données de l'agence une fois connecté
  useEffect(() => {
    if (user?.agency_id) {
      const fetchAgency = async () => {
        try {
          const data = await supabase.getAgency(user.agency_id);
          setCurrentAgency(data);
        } catch (error) {
          console.error("Erreur chargement agence:", error);
          notify('error', "Impossible de charger les données de l'agence.");
        }
      };
      fetchAgency();
    }
  }, [user]);

  // --- LOGIQUE METIER ---

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  }, []);

  // Détermination de la vue actuelle (Routing Logique)
  const currentView: AppViewState = useMemo(() => {
    if (!user) {
      return showLogin ? 'LOGIN' : 'LANDING';
    }
    // L'utilisateur est connecté à partir d'ici
    if (pinLocked) return 'LOCKED';
    if (currentAgency?.status === 'inactive') return 'SUSPENDED';
    return 'DASHBOARD';
  }, [user, showLogin, pinLocked, currentAgency]);

  // Connexion
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    
    setIsLoading(true);
    try {
      const profile = await supabase.signIn(loginEmail, loginPassword);
      if (profile) {
        setUser(profile);
        setPinLocked(true); // Verrouillage par défaut après connexion
        setLoginPassword(''); // Clean password from state
        notify('success', `Bienvenue, ${profile.display_name}`);
      } else {
        notify('error', t.loginError || "Identifiants incorrects");
      }
    } catch (err) {
      notify('error', "Erreur de connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  // Déconnexion
  const handleLogout = useCallback(async () => {
    if (user) await supabase.signOut(user);
    // Reset complet des états
    setUser(null);
    setCurrentAgency(null);
    setPinLocked(false);
    setPin('');
    setShowLogin(false); // Retour à la Landing Page
    notify('info', 'Vous avez été déconnecté.');
  }, [user, notify]);

  // Vérification PIN
  const handlePinSubmit = useCallback(async (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      
      if (newPin.length === 4 && user) {
        setIsLoading(true);
        try {
          const isValid = await supabase.verifyPin(user.id, newPin);
          if (isValid) { 
            setPinLocked(false); 
            setPin(''); 
            notify('success', 'Terminal déverrouillé');
          } else { 
            notify('error', t.pinError || 'PIN incorrect'); 
            setPin(''); 
          }
        } catch (error) {
          notify('error', 'Erreur de vérification.');
          setPin('');
        } finally {
          setIsLoading(false);
        }
      }
    }
  }, [pin, user, t.pinError, notify]);

  // Gestion des permissions modules
  const canAccess = useCallback((module: string) => {
    if (user?.role === UserRole.SUPER_ADMIN) return true;
    if (currentAgency?.status === 'inactive') return false;
    
    const modules = currentAgency?.settings?.modules;
    if (!modules) return true; // Par défaut tout est accessible si non configuré
    
    return (modules as any)[module] !== false;
  }, [user, currentAgency]);

  // --- RENDU DES VUES ---

  // 1. Vue Login
  const renderLogin = () => (
    <div className="min-h-screen bg-primary-600 dark:bg-gray-950 flex items-center justify-center p-6 transition-all font-inter">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in duration-500 relative">
        <button 
          onClick={() => setShowLogin(false)}
          className="absolute top-8 left-8 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="text-center space-y-4 pt-4">
          <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner ring-1 ring-primary-100">
            <Lock className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black dark:text-white uppercase tracking-tighter">{t.appName}</h1>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none">Accès Professionnel Unifié</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1">
            <input 
              type="email" 
              placeholder={t.emailAddress} 
              className="w-full p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none font-bold dark:text-white border border-transparent focus:border-primary-500/50 transition-all" 
              value={loginEmail} 
              onChange={e => setLoginEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder={t.password} 
              className="w-full p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none font-bold dark:text-white border border-transparent focus:border-primary-500/50 transition-all" 
              value={loginPassword} 
              onChange={e => setLoginPassword(e.target.value)} 
              required 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button 
            disabled={isLoading} 
            className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all flex justify-center items-center gap-3 disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : t.confirm}
          </button>
        </form>
      </div>
    </div>
  );

  // 2. Vue Lock Screen (PIN)
  const renderLockScreen = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-8 space-y-10 animate-in fade-in duration-500 font-inter">
      <div className="text-center space-y-2">
        <KeyRound className="w-12 h-12 text-primary-600 mx-auto mb-4" />
        <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">{t.secureAccess}</h2>
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{user?.display_name}</p>
      </div>
      
      <div className="flex gap-4">
        {[0,1,2,3].map(i => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full border-2 border-primary-600 transition-all duration-300 ${
              pin.length > i ? 'bg-primary-600 scale-125 shadow-[0_0_15px_rgba(2,132,199,0.5)]' : ''
            }`} 
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-gray-50/50 dark:bg-gray-950/50 backdrop-blur-[1px] flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        )}
        {[1,2,3,4,5,6,7,8,9,'C',0,'DEL'].map(val => (
          <button 
            key={val} 
            disabled={isLoading}
            onClick={() => {
              if (val === 'C') setPin('');
              else if (val === 'DEL') setPin(pin.slice(0,-1));
              else handlePinSubmit(val.toString());
            }} 
            className="w-20 h-20 bg-white dark:bg-gray-900 rounded-full font-black text-xl shadow-sm border border-gray-100 dark:border-gray-800 active:bg-primary-600 active:text-white active:scale-90 transition-all flex items-center justify-center dark:text-white hover:border-primary-500"
          >
            {val}
          </button>
        ))}
      </div>
      <button onClick={handleLogout} className="text-gray-400 font-bold uppercase tracking-widest text-xs hover:text-red-500 transition-colors">{t.logout}</button>
    </div>
  );

  // 3. Vue Compte Suspendu
  const renderSuspended = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center text-center space-y-8 animate-in slide-in-from-bottom-12 duration-700 font-inter p-6">
      <div className="relative">
          <div className="w-32 h-32 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-[3rem] flex items-center justify-center shadow-2xl animate-pulse">
            <ShieldAlert className="w-16 h-16" />
          </div>
          <div className="absolute -top-2 -right-2 w-10 h-10 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center shadow-lg border-2 border-red-500">
              <X className="w-6 h-6 text-red-500" />
          </div>
      </div>
      <div className="space-y-4 max-w-lg">
        <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Accès Interrompu</h2>
        <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
          Votre compte a été suspendu par le gestionnaire système pour non-conformité ou maintenance technique.
        </p>
        <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center">
            <a href={`tel:${currentAgency?.settings?.contact_phone || ''}`} className="px-8 py-4 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/30 hover:scale-105 transition-all flex items-center justify-center gap-2">
                <ExternalLink size={16} /> Contacter le Support
            </a>
            <button onClick={handleLogout} className="px-8 py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">
                Se déconnecter
            </button>
        </div>
      </div>
    </div>
  );

  // 4. Vue Dashboard (Application Principale)
  const renderDashboard = () => (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-[280px] bg-gray-50 dark:bg-gray-950 transition-colors relative font-inter">
      {/* Header Mobile */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b dark:border-gray-800 p-4 flex justify-between lg:hidden items-center">
        <button onClick={handleLogout} className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl active:scale-90 transition-all"><Power size={20}/></button>
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-black">W</div>
            <span className="font-black text-sm dark:text-white uppercase tracking-tighter">Wifi Pro</span>
        </div>
        <button onClick={() => setPinLocked(true)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500 active:scale-90 transition-all"><Lock size={20}/></button>
      </header>

      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-gray-900 border-r dark:border-gray-800 flex-col p-8 overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-primary-500/20">W</div>
          <div>
              <h1 className="text-xl font-black dark:text-white leading-none tracking-tighter">Wifi <span className="text-primary-600">Pro</span></h1>
              <p className="text-[8px] text-gray-400 font-black uppercase tracking-[0.3em] mt-1">Management</p>
          </div>
        </div>
        
        <nav className="space-y-1.5 flex-1">
          <NavItem icon={<LayoutDashboard/>} label={t.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          {canAccess('sales') && <NavItem icon={<ShoppingBag/>} label={t.terminal} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />}
          {canAccess('history') && <NavItem icon={<History/>} label={t.history} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />}
          {canAccess('tickets') && <NavItem icon={<Database/>} label={t.tickets} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />}
          {canAccess('tasks') && <NavItem icon={<ClipboardList/>} label={t.tasks} active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />}
          
          <div className="pt-8 pb-2">
            <p className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-[0.2em] opacity-60">Administration</p>
          </div>
          
          {user!.role === UserRole.SUPER_ADMIN && <NavItem icon={<Building2/>} label={t.agencies} active={activeTab === 'agencies'} onClick={() => setActiveTab('agencies')} />}
          {user!.role !== UserRole.SELLER && <NavItem icon={<Users/>} label={t.users} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />}
          {user!.role !== UserRole.SELLER && <NavItem icon={<Settings/>} label={t.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
        </nav>

        <div className="mt-8 flex gap-3 pt-6 border-t dark:border-gray-800">
          <button onClick={() => setDarkMode(!darkMode)} className="flex-1 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex justify-center text-gray-500 hover:text-primary-500 transition-colors">
            {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
          </button>
          <button onClick={() => setPinLocked(true)} className="flex-1 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex justify-center text-gray-500 hover:text-primary-500 transition-colors">
            <Lock size={20}/>
          </button>
          <button onClick={handleLogout} className="flex-1 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl flex justify-center text-red-400 hover:text-red-600 transition-colors">
            <Power size={20}/>
          </button>
        </div>
      </aside>

      {/* Contenu Principal */}
      <main className="p-6 lg:p-14 max-w-7xl mx-auto w-full">
        <div className="animate-in slide-in-from-bottom-4 duration-500">
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

      {/* Navigation Mobile (Bottom Bar) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border-t dark:border-gray-800 flex justify-around p-5 lg:hidden z-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <MobNavItem icon={<LayoutDashboard/>} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobNavItem icon={<ShoppingBag/>} active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />
        <MobNavItem icon={<Database/>} active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} />
        <MobNavItem icon={<History/>} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <MobNavItem icon={<Settings/>} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>
    </div>
  );

  // --- RENDU PRINCIPAL ---

  return (
    <>
      {/* Toast Notification Système (Global) */}
      {notification && (
        <div className="fixed top-6 right-6 z-[200] animate-in slide-in-from-right duration-500 font-inter">
           <div className={`flex items-center gap-4 px-6 py-4 rounded-3xl shadow-2xl border backdrop-blur-xl ${
             notification.type === 'success' ? 'bg-green-600/90 border-green-400 text-white' :
             notification.type === 'error' ? 'bg-red-600/90 border-red-400 text-white' :
             'bg-blue-600/90 border-blue-400 text-white'
           }`}>
              {notification.type === 'success' && <CheckCircle size={20} />}
              {notification.type === 'error' && <XCircle size={20} />}
              {notification.type === 'info' && <Info size={20} />}
              <span className="text-xs font-black uppercase tracking-tight">{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-50 transition-opacity"><X size={16}/></button>
           </div>
        </div>
      )}

      {/* Switch sur les vues */}
      {currentView === 'LANDING' && <LandingPage onLoginClick={() => setShowLogin(true)} />}
      {currentView === 'LOGIN' && renderLogin()}
      {currentView === 'LOCKED' && renderLockScreen()}
      {currentView === 'SUSPENDED' && renderSuspended()}
      {currentView === 'DASHBOARD' && renderDashboard()}
    </>
  );
};

// --- SOUS-COMPOSANTS ---

const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactElement, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-4 w-full p-4 rounded-2xl font-black text-xs uppercase tracking-[0.1em] transition-all duration-300 ${
      active 
        ? 'bg-primary-600 text-white shadow-xl shadow-primary-500/20 translate-x-2' 
        : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40 hover:text-gray-900 dark:hover:text-white'
    }`}
  >
    {React.cloneElement(icon, { size: 18, strokeWidth: active ? 3 : 2 })} 
    <span className={active ? 'translate-x-1' : ''}>{label}</span>
  </button>
);

const MobNavItem = ({ icon, active, onClick }: { icon: React.ReactElement, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={`p-4 rounded-2xl transition-all duration-300 relative ${
      active 
        ? 'bg-primary-600 text-white scale-110 shadow-lg shadow-primary-500/30 -translate-y-4' 
        : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    {React.cloneElement(icon, { size: 24, strokeWidth: active ? 3 : 2 })}
    {active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>}
  </button>
);

export default App;
