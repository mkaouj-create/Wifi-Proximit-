
import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit3, Trash2, X, Search, AlertTriangle, Loader2, ShieldCheck, Coins, ToggleLeft, ToggleRight, Info, Power, PowerOff, Save, Calendar, Star } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Agency, UserProfile, AgencyStatus, AgencyModules } from '../types';
import { translations, Language } from '../i18n';
import { Tooltip } from '../App';

interface AgencyManagerProps {
  user: UserProfile;
  lang: Language;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const MODULE_OPTIONS: { key: keyof AgencyModules; label: string; desc: string }[] = [
  { key: 'dashboard', label: 'Tableau de Bord', desc: 'Statistiques et KPIs' },
  { key: 'sales', label: 'Terminal de Vente', desc: 'Vente directe de tickets' },
  { key: 'history', label: 'Historique', desc: 'Journal des ventes et rapports' },
  { key: 'tickets', label: 'Gestion Stock', desc: 'Import CSV et inventaire' },
  { key: 'team', label: 'Équipe', desc: 'Gestion des collaborateurs' },
  { key: 'tasks', label: 'Tâches & Logs', desc: 'Audit et suivi des tâches' },
];

const PLAN_OPTIONS = [
  { name: 'Starter', months: 3, price: '50 000 FG' },
  { name: 'Professional', months: 6, price: '90 000 FG' },
  { name: 'Business', months: 12, price: '150 000 FG' },
];

const AgencyManager: React.FC<AgencyManagerProps> = ({ user, lang, notify }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [agencyToManage, setAgencyToManage] = useState<Agency | null>(null);
  const [agencyToRecharge, setAgencyToRecharge] = useState<Agency | null>(null);
  const [agencyToSubscribe, setAgencyToSubscribe] = useState<Agency | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<Agency | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [newAgencyName, setNewAgencyName] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('10');
  const [rechargeDesc, setRechargeDesc] = useState('Recharge manuelle');
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
    }
  }, [agencyToManage]);

  const loadAgencies = async () => {
    const data = await supabase.getAgencies();
    setAgencies(data);
  };

  const handleUpdateModules = async () => {
    if (!agencyToManage || isProcessing) return;
    setIsProcessing(true);
    try {
      await supabase.updateAgencyModules(agencyToManage.id, selectedModules, user);
      notify('success', `Modules de ${agencyToManage.name} mis à jour.`);
      setAgencyToManage(null);
      await loadAgencies();
    } catch (e: any) {
      notify('error', e.message || "Erreur.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyToRecharge || isProcessing) return;
    setIsProcessing(true);
    try {
      await supabase.addCredits(agencyToRecharge.id, parseInt(rechargeAmount), user.id, rechargeDesc);
      notify('success', `${rechargeAmount} crédits ajoutés.`);
      setAgencyToRecharge(null);
      setRechargeAmount('10');
      await loadAgencies();
    } catch (e: any) {
      notify('error', "Échec recharge");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActivateSubscription = async (plan: any) => {
    if (!agencyToSubscribe || isProcessing) return;
    setIsProcessing(true);
    try {
        await supabase.updateSubscription(agencyToSubscribe.id, plan.name, plan.months, user);
        notify('success', `Abonnement ${plan.name} activé pour ${agencyToSubscribe.name}`);
        setAgencyToSubscribe(null);
        await loadAgencies();
    } catch (e) {
        notify('error', "Erreur activation");
    } finally {
        setIsProcessing(false);
    }
  };

  const toggleModule = (key: keyof AgencyModules) => {
    setSelectedModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleStatus = async (agency: Agency) => {
    const newStatus: AgencyStatus = agency.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`Voulez-vous vraiment changer l'état ?`)) return;
    setIsProcessing(true);
    await supabase.setAgencyStatus(agency.id, newStatus, user);
    notify('info', `Statut mis à jour.`);
    await loadAgencies();
    setIsProcessing(false);
  };

  const filtered = agencies.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-none tracking-tight">Gestion des Partenaires</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-2">Pilotage SaaS & Licences</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-3 bg-primary-600 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all">
          <Plus className="w-5 h-5" /> Nouveau Compte
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder="Rechercher par nom d'agence..." className="w-full pl-14 pr-6 py-5 bg-white dark:bg-gray-800 border-none rounded-[1.5rem] shadow-sm focus:ring-4 focus:ring-primary-500/10 font-bold dark:text-white" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(agency => {
          const isActive = agency.status === 'active';
          const isExpired = !supabase.isSubscriptionActive(agency);
          return (
            <div key={agency.id} className={`bg-white dark:bg-gray-800 rounded-[2.5rem] border p-8 shadow-sm transition-all flex flex-col justify-between group h-full ${!isActive ? 'border-red-100 dark:border-red-900/30 bg-red-50/5' : 'border-gray-100 dark:border-gray-700'}`}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${!isActive ? 'bg-red-100 text-red-600' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600'}`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                      <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-500 text-white'}`}>
                        {isActive ? 'ACTIF' : 'SUSPENDU'}
                      </div>
                      {isExpired && isActive && (
                          <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[8px] font-black uppercase">Expiré</div>
                      )}
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4 leading-tight">{agency.name}</h3>
                
                <div className="space-y-4 mb-8">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <Coins size={16} className="text-amber-500" />
                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Crédits</span>
                        </div>
                        <p className="font-black text-lg dark:text-white">{agency.credits_balance}</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <Calendar size={16} className="text-blue-500" />
                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Échéance</span>
                        </div>
                        <p className={`font-black text-xs ${isExpired ? 'text-red-500' : 'dark:text-white'}`}>
                            {agency.subscription_end ? new Date(agency.subscription_end).toLocaleDateString() : 'N/A'}
                        </p>
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-6 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setAgencyToSubscribe(agency)} className="flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
                    <Star className="w-3.5 h-3.5" /> Licence
                </button>
                <button onClick={() => setAgencyToRecharge(agency)} className="flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all active:scale-95 shadow-lg shadow-amber-500/20">
                    <Plus className="w-3.5 h-3.5" /> Crédits
                </button>
                <button onClick={() => setAgencyToManage(agency)} className="flex items-center justify-center gap-2 py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95">
                    <Edit3 className="w-3.5 h-3.5" /> Modules
                </button>
                <button onClick={() => handleToggleStatus(agency)} className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />} {isActive ? 'Bloquer' : 'Activer'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALE GESTION ABONNEMENT */}
      {agencyToSubscribe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300">
             <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Star size={32} />
                </div>
                <h3 className="text-2xl font-black dark:text-white tracking-tight">Activer une Licence</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{agencyToSubscribe.name}</p>
             </div>

             <div className="space-y-3 mb-10">
                {PLAN_OPTIONS.map(plan => (
                    <button 
                        key={plan.name}
                        onClick={() => handleActivateSubscription(plan)}
                        className="w-full p-6 bg-gray-50 dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-2 border-transparent hover:border-indigo-500 rounded-[1.5rem] flex items-center justify-between transition-all group"
                    >
                        <div className="text-left">
                            <p className="font-black dark:text-white">{plan.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{plan.months} Mois de validité</p>
                        </div>
                        <div className="text-right">
                            <p className="font-black text-indigo-600">{plan.price}</p>
                            <p className="text-[9px] text-gray-400 uppercase">Usage illimité</p>
                        </div>
                    </button>
                ))}
             </div>

             <button onClick={() => setAgencyToSubscribe(null)} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest">Annuler</button>
          </div>
        </div>
      )}

      {/* MODALE GESTION MODULES */}
      {agencyToManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 border border-white/5">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl flex items-center justify-center"><Building2 className="w-6 h-6" /></div>
                    <div><h3 className="text-2xl font-black dark:text-white leading-tight">Accès Modules</h3><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{agencyToManage.name}</p></div>
                </div>
                <button onClick={() => setAgencyToManage(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-white transition-colors"><X size={24} /></button>
            </div>
            <div className="space-y-4 mb-8">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Configuration des autorisations</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {MODULE_OPTIONS.map(opt => {
                        const isEnabled = selectedModules[opt.key];
                        return (
                            <button key={opt.key} onClick={() => toggleModule(opt.key)} className={`p-5 rounded-2xl border transition-all flex items-center justify-between text-left ${isEnabled ? 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800' : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 opacity-60'}`}>
                                <div><p className={`text-xs font-black ${isEnabled ? 'text-primary-700 dark:text-primary-400' : 'text-gray-500'}`}>{opt.label}</p><p className="text-[9px] text-gray-400 font-medium uppercase tracking-tighter">{opt.desc}</p></div>
                                {isEnabled ? <ToggleRight className="w-6 h-6 text-primary-500" /> : <ToggleLeft className="w-6 h-6 text-gray-300" />}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="flex gap-4"><button onClick={() => setAgencyToManage(null)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest">Fermer</button><button disabled={isProcessing} onClick={handleUpdateModules} className="flex-1 py-5 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3">{isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />} Appliquer</button></div>
          </div>
        </div>
      )}

      {/* MODALE RECHARGE CRÉDITS */}
      {agencyToRecharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300">
             <div className="text-center mb-8">
                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-4"><Coins size={32} /></div>
                <h3 className="text-2xl font-black dark:text-white tracking-tight">Vente de Crédits</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{agencyToRecharge.name}</p>
             </div>
             <form onSubmit={handleRecharge} className="space-y-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Volume de Crédits</label><select className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-black text-xl" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)}><option value="10">10 Crédits</option><option value="20">20 Crédits</option><option value="50">50 Crédits</option><option value="100">100 Crédits</option></select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Note de transaction</label><input type="text" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-medium text-sm" value={rechargeDesc} onChange={(e) => setRechargeDesc(e.target.value)} /></div>
                <div className="flex gap-4"><button type="button" onClick={() => setAgencyToRecharge(null)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest">Fermer</button><button disabled={isProcessing} type="submit" className="flex-1 py-5 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-500/30 active:scale-95 flex items-center justify-center gap-2">{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />} Confirmer</button></div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyManager;
