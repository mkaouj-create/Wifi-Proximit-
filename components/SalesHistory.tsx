
import React, { useState, useEffect, useMemo } from 'react';
import { Search, User, Building2, Download, Trash2, AlertTriangle, X, Tag, Wifi, Banknote, Clock, Phone } from 'lucide-react';
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
  const t = translations[lang];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [salesData, agencyData] = await Promise.all([
      supabase.getSales(user.agency_id, user.role),
      supabase.getAgency(user.agency_id)
    ]);
    setSales(salesData);
    setAgency(agencyData);
  };

  const handleCancelSale = async () => {
    if (!saleToCancel) return;
    
    await supabase.cancelSale(saleToCancel.id);
    setSaleToCancel(null);
    loadData(); // Recharger les données pour mettre à jour la liste
    alert(t.saleCancelled);
  };

  const filteredSales = useMemo(() => {
    return sales.filter(s => 
      s.ticket_username?.toLowerCase().includes(search.toLowerCase()) ||
      s.seller_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.agency_name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [sales, search]);

  const currency = agency?.settings?.currency || 'GNF';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">{t.salesHistory}</h2>
        <button className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder={t.searchPlaceholder}
          className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl pl-12 py-4 shadow-sm focus:ring-2 focus:ring-primary-500 transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
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
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {new Date(sale.sold_at).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(sale.sold_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td 
                    onClick={() => setSelectedSale(sale)}
                    className="px-6 py-4 cursor-pointer group"
                    title="Voir les détails"
                  >
                    <div className="flex flex-col group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 p-2 -ml-2 rounded-xl transition-colors">
                      <span className="font-black text-primary-600 underline decoration-dotted underline-offset-4 group-hover:text-primary-700">{sale.ticket_username}</span>
                      <span className="text-[10px] font-bold text-gray-400">{sale.ticket_profile}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="font-medium">{sale.seller_name}</span>
                    </div>
                  </td>
                  {user.role === UserRole.SUPER_ADMIN && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-gray-400" />
                        <span className="font-medium">{sale.agency_name}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-gray-900 dark:text-white">
                      {sale.amount.toLocaleString()} <span className="text-[10px] font-medium opacity-50">{currency}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => setSaleToCancel(sale)}
                      className="p-2 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors active:scale-95"
                      title={t.cancelSale}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSales.length === 0 && (
          <div className="p-10 text-center text-gray-400 font-medium">
            Aucune vente trouvée.
          </div>
        )}
      </div>

      {/* Modal Détails Transaction */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300 relative">
               <button 
                onClick={() => setSelectedSale(null)}
                className="absolute top-6 right-6 p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-300 transition-colors"
               >
                   <X className="w-5 h-5" />
               </button>

               <div className="text-center space-y-4 mb-8">
                   <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/20 text-primary-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                       <Tag className="w-10 h-10" />
                   </div>
                   <h3 className="text-2xl font-black text-gray-900 dark:text-white">Détails Transaction</h3>
                   <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{new Date(selectedSale.sold_at).toLocaleString()}</p>
               </div>

               <div className="space-y-4">
                   <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl flex items-center gap-4">
                       <div className="p-3 bg-white dark:bg-gray-800 rounded-xl text-primary-500 shadow-sm">
                           <Wifi className="w-5 h-5" />
                       </div>
                       <div>
                           <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Code Wifi</p>
                           <p className="font-black text-lg text-gray-900 dark:text-white">{selectedSale.ticket_username}</p>
                       </div>
                   </div>

                   <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl flex items-center gap-4">
                       <div className="p-3 bg-white dark:bg-gray-800 rounded-xl text-green-500 shadow-sm">
                           <Banknote className="w-5 h-5" />
                       </div>
                       <div>
                           <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Prix</p>
                           <p className="font-black text-lg text-gray-900 dark:text-white">{selectedSale.amount.toLocaleString()} {currency}</p>
                       </div>
                   </div>

                   <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl flex items-center gap-4">
                       <div className="p-3 bg-white dark:bg-gray-800 rounded-xl text-amber-500 shadow-sm">
                           <Clock className="w-5 h-5" />
                       </div>
                       <div>
                           <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Validité</p>
                           <p className="font-bold text-gray-900 dark:text-white">{selectedSale.ticket_time_limit || 'N/A'}</p>
                       </div>
                   </div>

                   <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl flex items-center gap-4">
                       <div className="p-3 bg-white dark:bg-gray-800 rounded-xl text-blue-500 shadow-sm">
                           <Phone className="w-5 h-5" />
                       </div>
                       <div>
                           <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">WhatsApp Client</p>
                           <p className="font-bold text-gray-900 dark:text-white">{selectedSale.customer_phone || 'Non renseigné'}</p>
                       </div>
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* Modal de Confirmation d'Annulation */}
      {saleToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{t.cancelSale}</h3>
            <p className="text-lg font-black text-primary-600 mb-4">{saleToCancel.ticket_username}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
              {t.confirmCancelSale}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleCancelSale}
                className="w-full py-5 bg-red-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-red-500/30 active:scale-95 transition-all"
              >
                {t.confirm}
              </button>
              <button 
                onClick={() => setSaleToCancel(null)}
                className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
