
import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Plus, Edit3, Trash2, Power, PowerOff, X, Search, AlertTriangle, Loader2, Layers, Calendar, Clock, CreditCard, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Agency, UserProfile, AgencyModules } from '../types';
import { translations, Language } from '../i18n';

interface AgencyManagerProps {
  user: UserProfile;
  lang: Language;
}

const DURATIONS = [
  { label: '7 Jours', val: 7 },
  { label: '14 Jours', val: 14 },
  { label: '1 Mois', val: 30 },
  { label: '2 Mois', val: 60 },
  { label: '3 Mois', val: 90 },
  { label: '5 Mois', val: 150 },
  { label: '12 Mois', val: 365 },
];

const AgencyManager: React.FC<AgencyManagerProps> = ({ user, lang }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [agencyToRenew, setAgencyToRenew] = useState<Agency | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<Agency | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newAgencyName, setNewAgencyName] = useState('');
  
  const t = translations[lang];

  useEffect(() => { loadAgencies(); }, []);

  const loadAgencies = async () => {
    const data = await supabase.getAgencies();
    setAgencies(data);
  };

  const handleRenew = async (days: number) => {
    if (!agencyToRenew) return;
    setProcessingId(agencyToRenew.id);
    try {
      await supabase.renewAgency(agencyToRenew.id, days, user);
      setAgencyToRenew(null);
      loadAgencies();
    } catch (e) {
      alert("Erreur lors du renouvellement");
    } finally {
      setProcessingId(null);
    }
  };

  const getRemainingInfo = (expiresAt?: string) => {
    if (!expiresAt) return { days: 0, expired: true, text: 'Non activé' };
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (diff <= 0) return { days: 0, expired: true, text: 'Expiré' };
    if (days === 1) return { days, expired: false, text: 'Expire demain' };
    return { days, expired: false, text: `${days} jours restants` };
  };

  const filtered = agencies.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-none">Gestion Agences</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-2">Pilotage des accès & abonnements</p>
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
          const info = getRemainingInfo(agency.expires_at);
          return (
            <div key={agency.id} className={`bg-white dark:bg-gray-800 rounded-[2.5rem] border p-8 shadow-sm transition-all flex flex-col justify-between group ${info.expired ? 'border-red-100 dark:border-red-900/30 bg-red-50/5' : 'border-gray-100 dark:border-gray-700'}`}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${info.expired ? 'bg-red-100 text-red-600' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600'}`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${info.expired ? 'bg-red-500 text-white' : 'bg-green-100 text-green-700'}`}>
                    {info.text}
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{agency.name}</h3>
                
                <div className="space-y-3 mb-6 bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-50 dark:border-gray-700">
                   <div className="flex items-center justify-between text-[10px] font-bold">
                     <span className="text-gray-400 uppercase">Début cycle</span>
                     <span className="text-gray-900 dark:text-white">{agency.activated_at ? new Date(agency.activated_at).toLocaleDateString() : '---'}</span>
                   </div>
                   <div className="flex items-center justify-between text-[10px] font-black">
                     <span className="text-gray-400 uppercase">Échéance</span>
                     <span className={`${info.expired ? 'text-red-500' : 'text-primary-600'}`}>{agency.expires_at ? new Date(agency.expires_at).toLocaleDateString() : '---'}</span>
                   </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-700">
                 <button onClick={() => setAgencyToRenew(agency)} className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary-700 transition-all active:scale-95 shadow-lg shadow-primary-500/20">
                   <CreditCard className="w-4 h-4" /> {info.expired ? 'Activer' : 'Renouveler'}
                 </button>
                 <div className="flex gap-2">
                   <button onClick={() => setAgencyToDelete(agency)} className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl hover:bg-red-100 active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></button>
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Abonnement / Prolongation */}
      {agencyToRenew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black dark:text-white">Activation d'accès</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase mt-1 tracking-widest">{agencyToRenew.name}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 mb-8">
                {DURATIONS.map(d => (
                    <button 
                        key={d.val} 
                        onClick={() => handleRenew(d.val)}
                        disabled={processingId !== null}
                        className="p-4 bg-gray-50 dark:bg-gray-900 hover:bg-primary-600 hover:text-white rounded-2xl text-left font-black text-xs uppercase transition-all flex items-center justify-between dark:text-white"
                    >
                        <span>{d.label}</span>
                        {processingId === agencyToRenew.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight size={14} />}
                    </button>
                ))}
            </div>
            <button onClick={() => setAgencyToRenew(null)} className="w-full py-4 font-black uppercase text-[10px] text-gray-400">Annuler</button>
          </div>
        </div>
      )}

      {/* Confirmation Suppression */}
      {agencyToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl text-center animate-in zoom-in">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black mb-4 dark:text-white">Supprimer Agence</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">Cette action supprimera toutes les données liées à <span className="font-black text-red-500">"{agencyToDelete.name}"</span>.</p>
            <div className="flex flex-col gap-3">
              <button onClick={async () => { await supabase.deleteAgency(agencyToDelete.id); setAgencyToDelete(null); loadAgencies(); }} className="w-full py-5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-red-500/30 active:scale-95 transition-all">Confirmer Suppression</button>
              <button onClick={() => setAgencyToDelete(null)} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-2xl font-black text-xs uppercase active:scale-95 transition-all">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout Rapide */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black dark:text-white">Nouvelle Agence</h3>
              <button onClick={() => setShowAdd(false)} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl dark:text-white"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={async (e) => { e.preventDefault(); if(!newAgencyName) return; await supabase.addAgency(newAgencyName); setNewAgencyName(''); setShowAdd(false); loadAgencies(); }} className="space-y-6">
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

const ChevronRight = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

export default AgencyManager;
