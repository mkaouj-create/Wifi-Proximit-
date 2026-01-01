import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, ShoppingBag, Database, Users, Building2, ChevronRight, AlertCircle, RefreshCcw, Coins } from 'lucide-react';
import { supabase } from '../services/supabase';
import { UserProfile, UserRole } from '../types';
import { translations, Language } from '../i18n';

interface DashboardProps {
  user: UserProfile;
  lang: Language;
  onNavigate: (t: string) => void;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, lang, onNavigate, notify }) => {
  const [stats, setStats] = useState({ revenue: 0, soldCount: 0, stockCount: 0, agencyCount: 0, userCount: 0, currency: 'GNF', credits: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const t = translations[lang];

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const data = await supabase.getStats(user.agency_id, user.role);
      setStats(data);
      if (!silent) notify('info', 'Données à jour');
    } catch (err) {
      notify('error', 'Échec de synchronisation');
    } finally {
      if (!silent) setTimeout(() => setIsSyncing(false), 500);
    }
  }, [user, notify]);

  useEffect(() => { load(true); }, [load]);

  const isConnected = supabase.isConfigured();

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="text-2xl md:text-3xl font-black dark:text-white tracking-tight leading-none uppercase">
              {user.role === UserRole.SUPER_ADMIN ? t.globalStats : t.dashboard}
            </h2>
            <div className={`px-2.5 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isConnected ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 text-red-600'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
              {isConnected ? 'LIVE SYNC' : 'OFFLINE'}
            </div>
          </div>
          <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-[0.2em]">{user.display_name} • {user.role.replace('_', ' ')}</p>
        </div>
        <button 
          onClick={() => load()} 
          disabled={isSyncing}
          className="group flex items-center justify-center gap-3 bg-white dark:bg-gray-800 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-sm border dark:border-gray-700 hover:border-primary-500 transition-all active:scale-95 w-full md:w-auto"
        >
          {isSyncing ? <RefreshCcw className="w-4 h-4 animate-spin text-primary-500" /> : <RefreshCcw className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />}
          {isSyncing ? 'MAJ...' : 'Actualiser'}
        </button>
      </div>

      {!isConnected && (
        <div className="bg-red-50 dark:bg-red-900/20 p-5 md:p-6 rounded-3xl md:rounded-[2rem] flex items-center gap-4 border border-red-100 dark:border-red-900/30 text-red-600 animate-pulse">
          <AlertCircle size={24} className="shrink-0" />
          <div>
              <p className="text-[11px] md:text-sm font-black uppercase tracking-tight">Configuration Requise</p>
              <p className="text-[10px] md:text-xs opacity-80 font-medium">Système hors ligne. Vérifiez vos identifiants.</p>
          </div>
        </div>
      )}

      {/* STATS GRID - Gap réduit sur mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard title={t.revenue} val={`${stats.revenue.toLocaleString()}`} unit={stats.currency} icon={<TrendingUp/>} color="bg-green-500" trend="+12%" />
        <StatCard title="Solde Crédits" val={stats.credits} icon={<Coins/>} color="bg-primary-600" trend={stats.credits < 5 ? "Faible" : undefined} />
        <StatCard title={user.role === UserRole.SUPER_ADMIN ? t.activeAgencies : t.stockRemaining} val={user.role === UserRole.SUPER_ADMIN ? stats.agencyCount : stats.stockCount} icon={user.role === UserRole.SUPER_ADMIN ? <Building2/> : <Database/>} color="bg-amber-500" />
        <StatCard title={t.activeUsers} val={stats.userCount} icon={<Users/>} color="bg-indigo-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ACTIONS GRID */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] shadow-sm border dark:border-gray-700">
            <div className="flex items-center justify-between mb-6 md:mb-8">
                <h3 className="text-lg md:text-xl font-black dark:text-white tracking-tight uppercase">Actions Rapides</h3>
                <span className="hidden md:inline text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded-lg">Raccourcis</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <Shortcut onClick={() => onNavigate('sales')} title={t.quickSale} icon={<ShoppingBag/>} desc="Terminal de vente rapide" color="bg-blue-50 dark:bg-blue-900/20 text-blue-600" />
                <Shortcut onClick={() => onNavigate('history')} title={t.history} icon={<TrendingUp/>} desc="Analyses & Historique" color="bg-green-50 dark:bg-green-900/20 text-green-600" />
                <Shortcut onClick={() => onNavigate('tickets')} title={t.tickets} icon={<Database/>} desc="Inventaire & Importation" color="bg-amber-50 dark:bg-amber-900/20 text-amber-600" />
                <Shortcut onClick={() => onNavigate('settings')} title={t.settings} icon={<Building2/>} desc="Configuration Agence" color="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" />
            </div>
        </div>
        
        {/* CONSUMPTION CARD */}
        <div className="bg-primary-600 p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] shadow-2xl shadow-primary-500/30 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <TrendingUp size={160} />
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Système Crédits</p>
                <h4 className="text-xl md:text-3xl font-black leading-tight uppercase">Consommation</h4>
            </div>
            <div className="mt-8 space-y-5 md:space-y-6">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] md:text-xs font-bold opacity-80 uppercase tracking-widest">Solde Disponible</span>
                    <span className="text-lg md:text-xl font-black">{stats.credits} Crédits</span>
                </div>
                <div className="w-full bg-white/20 h-2 md:h-2.5 rounded-full overflow-hidden">
                    <div className="bg-white h-full transition-all duration-1000" style={{ width: `${Math.min(100, (stats.credits / 100) * 100)}%` }}></div>
                </div>
                <div className="text-[9px] font-black uppercase opacity-60 leading-tight">
                   Rappel : 1 crédit permet d'importer 20 tickets.
                </div>
                <button onClick={() => onNavigate('settings')} className="w-full py-4 md:py-5 bg-white text-primary-600 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                    Historique Crédits
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, val, unit, icon, color, trend }: any) => (
  <div className="bg-white dark:bg-gray-800 p-4 md:p-8 rounded-3xl md:rounded-[2.5rem] shadow-sm border dark:border-gray-700 hover:border-primary-500 transition-all duration-300 group flex flex-col justify-between h-full min-h-[140px] md:min-h-[180px]">
    <div className="flex justify-between items-start mb-2 md:mb-6">
        <div className={`w-10 h-10 md:w-14 md:h-14 ${color} text-white rounded-xl md:rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-current/20 group-hover:scale-110 transition-transform`}>
            {React.cloneElement(icon, { size: 20, strokeWidth: 2.5 })}
        </div>
        {trend && (
            <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${trend === 'Faible' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                {trend}
            </span>
        )}
    </div>
    <div>
        <p className="text-[8px] md:text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1 truncate">{title}</p>
        <p className="text-lg md:text-2xl font-black dark:text-white tracking-tight uppercase leading-none truncate">
            {val} <span className="text-[10px] opacity-60 ml-0.5">{unit}</span>
        </p>
    </div>
  </div>
);

const Shortcut = ({ onClick, title, icon, desc, color }: any) => (
  <button onClick={onClick} className="flex items-center gap-3 md:gap-5 p-4 md:p-5 bg-gray-50/50 dark:bg-gray-700/30 rounded-2xl md:rounded-3xl hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all text-left group">
    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-6 ${color}`}>
        {React.cloneElement(icon, { size: 18, strokeWidth: 2.5 })}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-black text-xs md:text-sm dark:text-white mb-0.5 tracking-tight uppercase truncate">{title}</p>
      <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-tight leading-none truncate">{desc}</p>
    </div>
    <ChevronRight className="text-gray-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all shrink-0 hidden sm:block" size={18} />
  </button>
);

export default Dashboard;