
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileUp, X, Loader2, Info, Layers, CheckCircle2, AlertCircle, Edit2, Tag } from 'lucide-react';
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
  
  const [showImport, setShowImport] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceTargetProfile, setPriceTargetProfile] = useState('');
  const [newPriceValue, setNewPriceValue] = useState('');
  
  const [importTargetAgencyId, setImportTargetAgencyId] = useState(user.agency_id);

  const t = translations[lang];
  const isSuper = user.role === UserRole.SUPER_ADMIN;

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
    if (!file) return;
    
    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        if (!text || text.trim().length === 0) throw new Error("Fichier vide.");

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) throw new Error("Format CSV corrompu.");

        const firstLine = lines[0];
        const delimiter = firstLine.includes(';') ? ';' : firstLine.includes(',') ? ',' : '\t';
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

        if (rows.length === 0) throw new Error("Aucune donnée exploitable trouvée.");

        const targetAid = isSuper ? importTargetAgencyId : user.agency_id;
        const res = await supabase.importTickets(rows, user.id, targetAid);
        
        notify('success', `${res.success} tickets ajoutés (Coût: ${res.cost.toFixed(2)}).`);
        setShowImport(false);
        loadData();
      } catch (err: any) {
        notify('error', err.message || "Erreur d'importation.");
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    
    reader.onerror = () => {
      notify('error', "Lecture impossible.");
      setIsImporting(false);
    };
    
    reader.readAsText(file);
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseInt(newPriceValue);
    if (isNaN(price) || price < 0 || !priceTargetProfile) return;

    setIsUpdatingPrice(true);
    try {
      const targetAid = isSuper ? (selectedAgency === 'ALL' ? user.agency_id : selectedAgency) : user.agency_id;
      await supabase.updateTicketsPriceByProfile(targetAid, priceTargetProfile, price, user);
      notify('success', `Tarifs mis à jour pour "${priceTargetProfile}".`);
      setShowPriceModal(false);
      loadData();
    } catch (err) {
      notify('error', "Échec de la mise à jour des prix.");
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return tickets.filter(tk => {
      const matchSearch = tk.username.toLowerCase().includes(s) || 
                          tk.profile.toLowerCase().includes(s);
      const matchStatus = filterStatus === 'ALL' || tk.status === filterStatus;
      const matchAgency = selectedAgency === 'ALL' || tk.agency_id === selectedAgency;
      return matchSearch && matchStatus && matchAgency;
    });
  }, [tickets, search, filterStatus, selectedAgency]);

  const uniqueProfiles = useMemo(() => {
    return Array.from(new Set(tickets.map(t => t.profile))).sort();
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
        <div className="flex gap-2 w-full sm:w-auto">
          {user.role !== UserRole.SELLER && (
            <>
              <button 
                onClick={() => {
                  if (uniqueProfiles.length > 0) {
                    setPriceTargetProfile(uniqueProfiles[0]);
                    setShowPriceModal(true);
                  } else {
                    notify('info', "Aucun profil disponible en stock.");
                  }
                }} 
                className="flex-1 sm:flex-none bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800"
              >
                <Tag size={16}/> Tarifs
              </button>
              <button 
                onClick={() => setShowImport(true)} 
                className="flex-1 sm:flex-none bg-primary-600 text-white px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
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
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Synchronisation...</span>
          </div>
        )}
        
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-6 py-5">Code WiFi</th>
                <th className="px-6 py-5">Forfait</th>
                <th className="px-6 py-5 text-right">Tarif</th>
                <th className="px-6 py-5 text-center">État</th>
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
                    <div className="flex items-center justify-end gap-2 group/price">
                      <span className="font-black text-xs tabular-nums dark:text-white">
                        {tk.price.toLocaleString()} <span className="text-[8px] opacity-40 uppercase font-medium">XOF</span>
                      </span>
                      {tk.status === TicketStatus.UNSOLD && user.role !== UserRole.SELLER && (
                        <button 
                          onClick={() => {
                            setPriceTargetProfile(tk.profile);
                            setNewPriceValue(tk.price.toString());
                            setShowPriceModal(true);
                          }}
                          className="p-1.5 text-gray-300 hover:text-primary-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <span className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5 ${
                        tk.status === TicketStatus.UNSOLD 
                        ? 'bg-green-50 text-green-600 border border-green-100 dark:bg-green-900/20 dark:border-green-800' 
                        : 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
                      }`}>
                        {tk.status === TicketStatus.UNSOLD ? <CheckCircle2 size={10}/> : <Layers size={10}/>}
                        {tk.status === TicketStatus.UNSOLD ? t.unsold : t.sold}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {!loading && filtered.length === 0 && (
            <div className="py-32 flex flex-col items-center justify-center text-gray-400">
              <Layers className="w-16 h-16 opacity-10 mb-4" />
              <p className="font-black uppercase text-[10px] tracking-[0.3em]">Inventaire vide</p>
              <button onClick={loadData} className="mt-4 text-[9px] font-bold text-primary-500 underline">Rafraîchir</button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Bulk Price Update */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 border border-white/20 dark:border-gray-700/50">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">Prix Profil</h3>
              <button onClick={() => setShowPriceModal(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-all active:scale-90">
                <X size={20} />
              </button>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-[2rem] mb-8 flex gap-4 border border-indigo-100 dark:border-indigo-800/50 text-left">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-800/20 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Tag size={22} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-black uppercase tracking-widest">Modification tarifaire</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">Le nouveau prix sera appliqué à tous les tickets invendus du profil sélectionné.</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePrice} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">Profil Cible</label>
                <select 
                  className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-black text-xs uppercase tracking-tight border-2 border-transparent focus:border-primary-500/30 transition-all appearance-none cursor-pointer dark:text-white"
                  value={priceTargetProfile}
                  onChange={(e) => {
                    setPriceTargetProfile(e.target.value);
                    const sample = tickets.find(t => t.profile === e.target.value);
                    if (sample) setNewPriceValue(sample.price.toString());
                  }}
                >
                  {uniqueProfiles.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">Nouveau Tarif (XOF)</label>
                <input 
                  type="number" 
                  autoFocus
                  className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-black text-2xl text-center tracking-tight border-2 border-transparent focus:border-primary-500/30 transition-all dark:text-white"
                  value={newPriceValue}
                  onChange={(e) => setNewPriceValue(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowPriceModal(false)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-500">Annuler</button>
                <button 
                  type="submit" 
                  disabled={isUpdatingPrice}
                  className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/30 flex justify-center items-center gap-2"
                >
                  {isUpdatingPrice ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 size={16} />}
                  Mettre à jour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 border border-white/20 dark:border-gray-700/50">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">{t.importCsv}</h3>
              <button onClick={() => setShowImport(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-all active:scale-90">
                <X size={20} />
              </button>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-[2rem] mb-8 flex gap-4 border border-amber-100 dark:border-amber-800/50 text-left">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/20 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                <Info size={22} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-amber-700 dark:text-amber-500 font-black uppercase tracking-widest">Coût credits</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{t.importRuleInfo}</p>
              </div>
            </div>

            <div className="space-y-6">
              {isSuper && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">Cible agence</label>
                  <select 
                    className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-black text-xs uppercase tracking-tight border-2 border-transparent focus:border-primary-500/30 transition-all appearance-none cursor-pointer dark:text-white"
                    value={importTargetAgencyId}
                    onChange={(e) => setImportTargetAgencyId(e.target.value)}
                  >
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              
              <div className="relative">
                <label className={`w-full flex flex-col items-center justify-center p-12 border-4 border-dashed rounded-[2.5rem] transition-all cursor-pointer ${
                  isImporting 
                  ? 'border-primary-500 bg-primary-50/20' 
                  : 'border-gray-100 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50/5'
                }`}>
                  {isImporting ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={40} className="animate-spin text-primary-600"/>
                      <p className="font-black text-[10px] text-primary-600 uppercase tracking-widest animate-pulse">Chargement...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-2xl flex items-center justify-center mb-1">
                         <FileUp size={30} />
                      </div>
                      <p className="font-black text-[11px] text-gray-600 dark:text-gray-300 uppercase tracking-widest">Choisir CSV</p>
                      <p className="text-[9px] text-gray-400 font-medium text-center leading-tight px-4">Glissez Mikhmon CSV ici ou cliquez</p>
                    </div>
                  )}
                  <input type="file" accept=".csv" onChange={handleImport} className="hidden" disabled={isImporting} />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketManager;
