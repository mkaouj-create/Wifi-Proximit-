
import React, { useState, useEffect } from 'react';
import { ClipboardList, Activity, AlertCircle, LogIn, LogOut, ShoppingCart, UserPlus, Building2, UploadCloud, Tag } from 'lucide-react';
import { supabase } from '../services/supabase';
import { UserProfile, ActivityLog } from '../types';
import { translations, Language } from '../i18n';

interface TaskManagerProps {
  user: UserProfile;
  lang: Language;
}

const TaskManager: React.FC<TaskManagerProps> = ({ user, lang }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const t = translations[lang];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const logsData = await supabase.getLogs(user.agency_id, user.role);
    setLogs(logsData);
  };

  // Helper pour les icônes de logs
  const getLogIcon = (action: string) => {
    if (action.includes('LOGIN')) return <LogIn className="w-5 h-5 text-green-500" />;
    if (action.includes('LOGOUT')) return <LogOut className="w-5 h-5 text-gray-400" />;
    if (action.includes('SALE_CANCEL')) return <AlertCircle className="w-5 h-5 text-red-500" />;
    if (action.includes('SALE')) return <ShoppingCart className="w-5 h-5 text-blue-500" />;
    if (action.includes('USER')) return <UserPlus className="w-5 h-5 text-purple-500" />;
    if (action.includes('AGENCY')) return <Building2 className="w-5 h-5 text-indigo-500" />;
    if (action.includes('TICKET_IMPORT')) return <UploadCloud className="w-5 h-5 text-cyan-500" />;
    if (action.includes('TICKET_UPDATE')) return <Tag className="w-5 h-5 text-amber-500" />;
    if (action.includes('TASK')) return <ClipboardList className="w-5 h-5 text-gray-500" />;
    return <Activity className="w-5 h-5 text-gray-300" />;
  };

  // Traduction des actions techniques
  const getActionLabel = (action: string) => {
      const key = `log_${action}`;
      const translation = (t as Record<string, string>)[key];
      return translation || action;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t.activityLog}</h2>
          <p className="text-sm text-gray-500 font-medium">
             Audit complet des actions et événements système
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {logs.map(log => (
                  <div key={log.id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors flex items-center gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl shrink-0">
                          {getLogIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                  {getActionLabel(log.action)}
                              </p>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest shrink-0 ml-2">
                                  {new Date(log.created_at).toLocaleString()}
                              </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
                              <span className="text-primary-600 dark:text-primary-400 font-bold">{log.user_name}</span> : {log.details}
                          </p>
                      </div>
                  </div>
              ))}
                {logs.length === 0 && (
                  <div className="p-12 text-center text-gray-400 font-medium flex flex-col items-center">
                    <Activity className="w-12 h-12 mb-3 opacity-20" />
                    <p>Historique vide.</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default TaskManager;
