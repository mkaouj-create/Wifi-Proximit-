
import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit3, Trash2, X, Search, AlertTriangle, Loader2, Calendar, CreditCard, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Agency, UserProfile } from '../types';
import { translations, Language } from '../i18n';

interface AgencyManagerProps {
  user: UserProfile;
  lang: Language;
}

const DURATIONS = [
  { label: '7 JOURS', val: 7 },
  { label: '14 JOURS', val: 14 },
  { label: '1 MOIS', val: 30 },
  { label: '2 MOIS', val: 60 },
  { label: '3 MOIS', val: 90 },
  { label: '5 MOIS', val: 150 },
  { label: '12 MOIS', val: 365 },
];

const AgencyManager: React.FC<AgencyManagerProps> = ({ user, lang }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [agencyToRenew, setAgencyToRenew] = useState<Agency | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<Agency | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [newAgencyName, setNewAgencyName] = useState('');
  
  const t = translations[lang];

  useEffect(() => { loadAgencies(); }, []);

  const loadAgencies = async () => {
    const data = await supabase.getAgencies();
    setAgencies(data);
  };

  const handleRenew = async (days: number) => {
    if (!agencyToRenew || isProcessing) return;
    setIsProcessing(true);
    try {
      await supabase.renewAgency(agencyToRenew.id, days, user);
      setAgencyToRenew(null);
      await loadAgencies();
    } catch (e) {
      console.error(e);
      alert("Erreur critique: La mise à jour de l'abonnement a échoué.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getRemainingDays = (expiresAt?: string) => {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
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
          const daysLeft = getRemainingDays(agency.expires_at);
          const isExpired = daysLeft <= 0;
          return (
            <div key={agency.id} className={`bg-white dark:bg-gray-800 rounded-[2.5rem] border p-8 shadow-sm transition-all flex flex-col justify-between group ${isExpired ? 'border-red-100 dark:border-red-900/30 bg-red-50/10' : 'border-gray-100 dark:border-gray-700'}`}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isExpired ? 'bg-red-100 text-red-600' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600'}`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isExpired ? 'bg-red-500 text-white' : 'bg-green-100 text-green-700'}`}>
                    {isExpired ? 'ACCÈS EXPIRÉ' : `${daysLeft} JOURS RESTANTS`}
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{agency.name}</h3>
                
                <div className="space-y-3 mb-6 bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-50 dark:border-gray-700">
                   <div className="flex items-center justify-between text-[10px] font-bold">
                     <span className="text-gray-400 uppercase">Début cycle</span>
                     <span className="text-gray-900 dark:text-white">{agency.activated_at ? new Date(agency.activated_at).toLocaleDateString() : '---'}</span>
                   </div>
                   <div className="flex items-center justify-between text-[10px] font-black">
                     <span className="text-gray-400 uppercase">Prochaine Échéance</span>
                     <span className={`${isExpired ? 'text-red-500' : 'text-primary-600'}`}>{agency.expires_at ? new Date(agency.expires_at).toLocaleDateString() : '---'}</span>
                   </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-700">
                 <button onClick={() => setAgencyToRenew(agency)} className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary-700 transition-all active:scale-95 shadow-lg shadow-primary-500/20">
                   <CreditCard className="w-4 h-4" /> {isExpired ? 'Activer' : 'Prolonger'}
                 </button>
                 <button onClick={() => setAgencyToDelete(agency)} className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl hover:bg-red-100 active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALE D'ACTIVATION (Design fidèle à l'image fournie) */}
      {agencyToRenew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-[#1a232e] w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 text-center border border-white/5">
            <div className="w-20 h-20 bg-[#1e2d3d] text-[#0ea5e9] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Calendar className="w-10 h-10" />
            </div>
            
            <h3 className="text-3xl font-black text-white mb-2">Activation d'accès</h3>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-10">{agencyToRenew.name}</p>

            <div className="grid grid-cols-1 gap-3 mb-10">
                {DURATIONS.map(d => (
                    <button 
                        key={d.val} 
                        onClick={() => handleRenew(d.val)}
                        disabled={isProcessing}
                        className="group w-full p-5 bg-[#141b25] hover:bg-[#0ea5e9] rounded-2xl flex items-center justify-between transition-all active:scale-95 border border-white/5 disabled:opacity-50"
                    >
                        <span className="text-white font-black text-sm tracking-wide group-hover:translate-x-1 transition-transform">{d.label}</span>
                        {isProcessing ? (
                           <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                           <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                        )}
                    </button>
                ))}
            </div>

            <button 
              onClick={() => !isProcessing && setAgencyToRenew(null)} 
              className="w-full py-4 text-[11px] font-black uppercase text-gray-500 tracking-[0.2em] hover:text-white transition-colors"
            >
              Annuler
            </button>
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
              <button onClick={async () => { await supabase.deleteAgency(agencyToDelete.id); setAgencyToDelete(null); loadAgencies(); }} className="w-full py-5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-red-500/30 active:scale-95 transition-all">Confirmer Suppression</button>
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
            <form onSubmit={async (e) => { e.preventDefault(); if(!newAgencyName) return; await supabase.addAgency(newAgencyName); setNewAgencyName(''); setShowAdd(false); loadAgencies(); }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nom commercial</label>
                <input type="text" className="w-full px-7 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold dark:text-white" value={newAgencyName} onChange={(e) => setNewAgencyName(e.target.value)} required placeholder="Ex: Wifi Hamdallaye" />
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
