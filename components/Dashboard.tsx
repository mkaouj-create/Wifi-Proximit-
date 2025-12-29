
import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, ShoppingBag, Database, Users, Building2, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { UserProfile, UserRole } from '../types';
import { translations, Language } from '../i18n';

const Dashboard: React.FC<{ user: UserProfile, lang: Language, onNavigate: (t: string) => void }> = ({ user, lang, onNavigate }) => {
  const [stats, setStats] = useState({ revenue: 0, soldCount: 0, stockCount: 0, agencyCount: 0, userCount: 0, currency: 'GNF' });
  const [isSyncing, setIsSyncing] = useState(false);
  const t = translations[lang];

  const load = useCallback(async () => {
    setIsSyncing(true);
    const data = await supabase.getStats(user.agency_id, user.role);
    setStats(data);
    setTimeout(() => setIsSyncing(false), 500);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const isConnected = supabase.isConfigured();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-black dark:text-white">
              {user.role === UserRole.SUPER_ADMIN ? t.globalStats : t.agencyStats}
            </h2>
            <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${isConnected ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {isConnected ? 'Sync OK' : 'Offline'}
            </div>
          </div>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Version stable • 10:30</p>
        </div>
        <button 
          onClick={load} 
          disabled={isSyncing}
          className="text-[10px] font-black uppercase text-primary-600 tracking-widest flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 px-4 py-2 rounded-full hover:bg-primary-100 transition-all"
        >
          {isSyncing ? 'Synchronisation...' : 'Actualiser'}
          <CheckCircle size={12} className={isSyncing ? 'animate-spin' : ''} />
        </button>
      </div>

      {!isConnected && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl flex items-center gap-3 border border-red-100 dark:border-red-900/30 text-red-600">
          <AlertCircle size={18} />
          <p className="text-xs font-bold uppercase">Configuration Supabase manquante. L'application tourne en mode démo.</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card title={t.revenue} val={`${stats.revenue.toLocaleString()} ${stats.currency}`} icon={<TrendingUp/>} color="bg-green-500" />
        <Card title={t.ticketsSold} val={stats.soldCount} icon={<ShoppingBag/>} color="bg-blue-500" />
        <Card title={user.role === UserRole.SUPER_ADMIN ? t.activeAgencies : t.stockRemaining} val={user.role === UserRole.SUPER_ADMIN ? stats.agencyCount : stats.stockCount} icon={user.role === UserRole.SUPER_ADMIN ? <Building2/> : <Database/>} color="bg-amber-500" />
        <Card title={t.activeUsers} val={stats.userCount} icon={<Users/>} color="bg-indigo-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-sm border dark:border-gray-700">
        <h3 className="text-lg font-black mb-6 dark:text-white">{t.quickShortcuts}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Shortcut onClick={() => onNavigate('sales')} title={t.quickSale} icon={<ShoppingBag/>} desc="Terminal de vente rapide" color="bg-blue-50 text-blue-600" />
          <Shortcut onClick={() => onNavigate('history')} title={t.history} icon={<TrendingUp/>} desc="Rapports & Historique" color="bg-green-50 text-green-600" />
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, val, icon, color }: any) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border dark:border-gray-700 hover:scale-[1.02] transition-all">
    <div className={`w-10 h-10 ${color} text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-current/20`}>{React.cloneElement(icon, { size: 20 })}</div>
    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">{title}</p>
    <p className="text-xl font-black dark:text-white truncate">{val}</p>
  </div>
);

const Shortcut = ({ onClick, title, icon, desc, color }: any) => (
  <button onClick={onClick} className="flex items-center gap-4 p-5 bg-gray-50 dark:bg-gray-700/50 rounded-2xl hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 transition-all text-left group">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${color}`}>{React.cloneElement(icon, { size: 24 })}</div>
    <div className="flex-1">
      <p className="font-black text-sm dark:text-white">{title}</p>
      <p className="text-[10px] text-gray-400 font-bold uppercase">{desc}</p>
    </div>
    <ChevronRight className="text-gray-300 group-hover:text-primary-500 transition-colors" size={16} />
  </button>
);

export default Dashboard;
