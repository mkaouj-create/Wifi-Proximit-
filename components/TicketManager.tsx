
import React, { useState, useEffect, useCallback } from 'react';
import { Search, FileUp, X, Check, Edit2, Tags, Info, Building2, ChevronDown, Filter, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
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
  
  // Modals
  const [showImport, setShowImport] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);
  const [newPrice, setNewPrice] = useState('');

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim().length > 0).slice(1);
      const rows = lines.map(line => {
        const p = line.split(/[;,]/).map(v => v.replace(/^["']|["']$/g, '').trim());
        return { username: p[0], password: p[1], profile: p[2], time_limit: p[3], price: parseInt(p[4]) || 0 };
      }).filter(r => r.username);

      const target = isSuper ? (document.getElementById('importAid') as HTMLSelectElement).value : user.agency_id;
      setLoading(true);
      await supabase.importTickets(rows, user.id, target);
      setShowImport(false);
      loadData();
    };
    reader.readAsText(file);
  };

  const filtered = tickets.filter(tk => {
    const mSearch = tk.username.toLowerCase().includes(search.toLowerCase()) || tk.profile.toLowerCase().includes(search.toLowerCase());
    const mStatus = filterStatus === 'ALL' || tk.status === filterStatus;
    const mAgency = selectedAgency === 'ALL' || tk.agency_id === selectedAgency;
    return mSearch && mStatus && mAgency;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-black dark:text-white">{t.inventory}</h2><p className="text-xs text-gray-500 font-bold uppercase">{filtered.length} tickets</p></div>
        {user.role !== UserRole.SELLER && (
          <button onClick={() => setShowImport(true)} className="bg-primary-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all">
            <FileUp size={18}/> {t.importCsv}
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-sm border dark:border-gray-700">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
          <input type="text" placeholder={t.searchPlaceholder} className="w-full pl-12 pr-4 py-3 bg-transparent outline-none font-bold text-sm dark:text-white" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 border-l dark:border-gray-700 pl-2">
          {isSuper && (
            <select className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none dark:text-white" value={selectedAgency} onChange={e => setSelectedAgency(e.target.value)}>
              <option value="ALL">Toutes Agences</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none dark:text-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="ALL">Tous Statuts</option>
            <option value="UNSOLD">{t.unsold}</option>
            <option value="SOLD">{t.sold}</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border dark:border-gray-700 shadow-sm">
        {loading ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary-600" size={40}/></div> : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-[10px] font-black uppercase text-gray-400">
                <tr><th className="px-6 py-4">Utilisateur</th><th className="px-6 py-4">Forfait</th><th className="px-6 py-4 text-right">Prix</th><th className="px-6 py-4 text-center">Statut</th><th className="px-6 py-4"></th></tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {filtered.map(tk => (
                  <tr key={tk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-4"><span className="font-black dark:text-white">{tk.username}</span><br/><span className="text-[10px] text-gray-400 font-bold">{tk.time_limit}</span></td>
                    <td className="px-6 py-4"><span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-[10px]">{tk.profile}</span></td>
                    <td className="px-6 py-4 text-right font-black dark:text-white">{tk.price.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-3 py-1 rounded-lg text-[10px] font-black ${tk.status === 'UNSOLD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{tk.status === 'UNSOLD' ? 'STOCK' : 'VENDU'}</span></td>
                    <td className="px-6 py-4 text-right">
                      {tk.status === 'UNSOLD' && user.role !== UserRole.SELLER && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setEditingTicket(tk); setNewPrice(tk.price.toString()); }} className="p-2 text-primary-600"><Edit2 size={16}/></button>
                          <button onClick={() => setTicketToDelete(tk)} className="p-2 text-red-500"><Trash2 size={16}/></button>
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

      {/* MODALS STANDARDISÉES */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in">
            <h3 className="text-xl font-black mb-6 dark:text-white">{t.importCsv}</h3>
            {isSuper && (
              <div className="mb-6"><label className="text-[10px] font-black text-gray-400 uppercase ml-2">Agence Cible</label>
              <select id="importAid" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-bold mt-1 dark:text-white">{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            )}
            <input type="file" accept=".csv" onChange={handleImport} className="w-full p-8 border-4 border-dashed rounded-[2rem] text-center font-bold text-gray-400" />
            <button onClick={() => setShowImport(false)} className="w-full mt-6 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black uppercase tracking-widest text-xs">Annuler</button>
          </div>
        </div>
      )}

      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl">
            <h3 className="text-xl font-black mb-6 dark:text-white">Modifier Prix</h3>
            <input type="number" className="w-full p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl outline-none font-black text-2xl dark:text-white" value={newPrice} onChange={e => setNewPrice(e.target.value)} autoFocus />
            <div className="flex gap-4 mt-8">
              <button onClick={() => setEditingTicket(null)} className="flex-1 py-4 font-black uppercase text-xs">Annuler</button>
              <button onClick={async () => { await supabase.updateTicketPrice(editingTicket.id, parseInt(newPrice)); setEditingTicket(null); loadData(); }} className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketManager;
