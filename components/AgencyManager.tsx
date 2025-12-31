
import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Plus, Edit3, X, Search, Loader2, ShieldCheck, Coins, ToggleLeft, ToggleRight, Power, PowerOff, Save, Calendar, Star, FileText, Clock, AlertTriangle, Settings2, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Agency, UserProfile, AgencyStatus, AgencyModules, SubscriptionPlan } from '../types';
import { Language } from '../i18n';

interface AgencyManagerProps {
  user: UserProfile;
  lang: Language;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const MODULE_OPTIONS: { key: keyof AgencyModules; label: string; desc: string }[] = [
  { key: 'dashboard', label: 'Dashboard', desc: 'KPIs et stats' },
  { key: 'sales', label: 'Ventes', desc: 'Terminal mobile' },
  { key: 'history', label: 'Historique', desc: 'Audit des ventes' },
  { key: 'tickets', label: 'Tickets', desc: 'Import et stock' },
  { key: 'team', label: 'Équipe', desc: 'Collaborateurs' },
  { key: 'tasks', label: 'Audit', desc: 'Logs système' },
];

const AgencyManager: React.FC<AgencyManagerProps> = ({ user, notify }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modals visibility
  const [showAdd, setShowAdd] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [agencyToManage, setAgencyToManage] = useState<Agency | null>(null);
  const [agencyToRecharge, setAgencyToRecharge] = useState<Agency | null>(null);
  const [agencyToSubscribe, setAgencyToSubscribe] = useState<Agency | null>(null);
  
  // Form states
  const [newAgencyName, setNewAgencyName] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('50');
  const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);
  const [selectedModules, setSelectedModules] = useState<AgencyModules>({
    dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true
  });

  useEffect(() => { 
    loadAgencies();
    loadPlans();
  }, []);

  const loadAgencies = async () => {
    const data = await supabase.getAgencies();
    setAgencies(data);
  };

  const loadPlans = async () => {
    const data = await supabase.getSubscriptionPlans();
    setPlans(data);
  };

  const filtered = useMemo(() => 
    agencies.filter(a => a.name.toLowerCase().includes(search.toLowerCase())),
    [agencies, search]
  );

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgencyName || isProcessing) return;
    setIsProcessing(true);
    try {
      await supabase.createAgency(newAgencyName, user);
      notify('success', `Agence créée.`);
      setShowAdd(false);
      setNewAgencyName('');
      loadAgencies();
    } catch (e) {
      notify('error', "Échec de création.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateModules = async () => {
    if (!agencyToManage) return;
    setIsProcessing(true);
    try {
      await supabase.updateAgencyModules(agencyToManage.id, selectedModules, user);
      notify('success', `Accès mis à jour.`);
      setAgencyToManage(null);
      loadAgencies();
    } catch (e) {
      notify('error', "Erreur.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreatePlan = () => {
    setEditingPlan({
      id: crypto.randomUUID(), // Generate a temporary ID for creation
      name: 'Nouveau Plan',
      months: 1,
      price: 100000,
      currency: 'GNF',
      features: ['Tableau de bord', 'Support Standard'],
      is_popular: false,
      order_index: plans.length + 1
    });
  };

  const handleSavePlan = async () => {
    if (!editingPlan || !editingPlan.name) return;
    setIsProcessing(true);
    try {
        await supabase.updateSubscriptionPlan(editingPlan as SubscriptionPlan, user);
        notify('success', "Plan sauvegardé.");
        setEditingPlan(null);
        loadPlans();
    } catch (e) {
        notify('error', "Erreur lors de la sauvegarde.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce forfait ?")) return;
    setIsProcessing(true);
    try {
        await supabase.deleteSubscriptionPlan(id, user);
        notify('success', "Plan supprimé.");
        loadPlans();
    } catch (e) {
        notify('error', "Erreur lors de la suppression.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleToggleStatus = async (agency: Agency) => {
    const newStatus: AgencyStatus = agency.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`Changer statut de ${agency.name} ?`)) return;
    try {
      await supabase.setAgencyStatus(agency.id, newStatus, user);
      loadAgencies();
    } catch (e) { notify('error', "Action refusée."); }
  };

  const getDaysLeft = (date: string) => {
    const diff = new Date(date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Header UI */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black dark:text-white uppercase">Agences</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">SaaS & Réseau</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowPlans(true)} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase border dark:border-gray-700 active:scale-95 transition-all">
                <Settings2 size={16} /> Forfaits
            </button>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-primary-500/30 active:scale-95 transition-all">
                <Plus size={16} /> Nouvelle Agence
            </button>
        </div>
      </div>

      {/* Search UI */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder="Filtrer les agences..." 
          className="w-full pl-14 pr-6 py-5 bg-white dark:bg-gray-800 rounded-[1.5rem] shadow-sm border-none font-bold dark:text-white outline-none" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      {/* Agency Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(agency => {
          const isActive = agency.status === 'active';
          const isExpired = !supabase.isSubscriptionActive(agency);
          const days = getDaysLeft(agency.subscription_end);
          
          return (
            <div key={agency.id} className={`bg-white dark:bg-gray-800 rounded-[2.5rem] border p-8 transition-all flex flex-col justify-between h-full ${!isActive ? 'border-red-500 bg-red-50/5' : isExpired ? 'border-amber-500 bg-amber-50/5' : 'border-gray-100 dark:border-gray-700 hover:shadow-xl'}`}>
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${!isActive ? 'bg-red-100 text-red-600' : isExpired ? 'bg-amber-100 text-amber-600' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600'}`}>
                    <Building2 size={24} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-500 text-white'}`}>{isActive ? 'ACTIF' : 'OFF'}</span>
                      {isActive && <span className={`text-[8px] font-black flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-primary-500'}`}>{isExpired ? 'EXPIRÉ' : `${days}j`}</span>}
                  </div>
                </div>
                
                <h3 className="text-xl font-black dark:text-white mb-1 uppercase truncate">{agency.name}</h3>
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-6">{agency.plan_name}</p>
                
                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl">
                        <p className="text-[8px] text-gray-400 font-black uppercase">Crédits</p>
                        <p className="font-black text-lg dark:text-white">{agency.credits_balance}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl">
                        <p className="text-[8px] text-gray-400 font-black uppercase">Échéance</p>
                        <p className="font-black text-[10px] dark:text-white">{new Date(agency.subscription_end).toLocaleDateString()}</p>
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-6 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setAgencyToSubscribe(agency)} className="py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-700 transition-all active:scale-95"><Star size={14} className="mx-auto mb-1"/> Licence</button>
                <button onClick={() => setAgencyToRecharge(agency)} className="py-3 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-amber-600 transition-all active:scale-95"><Plus size={14} className="mx-auto mb-1"/> Crédits</button>
                <button onClick={() => { setAgencyToManage(agency); setSelectedModules(agency.settings?.modules || selectedModules); }} className="py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white rounded-xl text-[9px] font-black uppercase active:scale-95"><Edit3 size={14} className="mx-auto mb-1"/> Modules</button>
                <button onClick={() => handleToggleStatus(agency)} className={`py-3 rounded-xl text-[9px] font-black uppercase active:scale-95 ${isActive ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{isActive ? <PowerOff size={14} className="mx-auto mb-1"/> : <Power size={14} className="mx-auto mb-1"/>} {isActive ? 'Bloquer' : 'Activer'}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Template: New Agency */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in border dark:border-gray-700">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-4"><Building2 size={32} /></div>
              <h3 className="text-2xl font-black uppercase">Nouvelle Agence</h3>
            </div>
            <form onSubmit={handleCreateAgency} className="space-y-6">
              <input type="text" autoFocus className="w-full p-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl font-bold dark:text-white outline-none" placeholder="Nom de l'agence..." value={newAgencyName} onChange={(e) => setNewAgencyName(e.target.value)} required />
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase">Annuler</button>
                <button type="submit" disabled={isProcessing} className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2">{isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Modules */}
      {agencyToManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-[3rem] p-10 shadow-2xl border dark:border-gray-700">
            <h3 className="text-2xl font-black uppercase mb-8">Modules : {agencyToManage.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                {MODULE_OPTIONS.map(opt => (
                    <button key={opt.key} onClick={() => setSelectedModules({...selectedModules, [opt.key]: !selectedModules[opt.key]})} className={`p-4 rounded-2xl border transition-all flex items-center justify-between text-left ${selectedModules[opt.key] ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500' : 'bg-gray-50 dark:bg-gray-900 border-transparent opacity-60'}`}>
                        <div><p className="text-xs font-black uppercase">{opt.label}</p><p className="text-[8px] text-gray-400 font-bold uppercase">{opt.desc}</p></div>
                        {selectedModules[opt.key] ? <ToggleRight className="text-primary-500" /> : <ToggleLeft className="text-gray-300" />}
                    </button>
                ))}
            </div>
            <div className="flex gap-4">
                <button onClick={() => setAgencyToManage(null)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase">Fermer</button>
                <button onClick={handleUpdateModules} className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg">{isProcessing ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} Appliquer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Plans Editor (Complet CRUD) */}
      {showPlans && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-4xl h-[80vh] rounded-[3rem] p-10 shadow-2xl flex flex-col border dark:border-gray-700">
             <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black uppercase">Configuration Forfaits</h3>
                    <button onClick={handleCreatePlan} className="p-3 bg-primary-600 text-white rounded-2xl hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all active:scale-95"><Plus size={18} /></button>
                </div>
                <button onClick={() => setShowPlans(false)} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-2xl"><X size={20}/></button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plans.map(p => (
                        <div key={p.id} className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] border dark:border-gray-800 flex items-center justify-between group">
                            <div><p className="font-black text-lg">{p.name}</p><p className="text-xs text-indigo-500 font-bold">{p.price.toLocaleString()} {p.currency} / {p.months}m</p></div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingPlan(p)} className="p-3 bg-white dark:bg-gray-800 rounded-xl hover:text-primary-500 shadow-sm transition-all active:scale-95"><Edit3 size={16} /></button>
                                <button onClick={() => handleDeletePlan(p.id)} className="p-3 bg-white dark:bg-gray-800 rounded-xl text-red-400 hover:text-red-500 shadow-sm transition-all active:scale-95"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                    {plans.length === 0 && <p className="col-span-2 text-center text-gray-400 text-sm font-bold p-10">Aucun forfait configuré. Créez-en un nouveau !</p>}
                </div>
             </div>
             {editingPlan && (
                <div className="absolute inset-0 bg-white dark:bg-gray-800 p-10 rounded-[3rem] flex flex-col z-10 animate-in slide-in-from-right">
                    <h4 className="text-xl font-black uppercase mb-8">Édition : {editingPlan.name}</h4>
                    <div className="grid grid-cols-2 gap-6 flex-1 overflow-y-auto pr-2 no-scrollbar content-start">
                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Nom</label><input type="text" className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-xl font-bold dark:text-white" value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Mois</label><input type="number" className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-xl font-bold dark:text-white" value={editingPlan.months} onChange={e => setEditingPlan({...editingPlan, months: parseInt(e.target.value)})} /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Prix</label><input type="number" className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-xl font-bold dark:text-white" value={editingPlan.price} onChange={e => setEditingPlan({...editingPlan, price: parseInt(e.target.value)})} /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Devise</label><input type="text" className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-xl font-bold dark:text-white" value={editingPlan.currency} onChange={e => setEditingPlan({...editingPlan, currency: e.target.value})} /></div>
                        <div className="col-span-2 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Avantages (séparés par virgules)</label><textarea className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-xl font-bold dark:text-white resize-none" rows={3} value={editingPlan.features?.join(', ')} onChange={e => setEditingPlan({...editingPlan, features: e.target.value.split(',').map(f => f.trim())})} /></div>
                        <div className="col-span-2 flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl cursor-pointer" onClick={() => setEditingPlan({...editingPlan, is_popular: !editingPlan.is_popular})}>
                            {editingPlan.is_popular ? <ToggleRight className="text-primary-500" size={24} /> : <ToggleLeft className="text-gray-300" size={24} />}
                            <span className="text-xs font-black uppercase text-gray-500">Marquer comme "Populaire"</span>
                        </div>
                    </div>
                    <div className="mt-8 flex gap-4"><button onClick={() => setEditingPlan(null)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase">Annuler</button><button onClick={handleSavePlan} className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg">{isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Sauvegarder</button></div>
                </div>
             )}
          </div>
        </div>
      )}

      {/* Modal: Recharge Credits */}
      {agencyToRecharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl border dark:border-gray-700">
             <div className="text-center mb-8">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-4"><Coins size={32} /></div>
                <h3 className="text-2xl font-black uppercase">Créditer l'agence</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{agencyToRecharge.name}</p>
             </div>
             <div className="space-y-6">
                <input type="number" className="w-full p-6 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl font-black text-3xl text-center dark:text-white" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} />
                <div className="flex gap-4">
                    <button onClick={() => setAgencyToRecharge(null)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase">Annuler</button>
                    <button onClick={async () => {
                        setIsProcessing(true);
                        try {
                            await supabase.addCredits(agencyToRecharge.id, parseInt(rechargeAmount), user.id, "Recharge admin");
                            notify('success', 'Crédits ajoutés.');
                            setAgencyToRecharge(null);
                            loadAgencies();
                        } catch (e) { notify('error', 'Erreur.'); }
                        finally { setIsProcessing(false); }
                    }} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2">{isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Confirmer</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Modal: Subscription Activation */}
      {agencyToSubscribe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border dark:border-gray-700">
             <div className="text-center mb-8">
                <h3 className="text-2xl font-black uppercase">Activer Licence</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{agencyToSubscribe.name}</p>
             </div>
             <div className="space-y-3 mb-8">
                {plans.map(p => (
                    <button key={p.id} onClick={async () => {
                        setIsProcessing(true);
                        try {
                            await supabase.updateSubscription(agencyToSubscribe.id, p.name, p.months, user);
                            notify('success', `Plan ${p.name} activé.`);
                            setAgencyToSubscribe(null);
                            loadAgencies();
                        } catch (e) { notify('error', 'Erreur.'); }
                        finally { setIsProcessing(false); }
                    }} className="w-full p-5 bg-gray-50 dark:bg-gray-900/50 hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-500 rounded-2xl flex justify-between items-center group transition-all">
                        <div className="text-left"><p className="font-black uppercase">{p.name}</p><p className="text-[10px] text-gray-400 font-bold">{p.months} Mois</p></div>
                        <p className="font-black text-indigo-600 group-hover:scale-110 transition-transform">{p.price.toLocaleString()} {p.currency}</p>
                    </button>
                ))}
             </div>
             <button onClick={() => setAgencyToSubscribe(null)} className="w-full py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyManager;
