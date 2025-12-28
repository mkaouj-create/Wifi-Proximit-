
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Phone, CheckCircle2, Share2, AlertCircle, Sparkles, Loader2, Copy } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Ticket, UserProfile, TicketStatus, Agency } from '../types';
import { translations, Language } from '../i18n';

interface SalesTerminalProps {
  user: UserProfile;
  lang: Language;
}

const SalesTerminal: React.FC<SalesTerminalProps> = ({ user, lang }) => {
  const [availableTickets, setAvailableTickets] = useState<Ticket[]>([]);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSelling, setIsSelling] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [soldTicketInfo, setSoldTicketInfo] = useState<Ticket | null>(null);
  const [showConfirmSale, setShowConfirmSale] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [ticketsData, agencyData] = await Promise.all([
      supabase.getTickets(user.agency_id, user.role),
      supabase.getAgency(user.agency_id)
    ]);
    const unsold = ticketsData.filter(ticket => ticket.status === TicketStatus.UNSOLD);
    setAvailableTickets(unsold);
    setAgency(agencyData);
  };

  const dynamicProfiles = useMemo(() => {
    return Array.from(new Set(availableTickets.map(t => t.profile)));
  }, [availableTickets]);

  const currency = agency?.settings?.currency || 'GNF';

  // Génération centralisée du message avec Code, Validité, Prix
  const getReceiptMessage = (ticket: Ticket) => {
    const header = agency?.settings?.whatsapp_receipt_header || `*${t.appName}*`;
    return `${header}\n\n*CODE WIFI*\nCode: *${ticket.username}*\nValidité: *${ticket.time_limit}*\nPrix: *${ticket.price.toLocaleString()} ${currency}*\n\nMerci de votre confiance !`;
  };

  const handleCopy = async () => {
    if (!soldTicketInfo) return;
    const text = getReceiptMessage(soldTicketInfo);
    try {
      await navigator.clipboard.writeText(text);
      alert(lang === 'fr' ? 'Copié !' : 'Copied!');
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const sendWhatsApp = (ticket: Ticket, phone: string) => {
    if (!phone) {
        const message = getReceiptMessage(ticket);
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }
    
    let cleanPhone = phone.replace(/\D/g, '').replace(/^0+/, '');
    if (cleanPhone.length === 9 && currency === 'GNF') {
        cleanPhone = '224' + cleanPhone;
    }

    const message = getReceiptMessage(ticket);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const initiateSale = () => {
      if (!selectedProfile) return;
      setShowConfirmSale(true);
  };

  const executeSale = async () => {
    if (!selectedProfile) return;
    setShowConfirmSale(false);
    
    const ticketToSell = availableTickets.find(t => t.profile === selectedProfile);
    if (!ticketToSell) return;

    setIsSelling(true);
    
    const result = await supabase.sellTicket(ticketToSell.id, user.id, user.agency_id, customerPhone);
    
    if (result) {
      setSoldTicketInfo(ticketToSell);
      setShowReceipt(true);
      setIsSelling(false);
      const updatedTickets = await supabase.getTickets(user.agency_id, user.role);
      setAvailableTickets(updatedTickets.filter(t => t.status === TicketStatus.UNSOLD));
    } else {
      setIsSelling(false);
    }
  };

  const handleShare = async () => {
    if (!soldTicketInfo) return;
    const text = getReceiptMessage(soldTicketInfo).replace(/\*/g, '');
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ticket WiFi', text });
      } catch (err) { console.error(err); }
    } else {
      await navigator.clipboard.writeText(text);
      alert(lang === 'fr' ? 'Reçu copié !' : 'Receipt copied!');
    }
  };

  const resetTerminal = () => {
    setShowReceipt(false);
    setSoldTicketInfo(null);
    setSelectedProfile(null);
    setCustomerPhone('');
  };

  const getSelectedProfilePrice = () => {
      if (!selectedProfile) return 0;
      const t = availableTickets.find(ticket => ticket.profile === selectedProfile);
      return t ? t.price : 0;
  };

  if (showReceipt && soldTicketInfo) {
    return (
      <div className="animate-in zoom-in duration-300 max-w-sm mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-8 text-center space-y-6">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-green-50 dark:ring-green-900/10 animate-in bounce-in duration-500">
              <CheckCircle2 className="w-14 h-14" />
            </div>
            
            <div className="animate-in slide-in-from-bottom-4 duration-500 delay-100">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">{t.saleSuccess}</h2>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                {soldTicketInfo.profile} • {soldTicketInfo.price.toLocaleString()} {currency}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2.5rem] space-y-6 border border-gray-100 dark:border-gray-800 relative animate-in slide-in-from-bottom-4 duration-500 delay-200">
               <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-1 rounded-full border border-gray-100 dark:border-gray-700 text-[9px] font-black text-gray-400 uppercase tracking-tighter shadow-sm">
                 Ticket Virtuel
               </div>
               
               {/* VRAI QR Code Généré */}
               <div className="bg-white p-4 rounded-3xl shadow-sm inline-block">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${soldTicketInfo.username}&bgcolor=ffffff`}
                    alt="QR Code Ticket"
                    className="w-36 h-36 object-contain"
                  />
               </div>
               
               <div className="space-y-1">
                 <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">CODE WIFI</p>
                 <div className="text-4xl font-mono font-black tracking-widest text-primary-600 dark:text-primary-400 py-2 select-all">
                  {soldTicketInfo.username}
                 </div>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Validité: {soldTicketInfo.time_limit}</p>
               </div>
            </div>

            <div className="animate-in slide-in-from-bottom-4 duration-500 delay-300 px-2">
                <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-green-500 transition-colors">
                        <Phone className="w-full h-full" />
                    </div>
                    <input 
                        type="tel" 
                        placeholder={lang === 'fr' ? "Numéro WhatsApp..." : "WhatsApp Number..."}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-green-500/50 focus:ring-4 focus:ring-green-500/10 rounded-2xl pl-14 pr-4 py-4 transition-all outline-none font-bold text-center text-gray-900 dark:text-white placeholder:text-gray-400 text-sm shadow-sm"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 animate-in slide-in-from-bottom-4 duration-500 delay-400">
              <button 
                onClick={handleShare}
                className="flex flex-col items-center justify-center gap-1.5 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-[10px] transition-transform active:scale-95 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <Share2 className="w-5 h-5" />
                {t.share}
              </button>
              <button 
                onClick={handleCopy}
                className="flex flex-col items-center justify-center gap-1.5 py-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl font-black text-[10px] transition-transform active:scale-95 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                <Copy className="w-5 h-5" />
                {t.copyCode}
              </button>
              <button 
                onClick={() => sendWhatsApp(soldTicketInfo, customerPhone)}
                className="flex flex-col items-center justify-center gap-1.5 py-4 bg-green-500 text-white rounded-2xl font-black text-[10px] transition-transform active:scale-95 shadow-lg shadow-green-500/20 hover:bg-green-600"
              >
                <Phone className="w-5 h-5" />
                {t.whatsapp}
              </button>
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
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl shadow-sm">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white">{t.newSale}</h2>
          <p className="text-sm text-gray-500 font-medium">{availableTickets.length} tickets en stock</p>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block ml-1">{t.selectProfile}</label>
          {dynamicProfiles.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {dynamicProfiles.map(profile => {
                const count = availableTickets.filter(ticket => ticket.profile === profile).length;
                const sampleTicket = availableTickets.find(ticket => ticket.profile === profile);
                const isSelected = selectedProfile === profile;
                
                return (
                  <button
                    key={profile}
                    onClick={() => setSelectedProfile(profile)}
                    className={`p-6 rounded-[2.5rem] border-2 transition-all text-left relative overflow-hidden flex flex-col justify-between group h-44 ${
                      isSelected 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10 ring-8 ring-primary-500/5 shadow-lg' 
                      : 'border-white dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-200 shadow-sm'
                    }`}
                  >
                    <div>
                      <p className={`font-black text-xl leading-tight transition-colors ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>{profile}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{count} disponibles</p>
                    </div>
                    
                    <div className="mt-4">
                      <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {sampleTicket?.price.toLocaleString()} <span className="text-xs font-medium text-gray-400">{currency}</span>
                      </p>
                    </div>
                    
                    {isSelected && (
                      <div className="absolute top-6 right-6 bg-primary-600 text-white p-1 rounded-full shadow-lg">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-16 text-center bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-700 shadow-sm">
              <AlertCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-black uppercase tracking-widest">{lang === 'fr' ? 'Stock Épuisé' : 'Stock Empty'}</p>
              <p className="text-xs text-gray-400 mt-2 max-w-[220px] mx-auto leading-relaxed">{lang === 'fr' ? 'Veuillez importer de nouveaux tickets.' : 'Please import new tickets.'}</p>
            </div>
          )}
        </section>

        {selectedProfile && (
          <div className="animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] shadow-xl shadow-gray-200/40 dark:shadow-none space-y-8 border border-gray-50 dark:border-gray-700">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">{t.customerWhatsapp}</label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-primary-500 transition-colors">
                    <Phone className="w-full h-full" />
                  </div>
                  <input 
                    type="tel" 
                    placeholder="Ex: 624 00 00 00"
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500/30 focus:bg-white dark:focus:bg-gray-900 rounded-3xl pl-16 py-6 transition-all outline-none font-bold text-lg"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              <button 
                disabled={isSelling}
                onClick={initiateSale}
                className={`w-full py-6 rounded-[1.5rem] font-black text-xl flex items-center justify-center gap-4 transition-all duration-300 shadow-2xl overflow-hidden relative ${
                  isSelling
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none scale-95'
                  : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/30 active:scale-[0.98]'
                }`}
              >
                 {isSelling ? (
                     <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                     <ShoppingCart className="w-7 h-7" />
                  )}
                  <span>{isSelling ? 'Traitement...' : t.completeSale}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmation de Vente */}
      {showConfirmSale && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300 text-center">
            <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg border-2 border-primary-50 dark:border-primary-800">
              <ShoppingCart className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{t.confirmSaleTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-6">
              {t.confirmSaleDesc}
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl mb-8 border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">{t.profile}</p>
                <p className="text-3xl font-black text-primary-600 mb-1">{selectedProfile}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{getSelectedProfilePrice().toLocaleString()} {currency}</p>
                {customerPhone && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                         <p className="text-[10px] text-gray-400 font-bold uppercase">{customerPhone}</p>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={executeSale}
                className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all"
              >
                {t.confirm}
              </button>
              <button 
                onClick={() => setShowConfirmSale(false)}
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

export default SalesTerminal;
