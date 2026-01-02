
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, FileUp, X, Loader2, Info, Layers } from 'lucide-react';
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
  
  const [showImport, setShowImport] = useState(false);
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
        const defaultTarget = agenciesData.find((a: Agency) => a.id === user.agency_id) || agenciesData[0];
        if (defaultTarget) setImportTargetAgencyId(defaultTarget.id);
      }
    } catch (err) {
      notify('error', "Échec de la récupération des données.");
    } finally {
      setLoading(false);
    }
  }, [user, isSuper, notify]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        if (!text || text.trim().length === 0) throw new Error("Le fichier est vide.");

        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) throw new Error("Format de fichier non reconnu.");

        const firstLine = lines[0];
        const delimiter = firstLine.includes(';') ? ';' : firstLine.includes(',') ? ',' : '\t';
        
        const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        const idx = {
          user: headers.findIndex(h => h.includes('user') || h === 'login' || h === 'identifiant' || h === 'username'),
          pass: headers.findIndex(h => h.includes('pass') || h === 'pwd' || h === 'password'),
          prof: headers.findIndex(h => h.includes('prof') || h === 'forfait' || h === 'profile'),
          price: headers.findIndex(h => h.includes('price') || h === 'prix' || h === 'tarif')
        };

        const hasHeader = idx.user !== -1;
        const dataLines = hasHeader ? lines.slice(1) : lines;
        
        const rows = dataLines.map(line => {
          const p = line.split(delimiter).map(v => v.replace(/^["']|["']$/g, '').trim());
          return { 
            username: hasHeader ? p[idx.user] : p[0], 
            password: hasHeader ? (idx.pass !== -1 ? p[idx.pass] : p[idx.user]) : (p[1] || p[0]), 
            profile: hasHeader ? (idx.prof !== -1 ? p[idx.prof] : 'Default') : (p[2] || 'Default'), 
            price: hasHeader ? (idx.price !== -1 ? Number.parseInt(p[idx.price]?.replace(/\D/g, '')) || 0 : 0) : (Number.parseInt(p[3]?.replace(/\D/g, '')) || 0)
          };
        }).filter(r => r.username && r.username.length > 0);

        if (rows.length === 0) throw new Error("Aucun ticket valide trouvé.");

        const target = isSuper ? importTargetAgencyId : user.agency_id;
        const res = await supabase.importTickets(rows, user.id, target);
        
        notify('success', `${res.success} tickets importés. Coût: ${res.cost.toFixed(2)} crédits.`);
        setShowImport(false);
        loadData();
      } catch (err: any) {
        notify('error', err.message || "Erreur lors de l'importation.");
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      notify('error', "Impossible de lire le fichier.");
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  const filtered = useMemo(() => tickets.filter(tk => {
    const mSearch = tk.username.toLowerCase().includes(search.toLowerCase()) || tk.profile.toLowerCase().includes(search.toLowerCase());
    const mStatus = filterStatus === 'ALL' || tk.status === filterStatus;
    const mAgency = selectedAgency === 'ALL' || tk.agency_id === selectedAgency;
    return mSearch && mStatus && mAgency;
  }), [tickets, search, filterStatus, selectedAgency]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black dark:text-white uppercase tracking-tight">{t.inventory}</h2>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">
             {loading ? 'Chargement...' : `${filtered.length} tickets en stock`}
          </p>
        </div>
        {user.role !== UserRole.SELLER && (
          <button 
            onClick={() => setShowImport(true)} 
            className="w-full sm:w-auto bg-primary-600 text-white px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <FileUp size={16}/> {t.importCsv}
          </button>
        )}
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
              className="bg-gray-50 dark:bg-gray-900 px-5 py-3 rounded-xl text-[10px] font-black uppercase outline-none border-none cursor-pointer focus:ring-2 focus:ring-primary-500/20 transition-all" 
              value={selectedAgency} 
              onChange={e => setSelectedAgency(e.target.value)}
            >
              <option value="ALL">Toutes les agences</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select 
            className="bg-gray-50 dark:bg-gray-900 px-5 py-3 rounded-xl text-[10px] font-black uppercase outline-none border-none cursor-pointer focus:ring-2 focus:ring-primary-500/20 transition-all" 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value as any)}
          >
            <option value="ALL">Tous Statuts</option>
            <option value="UNSOLD">{t.unsold}</option>
            <option value="SOLD">{t.sold}</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[2rem] overflow-hidden border dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none min-h-[300px] relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-800/50 backdrop-blur-[2px] z-10">
            <Loader2 className="animate-spin text-primary-600" size={32} />
          </div>
        )}
        
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-6 py-5">Utilisateur / Identifiant</th>
                <th className="px-6 py-5">Profil Tarifaire</th>
                <th className="px-6 py-5 text-right">Prix Unitaire</th>
                <th className="px-6 py-5 text-center">État Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filtered.slice(0, 100).map(tk => (
                <tr key={tk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-black text-xs dark:text-white uppercase tracking-tight group-hover:text-primary-600 transition-colors">{tk.username}</span>
                      {isSuper && <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter mt-1">{agencies.find(a => a.id === tk.agency_id)?.name}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg uppercase tracking-tight">{tk.profile}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-xs tabular-nums dark:text-white">
                      {tk.price.toLocaleString()} <span className="text-[8px] opacity-40 uppercase font-medium">XOF</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-sm ${
                      tk.status === TicketStatus.UNSOLD 
                      ? 'bg-green-50 text-green-600 border border-green-100 dark:bg-green-900/10 dark:border-green-800' 
                      : 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/10 dark:border-blue-800'
                    }`}>
                      {tk.status === TicketStatus.UNSOLD ? t.unsold : t.sold}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {!loading && filtered.length === 0 && (
            <div className="py-32 flex flex-col items-center justify-center text-gray-400">
              <Layers className="w-16 h-16 opacity-10 mb-4" />
              <p className="font-black uppercase text-[10px] tracking-[0.3em]">Aucun ticket trouvé</p>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 border border-white/20 dark:border-gray-700/50">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">{t.importCsv}</h3>
              <button onClick={() => setShowImport(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-all active:scale-90">
                <X size={20} />
              </button>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-[2rem] mb-8 flex gap-4 border border-amber-100 dark:border-amber-800/50">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/20 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                <Info size={22} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-amber-700 dark:text-amber-500 font-black uppercase tracking-widest">Tarification</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{t.importRuleInfo}</p>
              </div>
            </div>

            <div className="space-y-6">
              {isSuper && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-3 tracking-widest">Agence Cible</label>
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
                      <p className="font-black text-[10px] text-primary-600 uppercase tracking-widest animate-pulse">Traitement en cours...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl flex items-center justify-center mb-1">
                         <FileUp size={30} />
                      </div>
                      <p className="font-black text-[11px] text-gray-500 dark:text-gray-300 uppercase tracking-widest">Cliquer pour charger</p>
                      <p className="text-[9px] text-gray-400 font-medium">Format supporté : .csv</p>
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
