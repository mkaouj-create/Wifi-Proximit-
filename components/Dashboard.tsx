
import React from 'react';
import { TrendingUp, ShoppingBag, Database, Users, Building2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { UserProfile, UserRole } from '../types';
import { translations, Language } from '../i18n';

interface DashboardProps {
  user: UserProfile;
  lang: Language;
  onNavigate: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, lang, onNavigate }) => {
  const stats = supabase.getStats(user.agency_id, user.role);
  const t = translations[lang];
  const isSuper = user.role === UserRole.SUPER_ADMIN;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">
          {isSuper ? t.globalStats : t.agencyStats}
        </h2>
        <p className="text-sm text-gray-500 font-medium">
          {isSuper ? t.allAgencies : stats.stockCount + " tickets en stock"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={t.revenue} 
          value={`${stats.revenue.toLocaleString()} ${stats.currency}`} 
          icon={<TrendingUp className="w-5 h-5" />} 
          color="bg-green-500" 
        />
        <StatCard 
          title={t.ticketsSold} 
          value={stats.soldCount} 
          icon={<ShoppingBag className="w-5 h-5" />} 
          color="bg-blue-500" 
        />
        {isSuper ? (
          <StatCard 
            title={t.activeAgencies} 
            value={stats.agencyCount} 
            icon={<Building2 className="w-5 h-5" />} 
            color="bg-purple-500" 
          />
        ) : (
          <StatCard 
            title={t.stockRemaining} 
            value={stats.stockCount} 
            icon={<Database className="w-5 h-5" />} 
            color="bg-amber-500" 
          />
        )}
        <StatCard 
          title={t.activeUsers} 
          value={stats.userCount} 
          icon={<Users className="w-5 h-5" />} 
          color="bg-indigo-500" 
        />
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-bold mb-6">{t.quickShortcuts}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ShortcutButton 
            onClick={() => onNavigate('sales')}
            icon={<ShoppingBag />}
            title={t.quickSale}
            subtitle={lang === 'fr' ? 'Vendre maintenant' : 'Sell now'}
            color="blue"
          />
          
          <ShortcutButton 
            onClick={() => onNavigate('history')}
            icon={<TrendingUp />}
            title={t.history}
            subtitle={lang === 'fr' ? 'Voir les ventes' : 'View sales'}
            color="green"
          />

          {user.role !== UserRole.SELLER && (
            <ShortcutButton 
              onClick={() => onNavigate('tickets')}
              icon={<Database />}
              title={t.importCsv}
              subtitle={lang === 'fr' ? 'Gérer le stock' : 'Manage stock'}
              color="purple"
            />
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-transform hover:scale-[1.02]">
    <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-gray-200 dark:shadow-none`}>
      {icon}
    </div>
    <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">{title}</p>
    <p className="text-2xl font-black truncate text-gray-900 dark:text-white">{value}</p>
  </div>
);

interface ShortcutButtonProps {
  onClick: () => void;
  icon: React.ReactElement;
  title: string;
  subtitle: string;
  color: 'blue' | 'green' | 'purple';
}

const ShortcutButton: React.FC<ShortcutButtonProps> = ({ onClick, icon, title, subtitle, color }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
  };
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-4 p-5 bg-gray-50 dark:bg-gray-700/50 rounded-2xl hover:bg-white dark:hover:bg-gray-700 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm active:scale-95 text-left"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <div>
        <p className="font-black text-sm">{title}</p>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{subtitle}</p>
      </div>
    </button>
  );
};

export default Dashboard;
