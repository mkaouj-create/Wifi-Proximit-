
import React, { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle, Smartphone, MessageSquare, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Agency, UserProfile } from '../types';
import { translations, Language } from '../i18n';

interface AgencySettingsProps {
  user: UserProfile;
  lang: Language;
}

const AgencySettings: React.FC<AgencySettingsProps> = ({ user, lang }) => {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('GNF');
  const [receiptHeader, setReceiptHeader] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const t = translations[lang];

  useEffect(() => {
    loadAgency();
  }, []);

  const loadAgency = async () => {
    const data = await supabase.getAgency(user.agency_id);
    if (data) {
      setAgency(data);
      setName(data.name);
      setCurrency(data.settings?.currency || 'GNF');
      setReceiptHeader(data.settings?.whatsapp_receipt_header || '');
      // Typage maintenant correct, pas besoin de 'as any'
      setContactPhone(data.settings?.contact_phone || '');
    }
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const executeSave = async () => {
    setShowConfirm(false);
    await supabase.updateAgency(user.agency_id, name, {
      currency,
      whatsapp_receipt_header: receiptHeader,
      contact_phone: contactPhone
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-3">
        <div className="w-24 h-24 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 border-2 border-primary-200 dark:border-primary-800 shadow-inner">
          <Building2 className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-tight">{t.settings}</h2>
        <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight uppercase text-xs tracking-[0.2em]">Identité & Configuration</p>
      </div>

      <form onSubmit={handleSaveClick} className="space-y-6">
        {/* General Section */}
        <div className="bg-white dark:bg-gray-800 p-8 lg:p-10 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/40 dark:shadow-none space-y-8">
          <div className="flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 pb-4">
            <Smartphone className="w-5 h-5 text-primary-500" />
            <h3 className="font-black text-lg text-gray-900 dark:text-white">{t.generalSettings}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.agencyName}</label>
              <input 
                type="text" 
                className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500/30 rounded-2xl font-bold transition-all outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.currency}</label>
              <select 
                className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500/30 rounded-2xl font-bold transition-all outline-none appearance-none"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="GNF">GNF (Guinean Franc)</option>
                <option value="USD">USD (Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="XOF">CFA (Franc CFA)</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.contactPhone}</label>
              <input 
                type="tel" 
                placeholder="+224 ..."
                className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500/30 rounded-2xl font-bold transition-all outline-none"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Receipt Customization Section */}
        <div className="bg-white dark:bg-gray-800 p-8 lg:p-10 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/40 dark:shadow-none space-y-8">
          <div className="flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 pb-4">
            <MessageSquare className="w-5 h-5 text-primary-500" />
            <h3 className="font-black text-lg text-gray-900 dark:text-white">{t.receiptSettings}</h3>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.receiptHeader}</label>
            <textarea 
              rows={3}
              className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500/30 rounded-2xl font-medium transition-all outline-none resize-none"
              placeholder="Ex: *MERCI DE VOTRE VISITE*"
              value={receiptHeader}
              onChange={(e) => setReceiptHeader(e.target.value)}
            />
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest pl-1">
              Conseil: Utilisez *texte* pour mettre en gras sur WhatsApp.
            </p>
          </div>

          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100/50 dark:border-blue-900/50 flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
              {lang === 'fr' 
                ? "Ces configurations sont appliquées instantanément à tous les nouveaux reçus générés par vos vendeurs." 
                : "These configurations are instantly applied to all new receipts generated by your sellers."}
            </p>
          </div>
        </div>

        <button 
          type="submit"
          disabled={saved}
          className={`w-full py-6 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-2xl ${
            saved 
            ? 'bg-green-500 text-white' 
            : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/40'
          }`}
        >
          {saved ? (
            <>
              <CheckCircle className="w-6 h-6 animate-bounce" />
              Configuration Enregistrée
            </>
          ) : (
            <>
              <Save className="w-6 h-6" />
              {t.saveSettings}
            </>
          )}
        </button>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300 text-center">
            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg border-2 border-amber-50 dark:border-amber-800">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">{t.confirmActionTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
              {t.confirmSaveSettings}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={executeSave}
                className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all"
              >
                {t.confirm}
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
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

export default AgencySettings;
