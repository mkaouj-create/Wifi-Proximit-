
import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit3, Trash2, Power, PowerOff, X, Search, AlertTriangle, Loader2, Layers, CheckCircle2, Database, Sparkles, Clock } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Agency, UserProfile, AgencyModules, UserRole } from '../types';
import { translations, Language } from '../i18n';

interface AgencyManagerProps {
  user: UserProfile;
  lang: Language;
}

const ModuleToggle = ({ label, checked, onChange, disabled = false }: { label: string, checked: boolean, onChange: () => void, disabled?: boolean }) => (
  <button 
      type="button"
      onClick={!disabled ? onChange : undefined}
      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border outline-none focus:ring-2 focus:ring-primary-500/20 ${
          checked 
          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800' 
          : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 opacity-80'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-600'}`}
  >
      <span className={`font-bold text-xs text-left ${checked ? 'text-primary-700 dark:text-primary-300' : 'text-gray-500'}`}>{label}</span>
      <div className={`w-10 h-6 rounded-full flex items-center transition-colors p-1 ${checked ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
  </button>
);

const AgencyManager: React.FC<AgencyManagerProps> = ({ user, lang }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<Agency | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [agencyToToggle, setAgencyToToggle] = useState<Agency | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  
  const [newAgencyName, setNewAgencyName] = useState('');
  const [editName, setEditName] = useState('');
  
  const defaultModules: AgencyModules = {
    dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true
  };
  
  const [editModules, setEditModules] = useState<AgencyModules>(defaultModules);
  const [search, setSearch] = useState('');
  
  const t = translations[lang];

  useEffect(() => {
    loadAgencies();
  }, []);

  useEffect(() => {
    if (editingAgency) {
      setEditName(editingAgency.name);
      setEditModules({
        ...defaultModules,
        ...(editingAgency.settings?.modules || {})
      });
    }
  }, [editingAgency]);

  const loadAgencies = async () => {
    const data = await supabase.getAgencies();
    setAgencies(data);
  };

  const handleCleanup = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    try {
        await supabase.cleanupOldData(user);
        await loadAgencies();
        alert(t.dataOptimized);
    } catch (e) {
        console.error(e);
    } finally {
        setIsCleaning(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgencyName.trim()) return;
    await supabase.addAgency(newAgencyName);
    setNewAgencyName('');
    setShowAdd(false);
    loadAgencies();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgency || !editName.trim()) return;
    setProcessingId(editingAgency.id);
    const updatedSettings = {
        ...editingAgency.settings,
        modules: editModules
    };
    await supabase.updateAgency(editingAgency.id, editName, updatedSettings);
    setProcessingId(null);
    setEditingAgency(null);
    loadAgencies();
  };

  const executeToggleStatus = async () => {
    if (!agencyToToggle) return;
    const agency = agencyToToggle;
    setAgencyToToggle(null);
    setProcessingId(agency.id);
    try {
      const nextStatus = agency.status === 'active' ? 'inactive' : 'active';
      await supabase.updateAgency(agency.id, agency.name, agency.settings || {}, nextStatus);
      await loadAgencies();
    } finally {
      setProcessingId(null);
    }
  };

  const confirmDelete = async () => {
    if (agencyToDelete) {
      await supabase.deleteAgency(agencyToDelete.id);
      setAgencyToDelete(null);
      loadAgencies();
    }
  };

  const filtered = agencies.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white">{t.agencies}</h2>
          <p className="text-sm text-gray-500 font-medium">Gestion globale du réseau Wifi</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={handleCleanup}
                disabled={isCleaning}
                className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 hover:text-primary-600 active:scale-95 transition-all shadow-sm"
            >
                {isCleaning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                {isCleaning ? t.cleaning : t.cleanupNow}
            </button>
            <button 
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-3 bg-primary-600 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
              {t.addAgency}
            </button>
        </div>
      </div>

      {/* Info Rétention */}
      <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-900/20 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-3xl flex items-center justify-center shrink-0">
              <Clock className="w-8 h-8" />
          </div>
          <div className="flex-1 text-center md:text-left">
              <h3 className="font-black text-gray-900 dark:text-white">{t.dataRetention} (5 mois)</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">{t.cleanupDesc}</p>
          </div>
          <div className="bg-white dark:bg-gray-950 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/20 text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t.lastCleanup}</p>
              <p className="text-sm font-black text-gray-900 dark:text-white">
                  {agencies.length > 0 && agencies[0].settings?.last_cleanup_at 
                    ? new Date(agencies[0].settings.last_cleanup_at).toLocaleDateString()
                    : '---'
                  }
              </p>
          </div>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text"
          placeholder="Rechercher une agence..."
          className="w-full pl-14 pr-6 py-5 bg-white dark:bg-gray-800 border-none rounded-[1.5rem] shadow-sm focus:ring-4 focus:ring-primary-500/10 font-bold"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(agency => (
          <div key={agency.id} className={`bg-white dark:bg-gray-800 rounded-[2rem] border p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group ${agency.status === 'inactive' ? 'border-red-100 dark:border-red-900/30 opacity-75' : 'border-gray-100 dark:border-gray-700'}`}>
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                    agency.status === 'active' 
                    ? 'bg-gray-50 dark:bg-gray-700 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600' 
                    : 'bg-red-50 dark:bg-red-900/20 text-red-400'
                }`}>
                  <Building2 className="w-8 h-8" />
                </div>
                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                  agency.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {agency.status === 'active' ? t.active : t.inactive}
                </span>
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{agency.name}</h3>
              <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Archivé: {agency.settings?.archived_revenue?.toLocaleString() || 0} {agency.settings?.currency || 'GNF'}
                  </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 pt-6 border-t border-gray-50 dark:border-gray-700">
               <button 
                  onClick={() => setAgencyToToggle(agency)}
                  disabled={processingId === agency.id}
                  className={`p-3 rounded-xl transition-all active:scale-90 flex items-center justify-center min-w-[3rem] ${
                    processingId === agency.id 
                      ? 'bg-gray-100 text-gray-400 cursor-wait'
                      : agency.status === 'active' 
                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
               >
                 {processingId === agency.id ? <Loader2 className="w-5 h-5 animate-spin" /> : (agency.status === 'active' ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />)}
               </button>
               <div className="flex items-center gap-3">
                 <button onClick={() => setEditingAgency(agency)} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 active:scale-90 transition-all">
                   <Edit3 className="w-5 h-5" />
                 </button>
                 <button onClick={() => setAgencyToDelete(agency)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 active:scale-90 transition-all">
                   <Trash2 className="w-5 h-5" />
                 </button>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal d'Ajout d'Agence */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black">{t.addAgency}</h3>
              <button onClick={() => setShowAdd(false)} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t.agencyName}</label>
                <input type="text" className="w-full px-7 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold" value={newAgencyName} onChange={(e) => setNewAgencyName(e.target.value)} required />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest">{t.cancel}</button>
                <button type="submit" className="flex-1 py-5 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/30">{t.confirm}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Modification */}
      {editingAgency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black">{t.editAgency}</h3>
              <button onClick={() => setEditingAgency(null)} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t.agencyName}</label>
                <input type="text" className="w-full px-7 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-5 h-5 text-primary-600" />
                    <h4 className="font-black text-lg">{t.modulesPermissions}</h4>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ModuleToggle label={t.enableDashboard} checked={editModules.dashboard} onChange={() => setEditModules(p => ({...p, dashboard: !p.dashboard}))} />
                    <ModuleToggle label={t.enableSales} checked={editModules.sales} onChange={() => setEditModules(p => ({...p, sales: !p.sales}))} />
                    <ModuleToggle label={t.enableHistory} checked={editModules.history} onChange={() => setEditModules(p => ({...p, history: !p.history}))} />
                    <ModuleToggle label={t.enableTickets} checked={editModules.tickets} onChange={() => setEditModules(p => ({...p, tickets: !p.tickets}))} />
                    <ModuleToggle label={t.enableTeam} checked={editModules.team} onChange={() => setEditModules(p => ({...p, team: !p.team}))} />
                    <ModuleToggle label={t.enableTasks} checked={editModules.tasks} onChange={() => setEditModules(p => ({...p, tasks: !p.tasks}))} />
                 </div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                <button type="button" onClick={() => setEditingAgency(null)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest">{t.cancel}</button>
                <button type="submit" className="flex-1 py-5 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/30 flex items-center justify-center gap-2">
                    {processingId === editingAgency.id && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Suppression */}
      {agencyToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">{t.deleteAgency}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
              {t.confirmDelete} <br/><span className="font-black text-red-500 mt-2 block">"{agencyToDelete.name}"</span>
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} className="w-full py-5 bg-red-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-red-500/30 active:scale-95 transition-all">{t.confirm}</button>
              <button onClick={() => setAgencyToDelete(null)} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Toggle Status */}
      {agencyToToggle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">{t.confirmActionTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
              {t.confirmToggleAgency} <br/><span className="font-bold block mt-2">{agencyToToggle.name}</span>
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={executeToggleStatus} className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all">{t.confirm}</button>
              <button onClick={() => setAgencyToToggle(null)} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">{t.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyManager;
