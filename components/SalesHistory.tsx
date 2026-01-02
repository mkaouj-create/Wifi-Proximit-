import React, { useState, useEffect, useMemo } from 'react';
import { Search, User, Download, Trash2, AlertTriangle, X, Tag, Wifi, Banknote, Clock, Phone, Share2, Copy, Check, Calendar } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Sale, UserProfile, UserRole, Agency } from '../types';
import { translations, Language } from '../i18n';

interface SalesHistoryProps {
  user: UserProfile;
  lang: Language;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ user, lang }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [search, setSearch] = useState('');
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = translations[lang];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesData, agencyData] = await Promise.all([
        supabase.getSales(user.agency_id, user.role),
        supabase.getAgency(user.agency_id)
      ]);
      setSales(salesData);
      setAgency(agencyData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSale = async () => {
    if (!saleToCancel) return;
    try {
      // Pass user as actor for logging
      await supabase.cancelSale(saleToCancel.id, user);
      setSaleToCancel(null);
      loadData();
    } catch (err) {
      alert("Échec de l'annulation.");
    }
  };

  const filteredSales = useMemo(() => {
    return sales.filter(s => 
      (s.ticket_username || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.seller_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.agency_name || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [sales, search]);

  const currency = agency?.settings?.currency || 'GNF';

  const getMessage = () => {
    if (!selectedSale) return '';
    const header = agency?.settings?.whatsapp_receipt_header || `*${t.appName}*`;
    const dateStr = new Date(selectedSale.sold_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US');
    return `${header}\n\n*HISTORIQUE TRANSACTION*\n📅 Date: ${dateStr}\n🎟 Code: *${selectedSale.ticket_username || 'N/A'}*\n💰 Prix: *${selectedSale.amount.toLocaleString()} ${currency}*\n⏳ Validité: *${selectedSale.ticket_time_limit || 'N/A'}*\n\nMerci de votre confiance !`;
  };

  const handleCopy = async () => {
    const message = getMessage();
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const sendWhatsApp = () => {
    if (!selectedSale) return;
    const message = getMessage();
    let phone = selectedSale.customer_phone || '';
    let url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    if (phone) {
        let cleanPhone = phone.replace(/\D/g, '').replace(/^0+/, '');
        if (cleanPhone.length === 9 && currency === 'GNF') {
            cleanPhone = '224' + cleanPhone;
        }
        url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Seul l'Admin de l'agence peut annuler une vente (car cela impacte le stock et la caisse de l'agence)
  const canCancel = user.role === UserRole.ADMIN;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black dark:text-white uppercase tracking-tight">{t.salesHistory}</h2>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1 leading-none">{filteredSales.length} transactions trouvées</p>
        </div>
        <button className="flex items-center justify-center gap-3 p-3.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 w-full sm:w-auto">
          <Download className="w-5 h-5 text-primary-500" />
          <span className="text-[10px] font-black uppercase tracking-widest sm:hidden">Exporter</span>
        </button>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
        <input 
          type="text" 
          placeholder={t.searchPlaceholder}
          className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl pl-12 py-4 shadow-sm focus:ring-4 focus:ring-primary-500/10 transition-all font-bold dark:text-white text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-gray-800/50 backdrop-blur-[1px] z-10">
             <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* VIEW TABLE (Desktop) */}
        <div className="hidden md:block overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-6 py-4">{t.date}</th>
                <th className="px-6 py-4">{t.username}</th>
                <th className="px-6 py-4">{t.seller}</th>
                {user.role === UserRole.SUPER_ADMIN && <th className="px-6 py-4">{t.agency}</th>}
                <th className="px-6 py-4 text-right">{t.amount}</th>
                <th className="px-6 py-4 text-center">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-sm">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {new Date(sale.sold_at).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">
                        {new Date(sale.sold_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td onClick={() => setSelectedSale(sale)} className="px-6 py-4 cursor-pointer">
                    <div className="flex flex-col group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 p-2 -ml-2 rounded-xl transition-all">
                      <span className="font-black text-primary-600 dark:text-primary-400 uppercase leading-none">{sale.ticket_username || 'N/A'}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">{sale.ticket_profile || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center"><User className="w-3 h-3 text-gray-400" /></div>
                      <span className="font-bold text-xs truncate max-w-[120px]">{sale.seller_name}</span>
                    </div>
                  </td>
                  {user.role === UserRole.SUPER_ADMIN && (
                    <td className="px-6 py-4">
                      <span className="font-bold text-xs uppercase text-gray-400">{sale.agency_name}</span>
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-gray-900 dark:text-white tabular-nums">
                      {sale.amount.toLocaleString()} <span className="text-[10px] font-medium opacity-40">{currency}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {canCancel && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSaleToCancel(sale); }}
                        className="p-2.5 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl hover:bg-red-100 transition-all opacity-0 group-hover:opacity-100"
                        title="Annuler vente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* VIEW CARDS (Mobile) */}
        <div className="md:hidden grid grid-cols-1 divide-y dark:divide-gray-700">
           {filteredSales.slice(0, 50).map(sale => (
             <div key={sale.id} onClick={() => setSelectedSale(sale)} className="p-5 active:bg-gray-50 dark:active:bg-gray-900 transition-colors flex items-center justify-between">
                <div className="flex gap-4 items-center">
                   <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-xl flex items-center justify-center shrink-0">
                      <Wifi size={18} />
                   </div>
                   <div className="min-w-0">
                      <p className="font-black text-sm uppercase leading-none dark:text-white truncate">{sale.ticket_username || 'CODE'}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 leading-none">{new Date(sale.sold_at).toLocaleDateString()} • {new Date(sale.sold_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                   <p className="font-black text-sm tabular-nums text-gray-900 dark:text-white">{sale.amount.toLocaleString()} <span className="text-[9px] font-medium opacity-50 uppercase">{currency}</span></p>
                   <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <User size={10} className="text-gray-400" />
                      <span className="text-[9px] font-black uppercase tracking-tighter text-gray-500 truncate max-w-[60px]">{sale.seller_name}</span>
                   </div>
                </div>
             </div>
           ))}
        </div>

        {!loading && filteredSales.length === 0 && (
          <div className="p-20 text-center">
             <Calendar size={48} className="mx-auto text-gray-100 dark:text-gray-800 mb-4" />
             <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Historique vide</p>
          </div>
        )}
      </div>

      {/* MODAL DETAILS - OPTIMIZED MOBILE */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-2xl w-full md:max-w-sm max-h-[85vh] md:h-auto rounded-t-[2.5rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl animate-in slide-in-from-bottom md:zoom-in duration-300 relative border-t border-white/20 dark:border-gray-700/50 flex flex-col">
               
               {/* Close Button */}
               <button onClick={() => setSelectedSale(null)} className="absolute top-6 right-6 p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-90 z-20">
                 <X className="w-5 h-5" />
               </button>

               {/* Scrollable Content */}
               <div className="flex-1 overflow-y-auto no-scrollbar pt-2 pb-6">
                 <div className="text-center space-y-3 mb-6">
                     <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-primary-500/10"><Tag size={32} /></div>
                     <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Détails Vente</h3>
                 </div>
                 
                 {/* Layout en Grille pour : 1. Wifi & Prix, 2. Validité & WhatsApp */}
                 <div className="grid grid-cols-2 gap-3">
                     <DetailRow icon={<Wifi />} label="Code Wifi" val={selectedSale.ticket_username || 'N/A'} isBold color="text-primary-500" />
                     <DetailRow icon={<Banknote />} label="Prix" val={`${selectedSale.amount.toLocaleString()} ${currency}`} color="text-green-500" />
                     <DetailRow icon={<Clock />} label="Validité" val={selectedSale.ticket_time_limit || 'N/A'} color="text-amber-500" />
                     <DetailRow icon={<Phone />} label="WhatsApp" val={selectedSale.customer_phone || 'N/A'} color="text-blue-500" />
                 </div>
               </div>

               {/* Action Buttons */}
               <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50">
                 <div className="flex gap-3 mb-3">
                   <button onClick={handleCopy} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700/50 text-gray-900 dark:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">{copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {t.copyCode}</button>
                   <button onClick={sendWhatsApp} className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-95 transition-all"><Share2 className="w-4 h-4" /> {t.whatsapp}</button>
                 </div>
                 {canCancel && (
                   <button onClick={() => { setSaleToCancel(selectedSale); setSelectedSale(null); }} className="w-full py-3 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all">Annuler la transaction</button>
                 )}
               </div>
           </div>
        </div>
      )}

      {/* CONFIRM CANCEL MODAL */}
      {saleToCancel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in text-center border dark:border-gray-700">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg"><AlertTriangle className="w-10 h-10" /></div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">{t.cancelSale}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8 leading-relaxed">Confirmez-vous la réintégration du ticket en stock ?</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleCancelSale} className="w-full py-5 bg-red-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 shadow-xl shadow-red-500/30">Confirmer Annulation</button>
              <button onClick={() => setSaleToCancel(null)} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">Retour</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ icon, label, val, isBold = false, color }: any) => (
    <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-2xl flex items-center gap-2.5 border border-transparent dark:border-gray-700/30 overflow-hidden">
        <div className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm shrink-0">
          {React.cloneElement(icon as React.ReactElement, { size: 14, className: color })}
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1 truncate">{label}</p>
            <p className={`font-black uppercase truncate leading-none ${isBold ? 'text-sm text-primary-600 dark:text-primary-400' : 'text-[11px] text-gray-900 dark:text-white'}`}>{val}</p>
        </div>
    </div>
);

export default SalesHistory;