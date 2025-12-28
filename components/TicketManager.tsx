
import React, { useState, useEffect } from 'react';
import { Search, FileUp, X, Check, Edit2, Tags, Info, Building2, ChevronDown, Filter, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Ticket, UserProfile, TicketStatus, UserRole, Agency } from '../types';
import { translations, Language } from '../i18n';

interface TicketManagerProps {
  user: UserProfile;
  lang: Language;
}

const TicketManager: React.FC<TicketManagerProps> = ({ user, lang }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'ALL'>('ALL');
  const [showImport, setShowImport] = useState(false);
  const [importStatus, setImportStatus] = useState<{success: number, errors: number} | null>(null);
  
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [newPrice, setNewPrice] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>('');

  // États Super Admin
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [importAgencyId, setImportAgencyId] = useState<string>(user.agency_id);
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState<string>('ALL');

  const t = translations[lang];
  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    loadTickets();
    if (isSuperAdmin) {
        loadAgencies();
    }
  }, [filterStatus]);

  useEffect(() => {
      if (showImport && isSuperAdmin) {
          setImportAgencyId(user.agency_id);
      }
  }, [showImport, isSuperAdmin, user.agency_id]);

  const loadTickets = async () => {
    const data = await supabase.getTickets(user.agency_id, user.role);
    setTickets(data);
  };

  const loadAgencies = async () => {
      const data = await supabase.getAgencies();
      setAgencies(data.filter(a => a.status === 'active'));
  };

  const getAgencyName = (id: string) => {
    return agencies.find(a => a.id === id)?.name || '...';
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetAgency = isSuperAdmin ? importAgencyId : user.agency_id;
    if (!targetAgency) {
        alert("Erreur : Agence cible invalide.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      // Normalisation des retours à la ligne
      const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
      
      const rows = lines.slice(1).map(line => {
        // Nettoyage des guillemets et split intelligent (virgule ou point-virgule)
        const clean = (val: string) => val ? val.replace(/^["']|["']$/g, '').trim() : '';
        const parts = line.split(/[;,]/).map(clean);
        
        if (parts.length < 2) return null; // Ignorer les lignes trop courtes

        // Mapping standard CSV Mikhmon: Username, Password, Profile, TimeLimit, Price...
        // Si le prix est absent ou invalide, on met 0
        const rawPrice = parts[4] || '0';
        let price = parseInt(rawPrice);
        if (isNaN(price)) price = 0;

        return {
          username: parts[0],
          password: parts[1] || '',
          profile: parts[2] || 'Default',
          time_limit: parts[3] || '',
          price: price,
          expire_at: parts[5] // Le service s'occupera de valider si c'est une date
        } as Partial<Ticket>;
      }).filter(item => item && item.username) as Partial<Ticket>[];

      if (rows.length === 0) {
          alert(lang === 'fr' ? "Aucun ticket valide trouvé dans le fichier." : "No valid tickets found in file.");
          return;
      }

      const res = await supabase.importTickets(rows, user.id, targetAgency);
      setImportStatus(res);
      loadTickets();
      
      // Reset input file
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleIndividualPriceUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket || !newPrice) return;
    const price = parseInt(newPrice);
    if (!isNaN(price)) {
        await supabase.updateTicketPrice(editingTicket.id, price);
        setEditingTicket(null);
        setNewPrice('');
        loadTickets();
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    await supabase.deleteTicket(ticketToDelete.id);
    setTicketToDelete(null);
    loadTickets();
  };

  const handleBulkPriceUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile || !newPrice) return;
    
    const price = parseInt(newPrice);
    if (isNaN(price)) return;

    // Détermination de l'agence cible
    let targetAgencyId = user.agency_id;
    
    if (isSuperAdmin) {
        if (selectedAgencyFilter !== 'ALL') {
            targetAgencyId = selectedAgencyFilter;
        } else {
            // Sécurité : Pour modifier en masse, un Super Admin doit cibler une agence spécifique
            // sinon on risque de modifier le profil "1H" de toutes les agences en même temps, ce qui est rarement souhaité.
            alert(lang === 'fr' 
                ? "Veuillez d'abord filtrer par une agence spécifique en haut de page pour modifier les prix en masse." 
                : "Please filter by a specific agency first to bulk update prices.");
            return;
        }
    }

    const count = await supabase.updateProfilePrices(targetAgencyId, selectedProfile, price);
    
    alert(lang === 'fr' 
        ? `${count} tickets du profil "${selectedProfile}" ont été mis à jour à ${price.toLocaleString()} GNF.` 
        : `${count} tickets of profile "${selectedProfile}" successfully updated.`);

    setShowBulkEdit(false);
    setNewPrice('');
    setSelectedProfile('');
    loadTickets();
  };

  const filtered = tickets.filter(ticket => {
    const matchesSearch = ticket.username.toLowerCase().includes(search.toLowerCase()) || ticket.profile.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || ticket.status === filterStatus;
    const matchesAgency = !isSuperAdmin || selectedAgencyFilter === 'ALL' || ticket.agency_id === selectedAgencyFilter;
    return matchesSearch && matchesFilter && matchesAgency;
  });

  const uniqueProfiles = Array.from(new Set(tickets.filter(t => 
      // Si SuperAdmin filtre par agence, on montre les profils de cette agence, sinon tous
      (selectedAgencyFilter === 'ALL' || t.agency_id === selectedAgencyFilter)
  ).map(t => t.profile)));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t.inventory}</h2>
          <p className="text-sm text-gray-500 font-medium">
             {filtered.length} tickets affichés {isSuperAdmin && selectedAgencyFilter !== 'ALL' && ` pour ${(agencies.find(a => a.id === selectedAgencyFilter)?.name)}`}
          </p>
        </div>
        <div className="flex gap-2">
          {user.role !== UserRole.SELLER && (
            <>
              <button 
                onClick={() => setShowBulkEdit(true)}
                className="flex items-center gap-2 bg-amber-500 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
              >
                <Tags className="w-4 h-4" />
                {t.bulkPrice}
              </button>
              <button 
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 bg-primary-600 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20 active:scale-95"
              >
                <FileUp className="w-4 h-4" />
                {t.importCsv}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-gray-800 p-2 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder={t.searchPlaceholder} 
            className="w-full bg-transparent border-none pl-14 py-4 focus:ring-0 text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {/* Filtre Agence (Super Admin) */}
        {isSuperAdmin && (
            <div className="relative border-l border-gray-100 dark:border-gray-700">
                <select 
                  className="bg-transparent border-none pl-12 pr-10 py-4 focus:ring-0 text-xs font-black uppercase tracking-widest appearance-none text-gray-900 dark:text-white cursor-pointer min-w-[180px]"
                  value={selectedAgencyFilter}
                  onChange={(e) => setSelectedAgencyFilter(e.target.value)}
                >
                  <option value="ALL">Toutes Agences</option>
                  {agencies.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
        )}

        <div className="relative border-l border-gray-100 dark:border-gray-700">
            <select 
              className="bg-transparent border-none pl-12 pr-10 py-4 focus:ring-0 text-xs font-black uppercase tracking-widest appearance-none text-gray-900 dark:text-white cursor-pointer"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TicketStatus | 'ALL')}
            >
              <option value="ALL">{t.allStatus}</option>
              <option value={TicketStatus.UNSOLD}>{t.unsold}</option>
              <option value={TicketStatus.SOLD}>{t.sold}</option>
              <option value={TicketStatus.EXPIRED}>{t.expired}</option>
            </select>
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 dark:bg-gray-700/30 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              <tr>
                <th className="px-6 py-5">{t.username}</th>
                <th className="px-6 py-5">{t.profile}</th>
                {isSuperAdmin && <th className="px-6 py-5">Agence</th>}
                <th className="px-6 py-5 text-right">{t.price}</th>
                <th className="px-6 py-5 text-center">{t.status}</th>
                {user.role !== UserRole.SELLER && <th className="px-6 py-5 text-center">{t.actions}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filtered.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-black text-gray-900 dark:text-white block">{ticket.username}</span>
                    <span className="text-[10px] text-gray-400 font-bold tracking-tight">{ticket.time_limit}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300">
                      {ticket.profile}
                    </span>
                  </td>
                  {isSuperAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Building2 className="w-3 h-3" />
                            <span className="text-xs font-bold">{getAgencyName(ticket.agency_id)}</span>
                        </div>
                      </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-black text-gray-900 dark:text-white">
                        {ticket.price.toLocaleString()}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">GNF</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                      ticket.status === TicketStatus.UNSOLD ? 'bg-green-100 text-green-700' :
                      ticket.status === TicketStatus.SOLD ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {lang === 'fr' ? (ticket.status === 'UNSOLD' ? 'EN STOCK' : (ticket.status === 'SOLD' ? 'VENDU' : 'EXPIRÉ')) : ticket.status}
                    </span>
                  </td>
                  {user.role !== UserRole.SELLER && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {ticket.status === TicketStatus.UNSOLD && (
                          <>
                            <button 
                              onClick={() => { setEditingTicket(ticket); setNewPrice(ticket.price.toString()); }}
                              className="p-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl text-primary-600 transition-all active:scale-90"
                              title={t.editPrice}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setTicketToDelete(ticket)}
                              className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-500 transition-all active:scale-90"
                              title={t.deleteTicket}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <Info className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-bold">Aucun ticket trouvé</p>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white">{t.importCsv}</h3>
              <button onClick={() => { setShowImport(false); setImportStatus(null); }} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl text-gray-500 dark:text-gray-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            {importStatus ? (
              <div className="space-y-8">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-50">
                    <Check className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-black text-gray-900 dark:text-white">{t.successImport}</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-[1.5rem] border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ajoutés</p>
                    <p className="text-3xl font-black text-green-600">{importStatus.success}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-[1.5rem] border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ignorés / Erreurs</p>
                    <p className="text-3xl font-black text-amber-600">{importStatus.errors}</p>
                  </div>
                </div>
                <button onClick={() => setShowImport(false)} className="w-full py-5 bg-primary-600 text-white rounded-[1.5rem] font-black shadow-xl">{t.confirm}</button>
              </div>
            ) : (
              <div className="space-y-8 text-center">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Exportez vos tickets depuis Mikhmon (CSV) et importez-les ici. Les doublons seront ignorés.
                </div>

                {isSuperAdmin && (
                    <div className="space-y-2 text-left animate-in slide-in-from-top-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t.selectAgency}</label>
                        <div className="relative">
                            <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <select 
                                className="w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold appearance-none cursor-pointer text-gray-900 dark:text-white"
                                value={importAgencyId}
                                onChange={(e) => setImportAgencyId(e.target.value)}
                            >
                                {agencies.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                <label className={`flex flex-col items-center justify-center w-full h-56 border-4 border-dashed rounded-[2.5rem] cursor-pointer transition-all group ${
                    isSuperAdmin && !importAgencyId 
                    ? 'border-gray-200 opacity-50 cursor-not-allowed' 
                    : 'border-gray-100 dark:border-gray-700 hover:border-primary-500/50 hover:bg-gray-50 dark:hover:bg-gray-900/30'
                }`}>
                  <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-3xl group-hover:scale-110 transition-transform mb-4">
                    <FileUp className="w-10 h-10 text-primary-500" />
                  </div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{lang === 'fr' ? 'Sélectionner le fichier CSV' : 'Select CSV file'}</p>
                  <input type="file" className="hidden" accept=".csv" onChange={handleImport} disabled={isSuperAdmin && !importAgencyId} />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {ticketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{t.deleteTicket}</h3>
            <p className="text-lg font-black text-primary-600 mb-4">{ticketToDelete.username}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
              {t.confirmDeleteTicket}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteTicket}
                className="w-full py-5 bg-red-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-red-500/30 active:scale-95 transition-all"
              >
                {t.confirm}
              </button>
              <button 
                onClick={() => setTicketToDelete(null)}
                className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Edit Modal */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black mb-2 text-gray-900 dark:text-white">{t.editPrice}</h3>
            <p className="text-xs text-gray-400 font-bold mb-8 uppercase tracking-widest">{editingTicket.username}</p>
            <form onSubmit={handleIndividualPriceUpdate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t.price} (GNF)</label>
                <input 
                  type="number" 
                  className="w-full p-5 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary-500/50 rounded-2xl font-black text-xl text-gray-900 dark:text-white placeholder-gray-400"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setEditingTicket(null)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-sm uppercase tracking-widest text-gray-900 dark:text-white">{t.cancel}</button>
                <button type="submit" className="flex-1 py-5 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-500/20">{t.confirm}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black mb-8 text-gray-900 dark:text-white">{t.bulkPrice}</h3>
            <form onSubmit={handleBulkPriceUpdate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t.profile}</label>
                <div className="relative">
                    <select 
                      className="w-full p-5 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary-500/50 rounded-2xl font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                      value={selectedProfile}
                      onChange={(e) => setSelectedProfile(e.target.value)}
                      required
                    >
                      <option value="">{t.selectProfile}</option>
                      {uniqueProfiles.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t.newPrice} (GNF)</label>
                <input 
                  type="number" 
                  className="w-full p-5 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary-500/50 rounded-2xl font-black text-xl text-gray-900 dark:text-white placeholder-gray-400"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="Ex: 5000"
                  required
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowBulkEdit(false)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-sm uppercase tracking-widest text-gray-900 dark:text-white">{t.cancel}</button>
                <button type="submit" className="flex-1 py-5 bg-amber-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-amber-500/20">{t.confirm}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketManager;
