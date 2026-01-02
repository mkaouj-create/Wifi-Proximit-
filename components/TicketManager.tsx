import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileUp, X, Loader2, Info, Layers, CheckCircle2, AlertCircle, Edit2, Tag, Trash2, ShieldAlert } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Ticket, UserProfile, TicketStatus, UserRole, Agency } from '../types';
import { translations, Language } from '../i18n';

const TicketManager: React.FC<{ user: UserProfile, lang: Language, notify: (type: 'success' | 'error' | 'info', message: string) => void }> = ({ user, lang, notify }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'ALL'>('ALL');
  const [selectedAgency, setSelectedAgency] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [showImport, setShowImport] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [showSingleDeleteModal, setShowSingleDeleteModal] = useState<Ticket | null>(null);
  
  const [priceTargetProfile, setPriceTargetProfile] = useState('');
  const [newPriceValue, setNewPriceValue] = useState('');
  const [purgeTargetProfile, setPurgeTargetProfile] = useState('');
  
  const [importTargetAgencyId, setImportTargetAgencyId] = useState(user.agency_id);

  const t = translations[lang];
  
  // LOGIQUE DE RÔLES STRICTE
  const isSuper = user.role === UserRole.SUPER_ADMIN;
  const isOnlyAdmin = user.role === UserRole.ADMIN; // Uniquement ADMIN peut gérer le stock

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const promises: any[] = [supabase.getTickets(user.agency_id, user.role)];
      if (isSuper) promises.push(supabase.getAgencies());
      
      const [ticketsData, agenciesData] = await Promise.all(promises);
      setTickets(ticketsData);
      
      if (isSuper && agenciesData) {
        setAgencies(agenciesData);
        if (!importTargetAgencyId) setImportTargetAgencyId(user.agency_id);
      }
    } catch (err) {
      notify('error', "Synchronisation inventaire échouée.");
    } finally {
      setLoading(false);
    }
  }, [user.agency_id, user.role, isSuper, notify, importTargetAgencyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOnlyAdmin) return;
    
    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        if (!text || text.trim().length === 0) throw new Error("Fichier vide.");

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const delimiter = lines[0].includes(';') ? ';' : lines[0].includes(',') ? ',' : '\t';
        const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        const idx = {
          user: headers.findIndex(h => h.includes('user') || h === 'login' || h === 'username' || h === 'name'),
          pass: headers.findIndex(h => h.includes('pass') || h === 'pwd' || h === 'password'),
          prof: headers.findIndex(h => h.includes('prof') || h === 'forfait' || h === 'profile' || h === 'limit'),
          price: headers.findIndex(h => h.includes('price') || h === 'prix' || h === 'tarif' || h === 'amount')
        };

        const hasHeader = idx.user !== -1;
        const dataLines = hasHeader ? lines.slice(1) : lines;
        
        const rows = dataLines.map(line => {
          const parts = line.split(new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`))
                            .map(v => v.replace(/^["']|["']$/g, '').trim());
          
          const username = hasHeader ? parts[idx.user] : parts[0];
          if (!username) return null;

          return { 
            username, 
            password: hasHeader ? (idx.pass !== -1 ? parts[idx.pass] : username) : (parts[1] || username), 
            profile: hasHeader ? (idx.prof !== -1 ? parts[idx.prof] : 'Standard') : (parts[2] || 'Standard'), 
            price: hasHeader ? (idx.price !== -1 ? Number.parseInt(parts[idx.price]?.replace(/\D/g, '')) || 0 : 0) : (Number.parseInt(parts[3]?.replace(/\D/g, '')) || 0)
          };
        }).filter((r): r is any => r !== null && r.username.length > 0);

        const targetAid = isSuper ? importTargetAgencyId : user.agency_id;
        const res = await supabase.importTickets(rows, user.id, targetAid);
        
        notify('success', `${res.success} tickets ajoutés.`);
        setShowImport(false);
        loadData();
      } catch (err: any) {
        notify('error', err.message || "Erreur d'importation.");
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnlyAdmin) return;
    const price = parseInt(newPriceValue);
    if (isNaN(price) || price < 0 || !priceTargetProfile) return;
    setIsUpdatingPrice(true);
    try {
      const targetAid = isSuper ? (selectedAgency === 'ALL' ? user.agency_id : selectedAgency) : user.agency_id;
      await supabase.updateTicketsPriceByProfile(targetAid, priceTargetProfile, price, user);
      notify('success', "Tarifs mis à jour.");
      setShowPriceModal(false);
      loadData();
    } catch (err) { notify('error', "Échec mise à jour."); }
    finally { setIsUpdatingPrice(false); }
  };

  const handleDeleteSingle = async () => {
    if (!showSingleDeleteModal || !isOnlyAdmin) return;
    setIsDeleting(true);
    try {
      await supabase.deleteTicket(showSingleDeleteModal.id, user);
      notify('success', "Ticket supprimé.");
      setShowSingleDeleteModal(null);
      loadData();
    } catch (err) { notify('error', "Échec de suppression."); }
    finally { setIsDeleting(false); }
  };

  const handlePurgeProfile = async () => {
    if (!purgeTargetProfile || !isOnlyAdmin) return;
    setIsDeleting(true);
    try {
      const targetAid = isSuper ? (selectedAgency === 'ALL' ? user.agency_id : selectedAgency) : user.agency_id;
      await supabase.deleteTicketsByProfile(targetAid, purgeTargetProfile, user);
      notify('success', `Profil "${purgeTargetProfile}" purgé.`);
      setShowPurgeModal(false);
      loadData();
    } catch (err) { notify('error', "Échec de purge."); }
    finally { setIsDeleting(false); }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return tickets.filter(tk => {
      const matchSearch = tk.username.toLowerCase().includes(s) || tk.profile.toLowerCase().includes(s);
      const matchStatus = filterStatus === 'ALL' || tk.status === filterStatus;
      const matchAgency = selectedAgency === 'ALL' || tk.agency_id === selectedAgency;
      return matchSearch && matchStatus && matchAgency;
    });
  }, [tickets, search, filterStatus, selectedAgency]);

  const uniqueProfiles = useMemo(() => {
    return Array.from(new Set(tickets.filter(t => t.status === TicketStatus.UNSOLD).map(t => t.profile))).sort();
  }, [tickets]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black dark:text-white uppercase tracking-tight">{t.inventory}</h2>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">
             {loading ? 'Mise à jour stock...' : `${filtered.length} tickets filtrés`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* SEULS LES ADMINS VOIENT LES BOUTONS D'ACTION */}
          {isOnlyAdmin && (
            <>
              <button 
                onClick={() => {
                  if (uniqueProfiles.length > 0) {
                    setPurgeTargetProfile(uniqueProfiles[0]);
                    setShowPurgeModal(true);
                  } else { notify('info', "Aucun ticket invendu à purger."); }
                }} 
                className="flex-1 sm:flex-none bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-5 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border border-red-100 dark:border-red-800"
              >
                <Trash2 size={16}/> Purger
              </button>
              <button 
                onClick={() => {
                  if (uniqueProfiles.length > 0) {
                    const firstProfile = uniqueProfiles[0];
                    setPriceTargetProfile(firstProfile);
                    const sample = tickets.find(t => t.profile === firstProfile && t.status === TicketStatus.UNSOLD);
                    setNewPriceValue(sample ? sample.price.toString() : '');
                    setShowPriceModal(true);
                  } else { notify('info', "Aucun ticket invendu."); }
                }} 
                className="flex-1 sm:flex-none bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 px-5 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800"
              >
                <Tag size={16}/> Prix Profil
              </button>
              <button 
                onClick={() => setShowImport(true)} 
                className="flex-1 sm:flex-none bg-primary-600 text-white px-5 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <FileUp size={16}/> {t.importCsv}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-3 rounded-3xl shadow-sm border dark:border-gray-700 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18}/>
          <input 
            type="text" 
            placeholder={t.searchPlaceholder} 
            className="w-full pl-12 pr-4 py-4 bg-transparent outline-none font-bold text-sm dark:text-white placeholder:text-gray-400" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {isSuper && (
            <select 
              className="bg-gray-50 dark:bg-gray-900 px-5 py-3 rounded-xl text-[10px] font-black uppercase outline-none border-none cursor-pointer focus:ring-2 focus:ring-primary-500/20 transition-all dark:text-gray-300" 
              value={selectedAgency} 
              onChange={e => setSelectedAgency(e.target.value)}
            >
              <option value="ALL">Agences (Tous)</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select 
            className="bg-gray-50 dark:bg-gray-900 px-5 py-3 rounded-xl text-[10px] font-black uppercase outline-none border-none cursor-pointer focus:ring-2 focus:ring-primary-500/20 transition-all dark:text-gray-300" 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value as any)}
          >
            <option value="ALL">États (Tous)</option>
            <option value="UNSOLD">{t.unsold}</option>
            <option value="SOLD">{t.sold}</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[2rem] overflow-hidden border dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none min-h-[400px] relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-gray-800/50 backdrop-blur-[2px] z-10">
            <Loader2 className="animate-spin text-primary-600 mb-2" size={32} />
          </div>
        )}
        
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-6 py-5">Code WiFi</th>
                <th className="px-6 py-5">Forfait</th>
                <th className="px-6 py-5 text-right">Tarif</th>
                <th className="px-6 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filtered.slice(0, 100).map(tk => (
                <tr key={tk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-black text-xs dark:text-white uppercase tracking-tight group-hover:text-primary-600 transition-colors">{tk.username}</span>
                      {isSuper && <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter mt-1">{agencies.find(a => a.id === tk.agency_id)?.name || 'Inconnue'}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg uppercase tracking-tight border border-transparent dark:border-gray-700">{tk.profile}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-xs tabular-nums dark:text-white">
                      {tk.price.toLocaleString()} <span className="text-[8px] opacity-40 uppercase font-medium">XOF</span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center items-center gap-2">
                      {tk.status === TicketStatus.UNSOLD && isOnlyAdmin && (
                        <>
                          <button 
                            onClick={() => { 
                              setPriceTargetProfile(tk.profile); 
                              setNewPriceValue(tk.price.toString()); 
                              setShowPriceModal(true); 
                            }}
                            className="p-2 text-gray-300 hover:text-primary-500 transition-all active:scale-90"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => setShowSingleDeleteModal(tk)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-all active:scale-90"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      {tk.status === TicketStatus.SOLD && (
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/20 text-[8px] font-black uppercase rounded-lg">Vendu</span>
                      )}
                      {(isSuper || user.role === UserRole.SELLER) && tk.status === TicketStatus.UNSOLD && (
                        <span className="text-[8px] text-gray-400 uppercase font-black tracking-tighter">Lecture seule</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="py-32 flex flex-col items-center justify-center text-gray-400">
              <Layers className="w-16 h-16 opacity-10 mb-4" />
              <p className="font-black uppercase text-[10px] tracking-[0.3em]">Aucun ticket</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Single Delete (Uniquement pour ADMIN) */}
      {showSingleDeleteModal && isOnlyAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-sm rounded-[2.5rem] p-10 shadow-2xl text-center border dark:border-gray-700">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner"><AlertCircle size={40} /></div>
            <h3 className="text-xl font-black uppercase mb-2 text-gray-900 dark:text-white">Supprimer Ticket ?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8 leading-relaxed">Voulez-vous supprimer le ticket <b>{showSingleDeleteModal.username}</b> de l'inventaire ?</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleDeleteSingle} disabled={isDeleting} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-sm uppercase flex justify-center items-center gap-2 shadow-xl shadow-red-500/20 active:scale-95">
                {isDeleting && <Loader2 size={16} className="animate-spin" />} Supprimer
              </button>
              <button onClick={() => setShowSingleDeleteModal(null)} className="w-full py-4 text-xs font-black uppercase text-gray-400 active:scale-95">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Purge Profile (Uniquement pour ADMIN) */}
      {showPurgeModal && isOnlyAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl text-center border dark:border-gray-700">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner"><ShieldAlert size={40} /></div>
            <h3 className="text-xl font-black uppercase mb-4 text-gray-900 dark:text-white">Purge Inventaire</h3>
            <div className="space-y-4 mb-8">
              <label className="text-[10px] font-black uppercase text-gray-400 text-left block ml-2">Profil à vider</label>
              <select 
                className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-bold text-sm dark:text-white"
                value={purgeTargetProfile}
                onChange={e => setPurgeTargetProfile(e.target.value)}
              >
                {uniqueProfiles.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handlePurgeProfile} disabled={isDeleting} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-sm uppercase flex justify-center items-center gap-2 shadow-xl active:scale-95">
                {isDeleting && <Loader2 size={16} className="animate-spin" />} Confirmer Purge
              </button>
              <button onClick={() => setShowPurgeModal(false)} className="w-full py-4 text-xs font-black uppercase text-gray-400 active:scale-95">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Price Modal (Uniquement pour ADMIN) */}
      {showPriceModal && isOnlyAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl border dark:border-gray-700">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">Prix Profil</h3>
              <button onClick={() => setShowPriceModal(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 active:scale-90"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdatePrice} className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-3">Profil</label>
                <select 
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-bold text-sm dark:text-white"
                  value={priceTargetProfile}
                  onChange={e => {
                    const prof = e.target.value;
                    setPriceTargetProfile(prof);
                    const sample = tickets.find(t => t.profile === prof && t.status === TicketStatus.UNSOLD);
                    if (sample) setNewPriceValue(sample.price.toString());
                  }}
                >
                  {uniqueProfiles.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-3">Nouveau Tarif (XOF)</label>
                <input type="number" className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl font-black text-2xl text-center dark:text-white outline-none focus:ring-2 focus:ring-primary-500/20 transition-all" value={newPriceValue} onChange={e => setNewPriceValue(e.target.value)} required />
              </div>
              <button type="submit" disabled={isUpdatingPrice} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase shadow-xl flex justify-center items-center gap-2 active:scale-95 transition-all">
                {isUpdatingPrice ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Appliquer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal (Uniquement pour ADMIN) */}
      {showImport && isOnlyAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl border dark:border-gray-700">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">Import CSV</h3>
              <button onClick={() => setShowImport(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full active:scale-90"><X size={20} /></button>
            </div>
            {isSuper && (
              <div className="mb-6 space-y-2 text-left">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-3">Agence Cible</label>
                <select className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-black text-xs uppercase" value={importTargetAgencyId} onChange={e => setImportTargetAgencyId(e.target.value)}>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <label className={`w-full flex flex-col items-center justify-center p-12 border-4 border-dashed rounded-[2.5rem] transition-all cursor-pointer ${isImporting ? 'border-primary-500 bg-primary-50/20' : 'border-gray-100 dark:border-gray-700 hover:border-primary-400'}`}>
              {isImporting ? <Loader2 size={40} className="animate-spin text-primary-600"/> : <FileUp size={40} className="text-primary-600" />}
              <p className="font-black text-[11px] text-gray-600 dark:text-gray-300 uppercase mt-4">Choisir CSV</p>
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" disabled={isImporting} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketManager;