
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileUp, X, Edit2, Trash2, Loader2, Layers, Coins, Info, Hash } from 'lucide-react';
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const promises: any[] = [supabase.getTickets(user.agency_id, user.role)];
      if (isSuper) promises.push(supabase.getAgencies());
      const results = await Promise.all(promises);
      setTickets(results[0]);
      if (isSuper && results[1]) setAgencies(results[1]);
    } catch (err) {
      notify('error', "Échec du chargement.");
    } finally {
      setLoading(false);
    }
  }, [user, isSuper, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  const uniqueProfiles = useMemo(() => Array.from(new Set(tickets.map(tk => tk.profile))).sort(), [tickets]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      if (!text) return setLoading(false);
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      const headers = lines[0].toLowerCase().split(/[;,]/).map(h => h.trim().replace(/^["']|["']$/g, ''));
      const idx = {
        user: headers.findIndex(h => h.includes('user') || h === 'login' || h === 'identifiant'),
        pass: headers.findIndex(h => h.includes('pass') || h === 'pwd'),
        prof: headers.findIndex(h => h.includes('prof') || h === 'forfait'),
        price: headers.findIndex(h => h.includes('price') || h === 'prix')
      };
      const dataLines = idx.user !== -1 ? lines.slice(1) : lines;
      const rows = dataLines.map(line => {
        const p = line.split(/[;,]/).map(v => v.replace(/^["']|["']$/g, '').trim());
        return { 
          username: idx.user !== -1 ? p[idx.user] : p[0], 
          password: idx.pass !== -1 ? p[idx.pass] : (p[1] || p[0]), 
          profile: idx.prof !== -1 ? p[idx.prof] : (p[2] || 'Default'), 
          price: idx.price !== -1 ? parseInt(p[idx.price].replace(/\D/g, '')) || 0 : 0
        };
      }).filter(r => r.username);

      try {
        const target = isSuper ? (document.getElementById('importAid') as HTMLSelectElement).value : user.agency_id;
        const res = await supabase.importTickets(rows, user.id, target);
        notify('success', `${res.success} tickets importés. Coût: ${res.cost.toFixed(2)} crédits.`);
        setShowImport(false);
        loadData();
      } catch (err: any) { notify('error', err.message); }
      setLoading(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filtered = useMemo(() => tickets.filter(tk => {
    const mSearch = tk.username.toLowerCase().includes(search.toLowerCase()) || tk.profile.toLowerCase().includes(search.toLowerCase());
    const mStatus = filterStatus === 'ALL' || tk.status === filterStatus;
    const mAgency = selectedAgency === 'ALL' || tk.agency_id === selectedAgency;
    return mSearch && mStatus && mAgency;
  }), [tickets, search, filterStatus, selectedAgency]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black dark:text-white uppercase">{t.inventory}</h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase">{filtered.length} tickets</p>
        </div>
        <div className="flex gap-2">
          {user.role !== UserRole.SELLER && (
            <button onClick={() => setShowImport(true)} className="bg-primary-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-primary-500/20 active:scale-95 flex items-center gap-2">
              <FileUp size={14}/> {t.importCsv}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-3 rounded-3xl shadow-sm border dark:border-gray-700 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
          <input type="text" placeholder={t.searchPlaceholder} className="w-full pl-12 pr-4 py-3 bg-transparent outline-none font-bold text-sm dark:text-white" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {isSuper && (
            <select className="bg-gray-50 dark:bg-gray-900 px-4 py-3 rounded-xl text-[9px] font-black uppercase outline-none" value={selectedAgency} onChange={e => setSelectedAgency(e.target.value)}>
              <option value="ALL">Toutes Agences</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="bg-gray-50 dark:bg-gray-900 px-4 py-3 rounded-xl text-[9px] font-black uppercase outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="ALL">Tous Statuts</option>
            <option value="UNSOLD">{t.unsold}</option>
            <option value="SOLD">{t.sold}</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border dark:border-gray-700 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-[10px] font-black uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4">Utilisateur</th>
                <th className="px-6 py-4">Profil</th>
                <th className="px-6 py-4 text-right">Prix</th>
                <th className="px-6 py-4 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filtered.slice(0, 50).map(tk => (
                <tr key={tk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-6 py-4 font-black text-xs dark:text-white uppercase">{tk.username}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-gray-500">{tk.profile}</td>
                  <td className="px-6 py-4 text-right font-black text-xs">{tk.price.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${tk.status === 'UNSOLD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {tk.status === 'UNSOLD' ? t.unsold : t.sold}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black uppercase mb-6">{t.importCsv}</h3>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl mb-6 flex gap-3 border border-amber-100 dark:border-amber-800">
              <Info size={20} className="text-amber-500 shrink-0" />
              <div className="space-y-1">
                <p className="text-[10px] text-amber-600 font-black uppercase">Tarification</p>
                <p className="text-[10px] text-gray-500 font-medium">{t.importRuleInfo}</p>
              </div>
            </div>

            <div className="space-y-4">
              {isSuper && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Agence Cible</label>
                  <select id="importAid" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-bold border border-transparent focus:border-primary-500/30">
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <label className="w-full flex flex-col items-center justify-center p-10 border-4 border-dashed rounded-3xl border-gray-100 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50/10 cursor-pointer">
                <FileUp size={32} className="text-gray-300 mb-3" />
                <p className="font-black text-[10px] text-gray-400 uppercase">Choisir CSV</p>
                <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
              </label>
            </div>
            <button onClick={() => setShowImport(false)} className="w-full mt-6 py-4 text-[10px] font-black uppercase text-gray-400">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketManager;
