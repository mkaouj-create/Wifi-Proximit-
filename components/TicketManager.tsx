
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileUp, X, Edit2, Trash2, Loader2, Tags, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Ticket, UserProfile, TicketStatus, UserRole, Agency } from '../types';
import { translations, Language } from '../i18n';

const TicketManager: React.FC<{ user: UserProfile, lang: Language }> = ({ user, lang }) => {
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

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tks, ags] = await Promise.all([
      supabase.getTickets(user.agency_id, user.role),
      isSuper ? supabase.getAgencies() : Promise.resolve([])
    ]);
    setTickets(tks);
    setAgencies(ags);
    setLoading(false);
  }, [user, isSuper]);

  useEffect(() => { loadData(); }, [loadData]);

  const uniqueProfiles = useMemo(() => 
    Array.from(new Set(tickets.filter(tk => tk.status === TicketStatus.UNSOLD).map(tk => tk.profile))),
    [tickets]
  );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      if (lines.length < 2) {
          alert("Fichier vide ou invalide.");
          setLoading(false);
          return;
      }

      // 1. Analyse des en-têtes (Headers)
      const headers = lines[0].toLowerCase().split(/[;,]/).map(h => h.trim().replace(/^["']|["']$/g, ''));
      const dataLines = lines.slice(1);

      // Mapping d'index dynamique basé sur les mots-clés Mikhmon standards
      const idx = {
        user: headers.findIndex(h => h.includes('user') || h.includes('name') || h === 'code' || h === 'login' || h === 'identifiant'),
        pass: headers.findIndex(h => h.includes('pass') || h === 'pwd' || h === 'mot de passe'),
        prof: headers.findIndex(h => h.includes('prof') || h === 'forfait' || h === 'plan'),
        limit: headers.findIndex(h => h.includes('limit') || h.includes('time') || h.includes('valid') || h === 'uptime'),
        price: headers.findIndex(h => h.includes('price') || h.includes('prix') || h === 'amount' || h === 'tarif')
      };

      // 2. Traitement des lignes de données
      const rows = dataLines.map(line => {
        const p = line.split(/[;,]/).map(v => v.replace(/^["']|["']$/g, '').trim());
        return { 
            username: idx.user !== -1 ? p[idx.user] : p[0], 
            password: idx.pass !== -1 ? p[idx.pass] : p[1] || '', 
            profile: idx.prof !== -1 ? p[idx.prof] : p[2] || 'Default', 
            time_limit: idx.limit !== -1 ? p[idx.limit] : p[3] || 'N/A', 
            price: idx.price !== -1 ? (parseInt(p[idx.price]) || 0) : (parseInt(p[4]) || 0) 
        };
      }).filter(r => r.username && r.username.length > 0);

      if (rows.length === 0) {
          alert("Aucune donnée valide trouvée dans le fichier.");
          setLoading(false);
          return;
      }

      const targetAgency = isSuper ? (document.getElementById('importAid') as HTMLSelectElement).value : user.agency_id;
      const res = await supabase.importTickets(rows, user.id, targetAgency);
      
      alert(`${res.success} nouveaux tickets importés. ${res.skipped} doublons ignorés.`);
      setShowImport(false);
      loadData();
    };
    reader.readAsText(file);
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkProfile || !newPrice) return;
    setLoading(true);
    const count = await supabase.updateProfilePrices(user.agency_id, bulkProfile, parseInt(newPrice));
    alert(`${count} tickets "${bulkProfile}" mis à jour.`);
    setShowBulkPrice(false);
    setNewPrice('');
    loadData();
  };

  const filtered = tickets.filter(tk => {
    const mSearch = tk.username.toLowerCase().includes(search.toLowerCase()) || tk.profile.toLowerCase().includes(search.toLowerCase());
    const mStatus = filterStatus === 'ALL' || tk.status === filterStatus;
    const mAgency = selectedAgency === 'ALL' || tk.agency_id === selectedAgency;
    return mSearch && mStatus && mAgency;
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black dark:text-white">{t.inventory}</h2>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{filtered.length} tickets visibles</p>
        </div>
        <div className="flex gap-2">
            {user.role !== UserRole.SELLER && (
                <>
                <button onClick={() => setShowBulkPrice(true)} className="bg-amber-500 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-amber-600 transition-all">
                    <Layers size={14}/> {t.bulkPrice}
                </button>
                <button onClick={() => setShowImport(true)} className="bg-primary-600 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-primary-700 transition-all">
                    <FileUp size={14}/> {t.importCsv}
                </button>
                </>
            )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-sm border dark:border-gray-700">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
          <input type="text" placeholder={t.searchPlaceholder} className="w-full pl-12 pr-4 py-3 bg-transparent outline-none font-bold text-sm dark:text-white" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 border-l dark:border-gray-700 pl-2">
          {isSuper && (
            <select className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none dark:text-white cursor-pointer" value={selectedAgency} onChange={e => setSelectedAgency(e.target.value)}>
              <option value="ALL">Toutes Agences</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none dark:text-white cursor-pointer" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="ALL">Tous Statuts</option>
            <option value="UNSOLD">En Stock</option>
            <option value="SOLD">Vendu</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border dark:border-gray-700 shadow-sm">
        {loading ? (
          <div className="p-20 flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-primary-600" size={40}/>
            <p className="text-[10px] font-black text-gray-400 uppercase">Chargement en cours...</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-[10px] font-black uppercase text-gray-400">
                <tr><th className="px-6 py-4">Utilisateur</th><th className="px-6 py-4">Forfait</th><th className="px-6 py-4 text-right">Prix</th><th className="px-6 py-4 text-center">Statut</th><th className="px-6 py-4"></th></tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {filtered.slice(0, 100).map(tk => (
                  <tr key={tk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 group">
                    <td className="px-6 py-4"><span className="font-black dark:text-white group-hover:text-primary-600 transition-colors">{tk.username}</span><br/><span className="text-[10px] text-gray-400 font-bold">{tk.time_limit}</span></td>
                    <td className="px-6 py-4"><span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-[10px]">{tk.profile}</span></td>
                    <td className="px-6 py-4 text-right font-black dark:text-white">{tk.price.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${tk.status === TicketStatus.UNSOLD ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {tk.status === TicketStatus.UNSOLD ? 'STOCK' : 'VENDU'}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {tk.status === TicketStatus.UNSOLD && user.role !== UserRole.SELLER && (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingTicket(tk); setNewPrice(tk.price.toString()); }} className="p-2 text-primary-600 bg-primary-50 rounded-lg"><Edit2 size={14}/></button>
                          <button onClick={async () => { if(confirm(t.confirmDeleteTicket)) { await supabase.deleteTicket(tk.id); loadData(); } }} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL IMPORT */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black mb-6 dark:text-white">Importer des tickets</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl mb-6 flex gap-3 items-start border border-gray-100 dark:border-gray-800">
                <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed">
                    Importation Mikhmon : Le système détecte automatiquement les colonnes 'username', 'profile', 'price' et 'limit'.<br/>Les doublons existants dans votre agence seront ignorés.
                </p>
            </div>
            {isSuper && (
              <div className="mb-6"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Agence Cible</label>
              <select id="importAid" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-bold mt-1 dark:text-white">{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            )}
            <input type="file" accept=".csv" onChange={handleImport} className="w-full p-8 border-4 border-dashed rounded-[2rem] text-center font-bold text-gray-400 cursor-pointer hover:border-primary-500 transition-colors" />
            <button onClick={() => setShowImport(false)} className="w-full mt-6 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black uppercase tracking-widest text-[10px]">Annuler</button>
          </div>
        </div>
      )}

      {/* MODAL PRIX GROUPÉ */}
      {showBulkPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black mb-6 dark:text-white">{t.bulkPrice}</h3>
            <form onSubmit={handleBulkUpdate} className="space-y-4">
                <select className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-bold dark:text-white" value={bulkProfile} onChange={e => setBulkProfile(e.target.value)} required>
                    <option value="">Sélectionner un Forfait...</option>
                    {uniqueProfiles.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="number" placeholder="Nouveau prix (ex: 500)" className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-black text-xl dark:text-white" value={newPrice} onChange={e => setNewPrice(e.target.value)} required />
                <div className="flex gap-4 mt-6">
                    <button type="button" onClick={() => setShowBulkPrice(false)} className="flex-1 py-4 font-black uppercase text-[10px]">Annuler</button>
                    <button type="submit" className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Modifier tout</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MODIF TICKET UNIQUE */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black mb-6 dark:text-white">Modifier le tarif</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">{editingTicket.username}</p>
            <input type="number" className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-black text-2xl dark:text-white" value={newPrice} onChange={e => setNewPrice(e.target.value)} autoFocus />
            <div className="flex gap-4 mt-8">
              <button onClick={() => setEditingTicket(null)} className="flex-1 py-4 font-black uppercase text-[10px]">Annuler</button>
              <button onClick={async () => { await supabase.updateTicketPrice(editingTicket.id, parseInt(newPrice)); setEditingTicket(null); loadData(); }} className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Mettre à jour</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketManager;
