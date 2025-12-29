
import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Plus, Edit3, Trash2, X, Search, AlertTriangle, Loader2, Calendar, CreditCard, ChevronRight, Power, PowerOff, ShieldCheck, Clock, CheckSquare, Square, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Agency, UserProfile, AgencyStatus, AgencyModules } from '../types';
import { translations, Language } from '../i18n';
import { Tooltip } from '../App';

interface AgencyManagerProps {
  user: UserProfile;
  lang: Language;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const DURATION_OPTIONS = [
  { id: '7d', label: '7 Jours', days: 7 },
  { id: '14d', label: '14 Jours', days: 14 },
  { id: '1m', label: '1 Mois', days: 30 },
  { id: '2m', label: '2 Mois', days: 60 },
  { id: '3m', label: '3 Mois', days: 90 },
  { id: '5m', label: '5 Mois', days: 150 },
  { id: '12m', label: '12 Mois', days: 365 },
];

const MODULE_OPTIONS: { key: keyof AgencyModules; label: string; desc: string }[] = [
  { key: 'dashboard', label: 'Tableau de Bord', desc: 'Statistiques et KPIs' },
  { key: 'sales', label: 'Terminal de Vente', desc: 'Vente directe de tickets' },
  { key: 'history', label: 'Historique', desc: 'Journal des ventes et rapports' },
  { key: 'tickets', label: 'Gestion Stock', desc: 'Import CSV et inventaire' },
  { key: 'team', label: 'Équipe', desc: 'Gestion des collaborateurs' },
  { key: 'tasks', label: 'Tâches & Logs', desc: 'Audit et suivi des tâches' },
];

const AgencyManager: React.FC<AgencyManagerProps> = ({ user, lang, notify }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [agencyToManage, setAgencyToManage] = useState<Agency | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<Agency | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [newAgencyName, setNewAgencyName] = useState('');
  
  // États de la modale d'abonnement
  const [selectedDurations, setSelectedDurations] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<AgencyModules>({
    dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true
  });
  
  const t = translations[lang];

  useEffect(() => { loadAgencies(); }, []);

  useEffect(() => {
    if (agencyToManage) {
        setSelectedModules(agencyToManage.settings?.modules || {
            dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true
        });
        setSelectedDurations([]); // Reset durées lors de l'ouverture
    }
  }, [agencyToManage]);

  const loadAgencies = async () => {
    const data = await supabase.getAgencies();
    setAgencies(data);
  };

  const totalDaysToAdd = useMemo(() => {
    return selectedDurations.reduce((acc, id) => {
        const opt = DURATION_OPTIONS.find(o => o.id === id);
        return acc + (opt?.days || 0);
    }, 0);
  }, [selectedDurations]);

  const newExpiryDate = useMemo(() => {
    if (!agencyToManage) return null;
    const now = new Date();
    const currentExpiryStr = agencyToManage.expires_at;
    let currentExpiry = currentExpiryStr ? new Date(currentExpiryStr) : now;
    if (isNaN(currentExpiry.getTime())) currentExpiry = now;

    const start = currentExpiry > now ? currentExpiry : now;
    const end = new Date(start);
    end.setDate(end.getDate() + totalDaysToAdd);
    return end;
  }, [agencyToManage, totalDaysToAdd]);

  const handleUpdateSubscription = async () => {
    if (!agencyToManage || isProcessing) return;
    setIsProcessing(true);
    try {
      await supabase.updateSubscription(agencyToManage.id, totalDaysToAdd, selectedModules, user);
      notify('success', `Abonnement de ${agencyToManage.name} mis à jour.`);
      setAgencyToManage(null);
      await loadAgencies();
    } catch (e: any) {
      notify('error', e.message || "Erreur lors de la mise à jour");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleDuration = (id: string) => {
    setSelectedDurations(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleModule = (key: keyof AgencyModules) => {
    setSelectedModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleStatus = async (agency: Agency) => {
    const newStatus: AgencyStatus = agency.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`Voulez-vous vraiment ${newStatus === 'active' ? 'réactiver' : 'suspendre'} cette agence ?`)) return;
    
    setIsProcessing(true);
    await supabase.setAgencyStatus(agency.id, newStatus, user);
    notify('info', `Agence ${agency.name} est maintenant ${newStatus === 'active' ? 'active' : 'suspendue'}.`);
    await loadAgencies();
    setIsProcessing(false);
  };

  const getRemainingInfo = (agency: Agency) => {
    if (agency.status === 'inactive') return { text: 'SUSPENDU', color: 'bg-gray-500 text-white', expired: true };
    if (!agency.expires_at) return { text: 'NON ACTIVÉ', color: 'bg-red-500 text-white', expired: true };
    
    const expiry = new Date(agency.expires_at);
    if (isNaN(expiry.getTime())) return { text: 'ERREUR DATE', color: 'bg-red-500 text-white', expired: true };
    
    const diff = expiry.getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (diff <= 0) return { text: 'ACCÈS EXPIRÉ', color: 'bg-red-500 text-white', expired: true };
    if (days === 1) return { text: 'EXPIRE DEMAIN', color: 'bg-amber-500 text-white', expired: false };
    return { text: `${days} JOURS RESTANTS`, color: 'bg-green-100 text-green-700', expired: false };
  };

  const filtered = agencies.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-none">Gestion Agences</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-2">Pilotage centralisé des comptes</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-3 bg-primary-600 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all">
          <Plus className="w-5 h-5" /> Ajouter Agence
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder="Rechercher une agence..." className="w-full pl-14 pr-6 py-5 bg-white dark:bg-gray-800 border-none rounded-[1.5rem] shadow-sm focus:ring-4 focus:ring-primary-500/10 font-bold dark:text-white" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(agency => {
          const info = getRemainingInfo(agency);
          return (
            <div key={agency.id} className={`bg-white dark:bg-gray-800 rounded-[2.5rem] border p-8 shadow-sm transition-all flex flex-col justify-between group ${info.expired ? 'border-red-100 dark:border-red-900/30 bg-red-50/5' : 'border-gray-100 dark:border-gray-700'}`}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${info.expired ? 'bg-red-100 text-red-600' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600'}`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${info.color}`}>
                    {info.text}
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{agency.name}</h3>
                
                <div className="space-y-3 mb-6 bg-gray-50/50 dark:bg-gray-900/30 p-5 rounded-[1.5rem] border border-gray-50 dark:border-gray-700">
                   <div className="flex items-center justify-between text-[10px] font-bold">
                     <div className="flex items-center gap-2 text-gray-400 uppercase"><Clock size={12}/> Début cycle</div>
                     <span className="text-gray-900 dark:text-white">{agency.activated_at ? new Date(agency.activated_at).toLocaleDateString() : '---'}</span>
                   </div>
                   <div className="flex items-center justify-between text-[10px] font-black">
                     <div className="flex items-center gap-2 text-gray-400 uppercase"><ShieldCheck size={12}/> Échéance</div>
                     <span className={`${info.expired ? 'text-red-500' : 'text-primary-600'}`}>{agency.expires_at ? new Date(agency.expires_at).toLocaleDateString() : '---'}</span>
                   </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-700">
                 <div className="flex gap-2">
                    <Tooltip text="Gérer durée et modules">
                        <button onClick={() => setAgencyToManage(agency)} className="flex items-center gap-2 px-5 py-3.5 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-700 transition-all active:scale-95 shadow-lg shadow-primary-500/20">
                          <CreditCard className="w-4 h-4" /> Abonnement
                        </button>
                    </Tooltip>
                    <Tooltip text={agency.status === 'active' ? 'Suspendre l\'accès' : 'Réactiver l\'accès'}>
                        <button onClick={() => handleToggleStatus(agency)} className={`p-3.5 rounded-xl transition-all active:scale-95 ${agency.status === 'active' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                          {agency.status === 'active' ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                    </Tooltip>
                 </div>
                 <Tooltip text="Supprimer définitivement">
                    <button onClick={() => setAgencyToDelete(agency)} className="p-3.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl hover:bg-red-100 active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></button>
                 </Tooltip>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALE ABONNEMENT COMPLÈTE */}
      {agencyToManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh] no-scrollbar border border-white/5">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl flex items-center justify-center">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black dark:text-white leading-tight">Gérer l'Abonnement</h3>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{agencyToManage.name}</p>
                    </div>
                </div>
                <button onClick={() => setAgencyToManage(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-white transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Section Durées */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">1. Choisir Durée (Cumulable)</label>
                    <div className="grid grid-cols-1 gap-2">
                        {DURATION_OPTIONS.map(opt => {
                            const isSelected = selectedDurations.includes(opt.id);
                            return (
                                <Tooltip key={opt.id} text={`Ajoute exactement ${opt.days} jours au cycle`}>
                                    <button 
                                        onClick={() => toggleDuration(opt.id)}
                                        className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between font-bold text-sm ${
                                            isSelected 
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600' 
                                            : 'border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-500'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isSelected ? <CheckSquare className="w-5 h-5 text-primary-600" /> : <Square className="w-5 h-5" />}
                                            <span>{opt.label}</span>
                                        </div>
                                        <span className="text-[10px] font-black opacity-50">+{opt.days}j</span>
                                    </button>
                                </Tooltip>
                            );
                        })}
                    </div>
                </div>

                {/* Section Modules */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">2. Modules autorisés</label>
                    <div className="grid grid-cols-1 gap-2">
                        {MODULE_OPTIONS.map(opt => {
                            const isEnabled = selectedModules[opt.key];
                            return (
                                <Tooltip key={opt.key} text={opt.desc}>
                                    <button 
                                        onClick={() => toggleModule(opt.key)}
                                        className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between text-left ${
                                            isEnabled 
                                            ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 opacity-60'
                                        }`}
                                    >
                                        <div>
                                            <p className={`text-sm font-black ${isEnabled ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>{opt.label}</p>
                                            <p className="text-[9px] text-gray-400 font-medium uppercase tracking-tighter">{opt.desc}</p>
                                        </div>
                                        {isEnabled ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-300" />}
                                    </button>
                                </Tooltip>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Aperçu Résultat */}
            <div className="mt-10 p-6 bg-gray-50 dark:bg-gray-900 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                            <Info size={14} className="text-primary-500" /> Aperçu de l'activation
                        </div>
                        <p className="text-sm font-bold dark:text-white">
                            Ajout : <span className="text-primary-600">{totalDaysToAdd} jours</span>
                        </p>
                        <p className="text-xs text-gray-500">
                            {totalDaysToAdd > 0 ? (
                                <>Nouvelle échéance : <span className="font-black text-gray-900 dark:text-white">{newExpiryDate?.toLocaleDateString() || '---'}</span></>
                            ) : (
                                <span className="italic">Mise à jour des modules uniquement</span>
                            )}
                        </p>
                    </div>
                    <button 
                        disabled={isProcessing}
                        onClick={handleUpdateSubscription}
                        className="px-8 py-4 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-3"
                    >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                        Mettre à jour
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Suppression */}
      {agencyToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black mb-4 dark:text-white">Supprimer Agence</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">Cette action supprimera toutes les données liées à <span className="font-black text-red-500">"{agencyToDelete.name}"</span>.</p>
            <div className="flex flex-col gap-3">
              <button onClick={async () => { await supabase.deleteAgency(agencyToDelete.id); notify('info', 'Agence supprimée'); setAgencyToDelete(null); loadAgencies(); }} className="w-full py-5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-red-500/30 active:scale-95 transition-all">Confirmer Suppression</button>
              <button onClick={() => setAgencyToDelete(null)} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-2xl font-black text-xs uppercase active:scale-95 transition-all">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout Rapide */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black dark:text-white">Nouvelle Agence</h3>
              <button onClick={() => setShowAdd(false)} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl dark:text-white"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={async (e) => { e.preventDefault(); if(!newAgencyName) return; await supabase.addAgency(newAgencyName); notify('success', `Agence ${newAgencyName} créée.`); setNewAgencyName(''); setShowAdd(false); loadAgencies(); }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nom commercial</label>
                <input type="text" className="w-full px-7 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold dark:text-white" value={newAgencyName} onChange={(e) => setNewAgencyName(e.target.value)} required placeholder="Ex: Cyber Pro Conakry" />
              </div>
              <button type="submit" className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/30">Créer l'agence</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyManager;
