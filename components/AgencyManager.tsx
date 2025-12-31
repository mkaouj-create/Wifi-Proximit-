
import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit3, X, Search, Loader2, ShieldCheck, Coins, ToggleLeft, ToggleRight, Power, PowerOff, Save, Calendar, Star, FileText, Clock, AlertTriangle, Settings2, Trash2, Check } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Agency, UserProfile, AgencyStatus, AgencyModules, SubscriptionPlan } from '../types';
import { translations, Language } from '../i18n';

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

const AgencyManager: React.FC<AgencyManagerProps> = ({ user, lang, notify }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showPlansEditor, setShowPlansEditor] = useState(false);
  const [agencyToManage, setAgencyToManage] = useState<Agency | null>(null);
  const [agencyToRecharge, setAgencyToRecharge] = useState<Agency | null>(null);
  const [agencyToSubscribe, setAgencyToSubscribe] = useState<Agency | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [search, setSearch] = useState('');
  
  // States for Plan Editor
  const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);

  const [rechargeAmount, setRechargeAmount] = useState('10');
  const [rechargeDesc, setRechargeDesc] = useState('Recharge manuelle');
  const [selectedModules, setSelectedModules] = useState<AgencyModules>({
    dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true
  });
  const t = translations[lang];

  useEffect(() => { 
    loadAgencies();
    loadPlans();
  }, []);

  useEffect(() => {
    if (agencyToManage) {
        setSelectedModules(agencyToManage.settings?.modules || {
            dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true
        });
    }
  }, [agencyToManage]);

  const loadAgencies = async () => {
    try {
      const data = await supabase.getAgencies();
      setAgencies(data);
    } catch (e) {
      notify('error', "Erreur de chargement des agences.");
    }
  };

  const loadPlans = async () => {
    const data = await supabase.getSubscriptionPlans();
    setPlans(data);
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate).getTime();
    const now = Date.now();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
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
      notify('error', e.message || "Erreur de mise à jour.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavePlan = async () => {
    if (!editingPlan || isProcessing) return;
    setIsProcessing(true);
    try {
        await supabase.updateSubscriptionPlan(editingPlan as SubscriptionPlan, user);
        notify('success', "Forfait enregistré avec succès.");
        setEditingPlan(null);
        loadPlans();
    } catch (e) {
        notify('error', "Erreur lors de la sauvegarde du forfait.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyToRecharge || isProcessing) return;
    
    const amount = Number(rechargeAmount);
    if (isNaN(amount) || amount <= 0) {
      notify('error', "Veuillez sélectionner un volume valide.");
      return;
    }

    setIsProcessing(true);
    try {
      await supabase.addCredits(agencyToRecharge.id, amount, user.id, rechargeDesc);
      notify('success', `${amount} crédits ajoutés avec succès.`);
      setAgencyToRecharge(null);
      await loadAgencies();
    } catch (e: any) {
      notify('error', "Échec du rechargement.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActivateSubscription = async (plan: SubscriptionPlan) => {
    if (!agencyToSubscribe || isProcessing) return;
    setIsProcessing(true);
    try {
        await supabase.updateSubscription(agencyToSubscribe.id, plan.name, plan.months, user);
        notify('success', `Abonnement ${plan.name} activé.`);
        setAgencyToSubscribe(null);
        await loadAgencies();
    } catch (e) {
        notify('error', "Erreur activation d'abonnement.");
    } finally {
        setIsProcessing(false);
    }
  };

  const toggleModule = (key: keyof AgencyModules) => {
    setSelectedModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleStatus = async (agency: Agency) => {
    if (isProcessing) return;
    const newStatus: AgencyStatus = agency.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`Changer le statut de l'agence ${agency.name} ?`)) return;
    
    setIsProcessing(true);
    try {
      await supabase.setAgencyStatus(agency.id, newStatus, user);
      notify('info', `Statut mis à jour.`);
      await loadAgencies();
    } catch (e) {
      notify('error', "Action impossible.");
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = agencies.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-none tracking-tight">Gestion des Agences</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-2">SaaS & Licences Partenaires</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowPlansEditor(true)} className="flex items-center justify-center gap-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all border dark:border-gray-700">
                <Settings2 className="w-5 h-5" /> Config. Offres
            </button>
            <button onClick={() => setShowAdd(true)} className="flex items-center justify-center gap-3 bg-primary-600 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all">
                <Plus className="w-5 h-5" /> Ajouter Agence
            </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder="Rechercher par nom..." 
          className="w-full pl-14 pr-6 py-5 bg-white dark:bg-gray-800 border-none rounded-[1.5rem] shadow-sm focus:ring-4 focus:ring-primary-500/10 font-bold dark:text-white outline-none" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(agency => {
          const isActive = agency.status === 'active';
          const isExpired = !supabase.isSubscriptionActive(agency);
          const daysLeft = getDaysRemaining(agency.subscription_end);
          
          return (
            <div key={agency.id} className={`bg-white dark:bg-gray-800 rounded-[2.5rem] border p-8 shadow-sm transition-all flex flex-col justify-between group h-full ${!isActive ? 'border-red-100 dark:border-red-900/30 bg-red-50/5' : isExpired ? 'border-amber-200 dark:border-amber-900/30 bg-amber-50/5' : 'border-gray-100 dark:border-gray-700'}`}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${!isActive ? 'bg-red-100 text-red-600' : isExpired ? 'bg-amber-100 text-amber-600' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600'}`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                      <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-500 text-white'}`}>
                        {isActive ? 'ACTIF' : 'SUSPENDU'}
                      </div>
                      {isActive && (
                          <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1.5 ${isExpired ? 'bg-red-100 text-red-700' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
                             {isExpired ? <AlertTriangle size={10}/> : <Clock size={10}/>}
                             {isExpired ? 'EXPIRÉ' : `${daysLeft} Jours`}
                          </div>
                      )}
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 leading-tight">{agency.name}</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-6">{agency.plan_name}</p>
                
                <div className="space-y-4 mb-8">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <Coins size={16} className="text-amber-500" />
                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Crédits</span>
                        </div>
                        <p className="font-black text-lg dark:text-white tabular-nums">{agency.credits_balance}</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <Calendar size={16} className="text-blue-500" />
                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Échéance</span>
                        </div>
                        <p className={`font-black text-xs tabular-nums ${isExpired ? 'text-red-500' : 'dark:text-white'}`}>
                            {new Date(agency.subscription_end).toLocaleDateString()}
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
                <button disabled={isProcessing} onClick={() => handleToggleStatus(agency)} className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />} {isActive ? 'Bloquer' : 'Activer'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALE EDITEUR DE PLANS (SUPER ADMIN) */}
      {showPlansEditor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 border dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
             <div className="flex items-center justify-between mb-8 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center"><Settings2 className="w-6 h-6" /></div>
                    <div><h3 className="text-2xl font-black dark:text-white leading-tight">Configuration des Forfaits</h3><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Contrôle des tarifs publics</p></div>
                </div>
                <button onClick={() => setShowPlansEditor(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full dark:text-white transition-colors"><X size={24} /></button>
             </div>

             <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plans.map(plan => (
                        <div key={plan.id} className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] border dark:border-gray-800 flex items-center justify-between group">
                            <div>
                                <p className="font-black text-lg dark:text-white">{plan.name}</p>
                                <p className="text-xs text-indigo-600 font-bold">{plan.price.toLocaleString()} {plan.currency} / {plan.months} Mois</p>
                            </div>
                            <button onClick={() => setEditingPlan(plan)} className="p-3 bg-white dark:bg-gray-800 rounded-xl text-gray-400 group-hover:text-primary-500 transition-all border dark:border-gray-700 shadow-sm"><Edit3 size={18} /></button>
                        </div>
                    ))}
                    <button onClick={() => setEditingPlan({ name: '', price: 0, months: 1, currency: 'GNF', features: [], order_index: plans.length })} className="p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2rem] flex items-center justify-center gap-3 text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-all">
                        <Plus size={20} /> <span className="font-black uppercase text-xs">Nouveau Forfait</span>
                    </button>
                </div>
             </div>

             {editingPlan && (
                <div className="absolute inset-0 z-10 bg-white dark:bg-gray-800 p-10 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center gap-4 mb-8">
                        <button onClick={() => setEditingPlan(null)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl"><X size={20} /></button>
                        <h4 className="text-xl font-black uppercase">Éditer Forfait</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nom du Plan</label>
                            <input type="text" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl font-bold border-none" value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Durée (Mois)</label>
                            <input type="number" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl font-bold border-none" value={editingPlan.months} onChange={e => setEditingPlan({...editingPlan, months: parseInt(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tarif</label>
                            <input type="number" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl font-bold border-none" value={editingPlan.price} onChange={e => setEditingPlan({...editingPlan, price: parseInt(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Devise</label>
                            <input type="text" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl font-bold border-none" value={editingPlan.currency} onChange={e => setEditingPlan({...editingPlan, currency: e.target.value})} />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Points Forts (Séparés par une virgule)</label>
                            <textarea className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl font-bold border-none" rows={3} value={editingPlan.features?.join(', ')} onChange={e => setEditingPlan({...editingPlan, features: e.target.value.split(',').map(f => f.trim())})} />
                        </div>
                    </div>

                    <div className="mt-10 flex gap-4">
                        <button onClick={() => setEditingPlan(null)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black uppercase text-xs">Annuler</button>
                        <button onClick={handleSavePlan} className="flex-1 py-5 bg-primary-600 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3">
                            {isProcessing ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                            Sauvegarder
                        </button>
                    </div>
                </div>
             )}
          </div>
        </div>
      )}

      {/* MODALE RECHARGE CRÉDITS */}
      {agencyToRecharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#1a2332] w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 border border-white/5 relative">
             <div className="text-center mb-10">
                <div className="w-20 h-20 bg-[#2d3748] text-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-white/10">
                    <Coins size={40} />
                </div>
                <h3 className="text-3xl font-black text-white tracking-tight mb-1 leading-none">Vente de Crédits</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-60 mt-3">{agencyToRecharge.name}</p>
             </div>

             <form onSubmit={handleRecharge} className="space-y-8">
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 opacity-70">Volume de Crédits</label>
                    <div className="relative">
                        <select 
                            className="w-full p-6 bg-[#0f172a] text-white rounded-2xl outline-none font-black text-xl appearance-none border border-white/5 focus:border-orange-500/50 transition-all cursor-pointer" 
                            value={rechargeAmount} 
                            onChange={(e) => setRechargeAmount(e.target.value)}
                        >
                            <option value="10">10 Crédits</option>
                            <option value="20">20 Crédits</option>
                            <option value="50">50 Crédits</option>
                            <option value="100">100 Crédits</option>
                            <option value="250">250 Crédits</option>
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <Plus size={20} />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 opacity-70">Note de transaction</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            className="w-full p-5 bg-[#0f172a] text-white rounded-2xl outline-none font-bold text-sm border border-white/5 focus:border-orange-500/50 transition-all" 
                            value={rechargeDesc} 
                            onChange={(e) => setRechargeDesc(e.target.value)} 
                            placeholder="Note..."
                        />
                        <FileText className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                    </div>
                </div>

                <div className="flex gap-4 pt-4">
                    <button 
                        type="button" 
                        onClick={() => setAgencyToRecharge(null)} 
                        className="flex-1 py-5 bg-[#2d3748] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#3d485c] transition-all active:scale-95"
                    >
                        FERMER
                    </button>
                    <button 
                        disabled={isProcessing} 
                        type="submit" 
                        className="flex-1 py-5 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_10px_30px_rgba(249,115,22,0.3)] hover:bg-orange-600 active:scale-95 flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
                        CONFIRMER
                    </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Modale Abonnement - Dynamisée */}
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
                {plans.map(plan => (
                    <button 
                        key={plan.id}
                        disabled={isProcessing}
                        onClick={() => handleActivateSubscription(plan)}
                        className="w-full p-6 bg-gray-50 dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-2 border-transparent hover:border-indigo-500 rounded-[1.5rem] flex items-center justify-between transition-all group disabled:opacity-50"
                    >
                        <div className="text-left">
                            <p className="font-black dark:text-white">{plan.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{plan.months} Mois de validité</p>
                        </div>
                        <div className="text-right">
                            <p className="font-black text-indigo-600">{plan.price.toLocaleString()} {plan.currency}</p>
                            <p className="text-[9px] text-gray-400 uppercase">Usage illimité</p>
                        </div>
                    </button>
                ))}
             </div>

             <button onClick={() => setAgencyToSubscribe(null)} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Annuler</button>
          </div>
        </div>
      )}

      {/* Modale Modules */}
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
            <div className="flex gap-4"><button onClick={() => setAgencyToManage(null)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Fermer</button><button disabled={isProcessing} onClick={handleUpdateModules} className="flex-1 py-5 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3">{isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />} Appliquer</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyManager;
