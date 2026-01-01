import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileUp, X, Edit2, Trash2, Loader2, Layers, Coins, Hash } from 'lucide-react';
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
  
  const [showImport, setShowImport] = useState(false);
  const [showBulkPrice, setShowBulkPrice] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [bulkProfile, setBulkProfile] = useState('');

  const t = translations[lang];
  const isSuper = user.role === UserRole.SUPER_ADMIN;

  // Chargement des données optimisé
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Chargement parallèle
      const promises: any[] = [supabase.getTickets(user.agency_id, user.role)];
      if (isSuper) promises.push(supabase.getAgencies());
      
      const results = await Promise.all(promises);
      const tks = results[0];
      
      setTickets(tks);
      if (isSuper && results[1]) setAgencies(results[1]);
      
    } catch (err) {
      notify('error', "Échec du chargement des données.");
    } finally {
      setLoading(false);
    }
  }, [user, isSuper, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  // Liste unique des profils pour le filtre de prix de groupe (basé sur le stock actuel)
  const uniqueProfiles = useMemo(() => 
    Array.from(new Set(tickets.map(tk => tk.profile))).sort(),
    [tickets]
  );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      if (!text) {
          setLoading(false);
          return;
      }

      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      if (lines.length < 1) {
          notify('error', "Le fichier est vide.");
          setLoading(false);
          return;
      }

      // Analyse intelligente des en-têtes
      const firstLine = lines[0].toLowerCase();
      // On retire les guillemets éventuels pour la recherche d'en-tête
      const headers = firstLine.split(/[;,]/).map(h => h.trim().replace(/^["']|["']$/g, ''));
      
      const idx = {
        user: headers.findIndex(h => h.includes('user') || h === 'login' || h === 'identifiant' || h === 'code'),
        pass: headers.findIndex(h => h.includes('pass') || h === 'pwd' || h === 'mot de passe'),
        prof: headers.findIndex(h => h.includes('prof') || h === 'forfait' || h === 'plan'),
        limit: headers.findIndex(h => h.includes('limit') || h.includes('time') || h === 'validité' || h === 'uptime'),
        price: headers.findIndex(h => h.includes('price') || h.includes('prix') || h === 'amount' || h === 'tarif')
      };

      // Détection format Mikhmon standard vs CSV générique
      // Si on trouve 'user' et 'profile' dans la première ligne, on assume qu'il y a un header
      const hasHeader = idx.user !== -1 && idx.prof !== -1;
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const rows = dataLines.map(line => {
        // Support CSV simple avec , ou ;
        const p = line.split(/[;,]/).map(v => v.replace(/^["']|["']$/g, '').trim());
        
        // Nettoyage du prix : on garde uniquement les chiffres
        const rawPrice = idx.price !== -1 ? p[idx.price] : "0";
        const cleanPrice = rawPrice ? parseInt(rawPrice.replace(/\D/g, '')) || 0 : 0;

        return { 
            username: hasHeader ? p[idx.user] : p[0], 
            password: idx.pass !== -1 ? p[idx.pass] : (hasHeader ? p[idx.pass] : p[1] || p[0]), 
            profile: idx.prof !== -1 ? p[idx.prof] : (p[2] || 'Default'), 
            time_limit: idx.limit !== -1 ? p[idx.limit] : (p[3] || 'N/A'), 
            price: cleanPrice 
        };
      }).filter(r => r.username && r.username.length > 0);

      if (rows.length === 0) {
          notify('error', "Aucune donnée valide n'a pu être extraite.");
          setLoading(false);
          return;
      }

      const importSelect = document.getElementById('importAid') as HTMLSelectElement;
      const targetAgency = isSuper && importSelect ? importSelect.value : user.agency_id;
      
      try {
        const res = await supabase.importTickets(rows, user.id, targetAgency);
        notify('success', `${res.success} tickets importés. Coût : ${res.cost || 0} crédits.`);
        setShowImport(false);
        loadData();
      } catch (err: any) {
        notify('error', err.message || "Erreur d'importation.");
      }
      setLoading(false);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input pour permettre de réimporter le même fichier
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkProfile || !newPrice) return;

    setLoading(true);
    try {
      const count = await supabase.updateProfilePrices(
        isSuper ? selectedAgency : null, 
        bulkProfile, 
        parseInt(newPrice),
        user
      );
      notify('success', `${count} tickets mis à jour.`);
      setShowBulkPrice(false);
      setNewPrice('');
      setBulkProfile('');
      loadData();
    } catch (e) {
      notify('error', "Échec de mise à jour.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    const config = {
      [TicketStatus.UNSOLD]: { color: 'bg-green-100 text-green-700', label: t.unsold },
      [TicketStatus.SOLD]: { color: 'bg-blue-100 text-blue-700', label: t.sold },
      [TicketStatus.ACTIVE]: { color: 'bg-amber-100 text-amber-700', label: t.active },
      [TicketStatus.EXPIRED]: { color: 'bg-red-100 text-red-700', label: t.expired },
    };
    const c = config[status] || config[TicketStatus.UNSOLD];
    return <span className={`px-2 md:px-3 py-1 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-tighter ${c.color}`}>{c.label}</span>;
  };

  const filtered = useMemo(() => {
    return tickets.filter(tk => {
        const mSearch = tk.username.toLowerCase().includes(search.toLowerCase()) || tk.profile.toLowerCase().includes(search.toLowerCase());
        const mStatus = filterStatus === 'ALL' || tk.status === filterStatus;
        const mAgency = selectedAgency === 'ALL' || tk.agency_id === selectedAgency;
        return mSearch && mStatus && mAgency;
      });
  }, [tickets, search, filterStatus, selectedAgency]);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black dark:text-white uppercase tracking-tight">{t.inventory}</h2>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none mt-1">{filtered.length} tickets affichés</p>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
            {user.role !== UserRole.SELLER && (
                <>
                <button onClick={() => setShowBulkPrice(true)} className="flex-1 sm:flex-none bg-amber-500 text-white px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
                    <Layers size={14}/> <span className="hidden xs:inline">{t.bulkPrice}</span><span className="xs:hidden">Prix</span>
                </button>
                <button onClick={() => setShowImport(true)} className="flex-1 sm:flex-none bg-primary-600 text-white px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95 transition-all">
                    <FileUp size={14}/> <span className="hidden xs:inline">{t.importCsv}</span><span className="xs:hidden">Import</span>
                </button>
                </>
            )}
        </div>
      </div>

      {/* FILTRES RESPONSIVES */}
      <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-gray-800 p-3 rounded-[1.5rem] md:rounded-3xl shadow-sm border dark:border-gray-700">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
          <input 
            type="text" 
            placeholder={t.searchPlaceholder} 
            className="w-full pl-12 pr-4 py-3 bg-transparent outline-none font-bold text-sm dark:text-white" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <div className="flex flex-wrap gap-2 md:border-l dark:border-gray-700 md:pl-2">
          {isSuper && (
            <select className="flex-1 md:flex-none bg-gray-50 dark:bg-gray-900 md:bg-transparent px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none dark:text-white cursor-pointer border md:border-none border-gray-100 dark:border-gray-700" value={selectedAgency} onChange={e => setSelectedAgency(e.target.value)}>
              <option value="ALL">Toutes Agences</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="flex-1 md:flex-none bg-gray-50 dark:bg-gray-900 md:bg-transparent px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none dark:text-white cursor-pointer border md:border-none border-gray-100 dark:border-gray-700" value={filterStatus} onChange={e => setFilterStatus(e.target.value as TicketStatus | 'ALL')}>
            <option value="ALL">Tous Statuts</option>
            <option value="UNSOLD">Stock</option>
            <option value="SOLD">Vendu</option>
            <option value="ACTIVE">Actif</option>
            <option value="EXPIRED">Expiré</option>
          </select>
        </div>
      </div>

      {/* TICKET LIST - TABLE VS CARDS */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border dark:border-gray-700 shadow-sm relative min-h-[400px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-[1px] z-10">
            <Loader2 className="animate-spin text-primary-600" size={32}/>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Synchronisation...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center opacity-40">
            <Hash size={48} className="mb-4" />
            <p className="font-black text-xs uppercase tracking-widest">Aucun ticket trouvé</p>
          </div>
        ) : (
          <>
            {/* VUE TABLE (Desktop >= 768px) */}
            <div className="hidden md:block overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-[10px] font-black uppercase text-gray-400">
                  <tr>
                    <th className="px-6 py-4">Utilisateur</th>
                    <th className="px-6 py-4">Forfait</th>
                    <th className="px-6 py-4 text-right">Prix</th>
                    <th className="px-6 py-4 text-center">Statut</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {filtered.slice(0, 100).map(tk => (
                    <tr key={tk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 group transition-all">
                      <td className="px-6 py-4">
                        <span className="font-black dark:text-white group-hover:text-primary-600 transition-colors uppercase">{tk.username}</span>
                        <br/>
                        <span className="text-[9px] text-gray-400 font-bold tracking-tight">{tk.time_limit}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-[9px] uppercase">{tk.profile}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-black dark:text-white tabular-nums">
                        {tk.price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(tk.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {tk.status === TicketStatus.UNSOLD && user.role !== UserRole.SELLER && (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingTicket(tk); setNewPrice(tk.price.toString()); }} className="p-2 text-primary-600 bg-primary-50 rounded-lg active:scale-90 transition-all"><Edit2 size={14}/></button>
                            <button onClick={async () => { if(confirm(t.confirmDeleteTicket)) { await supabase.deleteTicket(tk.id); notify('info', 'Ticket supprimé'); loadData(); } }} className="p-2 text-red-500 bg-red-50 rounded-lg active:scale-90 transition-all"><Trash2 size={14}/></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* VUE CARDS (Mobile < 768px) */}
            <div className="md:hidden grid grid-cols-1 divide-y dark:divide-gray-700">
               {filtered.slice(0, 50).map(tk => (
                 <div key={tk.id} className="p-5 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-900 transition-colors">
                    <div className="space-y-1">
                        <p className="font-black text-sm dark:text-white uppercase leading-none">{tk.username}</p>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] text-gray-400 font-bold uppercase">{tk.time_limit}</span>
                           <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                           <span className="text-[10px] text-primary-500 font-black uppercase">{tk.profile}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                           <p className="font-black text-sm tabular-nums">{tk.price.toLocaleString()}</p>
                           {getStatusBadge(tk.status)}
                        </div>
                        {tk.status === TicketStatus.UNSOLD && user.role !== UserRole.SELLER && (
                           <div className="flex gap-2">
                              <button onClick={() => { setEditingTicket(tk); setNewPrice(tk.price.toString()); }} className="p-2 text-primary-600 bg-primary-50 rounded-lg"><Edit2 size={12}/></button>
                              <button onClick={async () => { if(confirm(t.confirmDeleteTicket)) { await supabase.deleteTicket(tk.id); notify('info', 'Ticket supprimé'); loadData(); } }} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 size={12}/></button>
                           </div>
                        )}
                    </div>
                 </div>
               ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL IMPORT - FULL SCREEN MOBILE */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full md:max-w-md h-full md:h-auto md:rounded-[2.5rem] p-8 md:p-10 shadow-2xl animate-in slide-in-from-bottom md:zoom-in flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Importer des tickets</h3>
                <button onClick={() => setShowImport(false)} className="md:hidden p-2 text-gray-400"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl flex gap-3 items-start border border-amber-100 dark:border-amber-800">
                    <Coins size={20} className="text-amber-500 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-widest leading-none">Règles de facturation</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold leading-relaxed">
                            1 Crédit = 20 tickets importés.<br/>
                            <span className="text-green-600 dark:text-green-400 font-black uppercase">50 premiers offerts !</span>
                        </p>
                    </div>
                </div>

                {isSuper && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Agence Cible</label>
                    <select id="importAid" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-bold dark:text-white border border-transparent focus:border-primary-500/30">
                        {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Fichier CSV</label>
                    <label className="w-full flex flex-col items-center justify-center p-12 border-4 border-dashed rounded-[2rem] border-gray-100 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50/10 transition-all cursor-pointer group">
                        <FileUp size={40} className="text-gray-300 group-hover:text-primary-500 mb-4" />
                        <p className="font-black text-xs text-gray-400 group-hover:text-primary-600 transition-colors uppercase tracking-widest">Choisir un fichier</p>
                        <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
                    </label>
                </div>
            </div>

            <button onClick={() => setShowImport(false)} className="w-full mt-8 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black uppercase tracking-widest text-[10px] text-gray-500 active:scale-95 transition-all">Annuler l'import</button>
          </div>
        </div>
      )}

      {/* MODAL PRIX GROUPÉ */}
      {showBulkPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black mb-6 dark:text-white uppercase tracking-tight leading-none">{t.bulkPrice}</h3>
            <form onSubmit={handleBulkUpdate} className="space-y-4">
                <select className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-bold dark:text-white border border-transparent focus:border-primary-500/30" value={bulkProfile} onChange={e => setBulkProfile(e.target.value)} required>
                    <option value="">Sélectionner Forfait...</option>
                    {uniqueProfiles.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input 
                  type="number" 
                  placeholder="Nouveau prix (ex: 5000)" 
                  className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-black text-2xl dark:text-white border border-transparent focus:border-primary-500/30" 
                  value={newPrice} 
                  onChange={e => setNewPrice(e.target.value)} 
                  required 
                />
                <div className="flex gap-4 mt-8">
                    <button type="button" onClick={() => setShowBulkPrice(false)} className="flex-1 py-4 font-black uppercase text-[10px] text-gray-400">Annuler</button>
                    <button type="submit" className="flex-1 py-5 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-amber-500/20 active:scale-95 transition-all">Mettre à jour</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MODIF TICKET UNIQUE */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black mb-6 dark:text-white uppercase tracking-tight leading-none">Modifier Tarif</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">{editingTicket.username}</p>
            <input 
              type="number" 
              className="w-full p-6 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-black text-3xl dark:text-white border border-transparent focus:border-primary-500/30" 
              value={newPrice} 
              onChange={e => setNewPrice(e.target.value)} 
              autoFocus 
            />
            <div className="flex gap-3 mt-8">
              <button onClick={() => setEditingTicket(null)} className="flex-1 py-4 font-black uppercase text-[10px] text-gray-400">Annuler</button>
              <button onClick={async () => { await supabase.updateTicketPrice(editingTicket.id, parseInt(newPrice)); notify('success', 'Prix mis à jour'); setEditingTicket(null); loadData(); }} className="flex-1 py-5 bg-primary-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-primary-500/30 active:scale-95 transition-all">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketManager;