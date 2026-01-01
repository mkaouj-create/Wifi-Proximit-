import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ShoppingCart, Phone, CheckCircle2, Share2, Loader2, Copy, Info, Sparkles, RefreshCcw } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Ticket, UserProfile, TicketStatus, Agency } from '../types';
import { translations, Language } from '../i18n';

interface SalesTerminalProps {
  user: UserProfile;
  lang: Language;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
  agency?: Agency | null;
}

const SalesTerminal: React.FC<SalesTerminalProps> = ({ user, lang, notify, agency: propAgency }) => {
  const [availableTickets, setAvailableTickets] = useState<Ticket[]>([]);
  const [localAgency, setLocalAgency] = useState<Agency | null>(propAgency || null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSelling, setIsSelling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [soldTicketInfo, setSoldTicketInfo] = useState<Ticket | null>(null);
  const [showConfirmSale, setShowConfirmSale] = useState(false);

  const t = translations[lang];

  // Chargement des données
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      // On charge toujours les tickets pour avoir le stock à jour
      const ticketsData = await supabase.getTickets(user.agency_id, user.role);
      const unsold = ticketsData.filter(ticket => ticket.status === TicketStatus.UNSOLD);
      setAvailableTickets(unsold);

      // Si l'agence n'est pas passée en prop, on la charge
      if (!propAgency && !localAgency) {
        const agencyData = await supabase.getAgency(user.agency_id);
        setLocalAgency(agencyData);
      }
    } catch (err) {
      notify('error', "Échec de synchronisation du stock.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [user, propAgency, localAgency, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mise à jour si la prop change
  useEffect(() => {
    if (propAgency) setLocalAgency(propAgency);
  }, [propAgency]);

  const dynamicProfiles = useMemo(() => {
    // Trier les profils par ordre alphabétique pour une UI stable
    return Array.from(new Set(availableTickets.map(t => t.profile))).sort();
  }, [availableTickets]);

  const currency = localAgency?.settings?.currency || 'GNF';

  const getReceiptMessage = (ticket: Ticket) => {
    const header = localAgency?.settings?.whatsapp_receipt_header || `*${t.appName}*`;
    return `${header}\n\n*CODE WIFI*\nCode: *${ticket.username}*\nValidité: *${ticket.time_limit}*\nPrix: *${ticket.price.toLocaleString()} ${currency}*\n\nMerci de votre confiance !`;
  };

  const handleCopy = async () => {
    if (!soldTicketInfo) return;
    const text = getReceiptMessage(soldTicketInfo);
    
    try {
      await navigator.clipboard.writeText(text);
      notify('success', 'Reçu copié !');
    } catch (err) {
      // Fallback si l'API Clipboard n'est pas disponible (contextes non sécurisés)
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        notify('success', 'Reçu copié !');
      } catch (e) {
        notify('error', 'Échec de la copie');
      }
    }
  };

  const sendWhatsApp = (ticket: Ticket, phone: string) => {
    const message = getReceiptMessage(ticket);
    const encodedMessage = encodeURIComponent(message);
    
    let url = "";
    if (!phone) {
        url = `https://wa.me/?text=${encodedMessage}`;
    } else {
        let cleanPhone = phone.replace(/\D/g, '').replace(/^0+/, '');
        // Gestion basique de l'indicatif pour GNF (Guinée)
        if (cleanPhone.length === 9 && currency === 'GNF') {
            cleanPhone = '224' + cleanPhone;
        }
        url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    }
    
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      handleCopy();
      notify('info', "Popup bloqué. Reçu copié.");
    }
  };

  const executeSale = async () => {
    if (!selectedProfile) return;
    setShowConfirmSale(false);
    
    // 1. Trouver un ticket candidat localement
    const ticketCandidate = availableTickets.find(t => t.profile === selectedProfile);
    
    if (!ticketCandidate) {
      notify('error', 'Stock épuisé pour ce profil.');
      loadData(true); // Rafraîchir pour être sûr
      return;
    }

    setIsSelling(true);
    try {
      // 2. Tenter de vendre ce ticket spécifique via Supabase
      // Note: Le service supabase.sellTicket vérifie déjà si le ticket est UNSOLD.
      const result = await supabase.sellTicket(ticketCandidate.id, user.id, user.agency_id, customerPhone);
      
      if (result) {
        // Succès
        setSoldTicketInfo(ticketCandidate);
        
        // Mise à jour optimiste locale : retirer le ticket vendu de la liste
        setAvailableTickets(prev => prev.filter(t => t.id !== ticketCandidate.id));
        
        setShowReceipt(true);
        notify('success', 'Vente réussie !');
        
        // Synchronisation en arrière-plan pour être parfaitement à jour
        loadData(true);
      } else {
        // Échec (ex: ticket vendu par un autre vendeur entre temps)
        notify('info', 'Ce ticket vient d\'être vendu. Tentative sur un autre...');
        
        // Rafraîchir les données et réessayer automatiquement ou demander à l'utilisateur
        await loadData(false); // On recharge avec le spinner pour montrer l'activité
        // On ne relance pas automatiquement pour éviter une boucle, l'utilisateur recliquera.
      }
    } catch (err) {
      notify('error', "Erreur technique lors de la vente.");
    } finally {
      setIsSelling(false);
    }
  };

  const resetTerminal = () => {
    setShowReceipt(false);
    setSoldTicketInfo(null);
    setSelectedProfile(null);
    setCustomerPhone('');
  };

  if (showReceipt && soldTicketInfo) {
    return (
      <div className="animate-in zoom-in duration-300 max-w-sm mx-auto pb-10">
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 md:p-8 text-center space-y-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-green-50 dark:ring-green-900/10 animate-in bounce-in duration-500">
              <CheckCircle2 className="w-10 h-10 md:w-14 md:h-14" />
            </div>
            
            <div className="animate-in slide-in-from-bottom-4 duration-500 delay-100">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight">{t.saleSuccess}</h2>
              <p className="text-gray-400 font-black uppercase tracking-widest text-[9px] md:text-[10px] mt-1">
                {soldTicketInfo.profile} • {soldTicketInfo.price.toLocaleString()} {currency}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2rem] md:rounded-[2.5rem] space-y-5 md:space-y-6 border border-gray-100 dark:border-gray-800 relative animate-in slide-in-from-bottom-4 duration-500 delay-200">
               <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-1 rounded-full border border-gray-100 dark:border-gray-700 text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-tighter shadow-sm flex items-center gap-1">
                 <Info size={10} className="text-primary-500" /> Ticket Prêt
               </div>
               
               <div className="bg-white p-3 md:p-4 rounded-3xl shadow-sm inline-block">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${soldTicketInfo.username}&bgcolor=ffffff`}
                    alt="QR Code"
                    className="w-32 h-32 md:w-36 md:h-36 object-contain"
                  />
               </div>
               
               <div className="space-y-1">
                 <p className="text-[9px] md:text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">Identifiant</p>
                 <div className="text-3xl md:text-4xl font-mono font-black tracking-widest text-primary-600 dark:text-primary-400 py-1 md:py-2 select-all break-all uppercase">
                  {soldTicketInfo.username}
                 </div>
                 <p className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest">{soldTicketInfo.time_limit}</p>
               </div>
            </div>

            <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 delay-300">
                <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-green-500 transition-colors">
                        <Phone className="w-full h-full" />
                    </div>
                    <input 
                        type="tel" 
                        placeholder="WhatsApp Client..."
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 rounded-2xl pl-14 pr-4 py-4 transition-all outline-none font-bold text-center text-gray-900 dark:text-white placeholder:text-gray-400 text-sm"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => sendWhatsApp(soldTicketInfo, customerPhone)} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-green-500 text-white rounded-2xl font-black text-[9px] active:scale-95 shadow-lg shadow-green-500/20">
                    <Phone size={18}/><span className="uppercase">{t.whatsapp}</span>
                  </button>
                  <button onClick={handleCopy} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-2xl font-black text-[9px] active:scale-95">
                    <Copy size={18}/><span className="uppercase">Copier</span>
                  </button>
                  <button onClick={() => { if(navigator.share) navigator.share({title: 'Ticket WiFi', text: getReceiptMessage(soldTicketInfo)}) }} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-[9px] active:scale-95">
                    <Share2 size={18}/><span className="uppercase">Partager</span>
                  </button>
                </div>
            </div>
          </div>
          
          <div className="p-6 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-4 duration-500 delay-500">
            <button 
              onClick={resetTerminal} 
              className="w-full py-5 bg-primary-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-primary-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg"
            >
              <Sparkles className="w-5 h-5" />
              {t.confirmAndReturn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl shadow-sm shrink-0">
            <ShoppingCart className="w-8 h-8 md:w-10 md:h-10" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">{t.newSale}</h2>
            <p className="text-[10px] md:text-xs text-gray-500 font-black uppercase tracking-widest mt-1 leading-none">
              {isLoading ? 'Mise à jour...' : `${availableTickets.length} en stock`}
            </p>
          </div>
        </div>
        <button 
          onClick={() => loadData()} 
          className="p-3 rounded-2xl bg-white dark:bg-gray-800 border dark:border-gray-700 hover:text-primary-500 active:scale-95 transition-all shadow-sm"
          disabled={isLoading}
        >
          <RefreshCcw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-6 md:space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-4 ml-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t.selectProfile}</label>
            <Info size={12} className="text-gray-300" />
          </div>
          
          {dynamicProfiles.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {dynamicProfiles.map(profile => {
                const ticketsOfProfile = availableTickets.filter(ticket => ticket.profile === profile);
                const count = ticketsOfProfile.length;
                const sampleTicket = ticketsOfProfile[0]; // Prix théorique
                const isSelected = selectedProfile === profile;
                
                return (
                  <button
                    key={profile}
                    onClick={() => setSelectedProfile(profile)}
                    className={`p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border-2 transition-all text-left relative overflow-hidden flex flex-col justify-between group h-40 md:h-44 ${
                      isSelected 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10 ring-8 ring-primary-500/5 shadow-lg' 
                      : 'border-white dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-200 shadow-sm'
                    }`}
                  >
                    <div className="min-w-0 z-10">
                      <p className={`font-black text-base md:text-xl leading-tight transition-colors truncate uppercase ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>{profile}</p>
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">{count} Restants</p>
                    </div>
                    
                    <div className="mt-4 z-10">
                      <p className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-none">
                        {sampleTicket?.price.toLocaleString()} <span className="text-[10px] md:text-xs font-medium text-gray-400 uppercase">{currency}</span>
                      </p>
                    </div>
                    
                    {isSelected && (
                      <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-primary-600 text-white p-1 rounded-full shadow-lg z-20">
                        <CheckCircle2 size={18} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-16 text-center bg-white dark:bg-gray-800 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-gray-700 shadow-sm">
              <Sparkles className="w-12 h-12 md:w-16 md:h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-black uppercase tracking-widest leading-none">Stock Épuisé</p>
              <p className="text-[10px] text-gray-400 mt-2 max-w-[200px] mx-auto leading-relaxed">Veuillez importer de nouveaux tickets.</p>
            </div>
          )}
        </section>

        {selectedProfile && (
          <div className="animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-white dark:bg-gray-800 p-6 md:p-10 rounded-3xl md:rounded-[3rem] shadow-xl shadow-gray-200/20 dark:shadow-none space-y-6 md:space-y-8 border border-gray-50 dark:border-gray-700">
              <div className="space-y-3">
                <div className="flex items-center gap-2 ml-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t.customerWhatsapp}</label>
                </div>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-500 transition-colors">
                    <Phone className="w-full h-full" />
                  </div>
                  <input 
                    type="tel" 
                    placeholder="Ex: 624 00 00 00"
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-gray-900 rounded-2xl md:rounded-3xl pl-16 py-5 md:py-6 transition-all outline-none font-black text-base md:text-lg dark:text-white"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              <button 
                disabled={isSelling}
                onClick={() => setShowConfirmSale(true)}
                className={`w-full py-5 md:py-6 rounded-2xl md:rounded-[1.5rem] font-black text-lg md:text-xl flex items-center justify-center gap-4 transition-all duration-300 shadow-2xl relative uppercase tracking-widest ${
                  isSelling
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/30 active:scale-[0.98]'
                }`}
              >
                  {isSelling ? <Loader2 className="w-7 h-7 animate-spin" /> : <ShoppingCart className="w-7 h-7" />}
                  <span>{isSelling ? 'Traitement...' : t.completeSale}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showConfirmSale && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full md:max-w-sm rounded-t-[2.5rem] md:rounded-[2.5rem] p-8 md:p-10 shadow-2xl animate-in slide-in-from-bottom md:zoom-in duration-300 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg border-2 border-primary-50 dark:border-primary-800">
              <ShoppingCart className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight leading-none">{t.confirmSaleTitle}</h3>
            <p className="text-[11px] md:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-6">
              Voulez-vous confirmer cette vente ?
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2rem] mb-8 border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">{t.profile}</p>
                <p className="text-2xl md:text-3xl font-black text-primary-600 mb-1 uppercase leading-none">{selectedProfile}</p>
                <p className="text-base md:text-lg font-black text-gray-900 dark:text-white uppercase leading-none">
                  {(availableTickets.find(t => t.profile === selectedProfile)?.price || 0).toLocaleString()} {currency}
                </p>
                {customerPhone && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2 text-primary-500">
                         <Phone size={12} />
                         <p className="text-[11px] font-black uppercase">{customerPhone}</p>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={executeSale}
                disabled={isSelling}
                className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all flex justify-center items-center gap-2"
              >
                {isSelling && <Loader2 className="animate-spin w-4 h-4"/>}
                {t.confirm}
              </button>
              <button disabled={isSelling} onClick={() => setShowConfirmSale(false)} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTerminal;