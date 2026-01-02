
import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, ShoppingBag, Database, Users, Building2, RefreshCcw, Coins } from 'lucide-react';
import { supabase } from '../services/supabase';
import { UserProfile, UserRole } from '../types';
import { translations, Language } from '../i18n';

const Dashboard: React.FC<{ user: UserProfile, lang: Language, onNavigate: (t: string) => void, notify: (t: any, m: any) => void }> = ({ user, lang, onNavigate, notify }) => {
  const [stats, setStats] = useState({ revenue: 0, soldCount: 0, stockCount: 0, agencyCount: 0, userCount: 0, currency: 'XOF', credits: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const t = translations[lang];

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const data = await supabase.getStats(user.agency_id, user.role);
      setStats(data);
    } catch (err) {
      notify('error', 'Sync échouée');
    } finally {
      if (!silent) setTimeout(() => setIsSyncing(false), 500);
    }
  }, [user, notify]);

  useEffect(() => { load(true); }, [load]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black dark:text-white uppercase">{t.dashboard}</h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{user.display_name} • {user.role}</p>
        </div>
        <button onClick={() => load()} disabled={isSyncing} className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700 active:scale-95 transition-all">
          <RefreshCcw size={18} className={isSyncing ? 'animate-spin text-primary-500' : 'text-gray-400'} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t.revenue} val={stats.revenue.toLocaleString()} unit={stats.currency} icon={<TrendingUp/>} color="bg-green-500" />
        <StatCard title="Crédits" val={stats.credits.toFixed(1)} icon={<Coins/>} color="bg-primary-600" />
        <StatCard title={t.stockRemaining} val={stats.stockCount} icon={<Database/>} color="bg-amber-500" />
        <StatCard title={t.activeUsers} val={stats.userCount} icon={<Users/>} color="bg-indigo-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-sm border dark:border-gray-700">
        <h3 className="text-lg font-black dark:text-white uppercase mb-6">{t.quickShortcuts}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Shortcut onClick={() => onNavigate('sales')} title={t.quickSale} icon={<ShoppingBag/>} color="bg-blue-50 text-blue-600" />
          <Shortcut onClick={() => onNavigate('tickets')} title={t.importCsv} icon={<Database/>} color="bg-amber-50 text-amber-600" />
          <Shortcut onClick={() => onNavigate('history')} title={t.history} icon={<TrendingUp/>} color="bg-green-50 text-green-600" />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, val, unit, icon, color }: any) => (
  <div className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border dark:border-gray-700 flex flex-col justify-between h-36 shadow-sm hover:shadow-md transition-all group">
    <div className={`w-10 h-10 ${color} text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
      {React.cloneElement(icon, { size: 18 })}
    </div>
    <div>
      <p className="text-[9px] text-gray-400 font-black uppercase mb-1">{title}</p>
      <p className="text-xl font-black dark:text-white uppercase leading-none">{val} <span className="text-[10px] opacity-40">{unit}</span></p>
    </div>
  </div>
);

const Shortcut = ({ onClick, title, icon, color }: any) => (
  <button onClick={onClick} className="flex items-center gap-4 p-4 bg-gray-50/50 dark:bg-gray-700/30 rounded-2xl hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 transition-all text-left">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
    <span className="font-black text-xs dark:text-white uppercase tracking-tight">{title}</span>
  </button>
);

export default Dashboard;
