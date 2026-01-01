import React, { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle, Smartphone, MessageSquare, AlertTriangle, ShieldCheck, Eye, EyeOff, ShieldAlert, Ban, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Agency, UserProfile, UserRole } from '../types';
import { translations, Language } from '../i18n';

interface AgencySettingsProps {
  user: UserProfile;
  lang: Language;
  notify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const AgencySettings: React.FC<AgencySettingsProps> = ({ user, lang, notify }) => {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('GNF');
  const [receiptHeader, setReceiptHeader] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // États Changement MDP
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  
  const t = translations[lang];

  const safeNotify = (type: 'success' | 'error' | 'info', message: string) => {
    if (notify) notify(type, message);
    else if (type === 'error') alert(message);
  };

  // GATEKEEPER : Blocage strict côté UI pour les vendeurs
  if (user.role === UserRole.SELLER) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in zoom-in duration-500">
              <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-[2.5rem] flex items-center justify-center shadow-lg border-2 border-red-100 dark:border-red-900">
                  <ShieldAlert size={48} />
              </div>
              <div className="text-center space-y-2">
                  <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase">Accès Refusé</h2>
                  <p className="text-gray-500 font-medium max-w-sm mx-auto">Votre rôle de <span className="text-red-500 font-bold">VENDEUR</span> ne vous permet pas d'accéder aux paramètres sensibles de l'agence.</p>
              </div>
          </div>
      );
  }

  useEffect(() => {
    loadAgency();
  }, []);

  const loadAgency = async () => {
    try {
      const data = await supabase.getAgency(user.agency_id);
      if (data) {
        setAgency(data);
        setName(data.name);
        setCurrency(data.settings?.currency || 'GNF');
        setReceiptHeader(data.settings?.whatsapp_receipt_header || '');
        setContactPhone(data.settings?.contact_phone || '');
      }
    } catch (e) {
      console.error("Erreur chargement agence", e);
    }
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const executeSave = async () => {
    setShowConfirm(false);
    setIsSaving(true);
    try {
        await supabase.updateAgency(user.agency_id, name, {
            currency,
            whatsapp_receipt_header: receiptHeader,
            contact_phone: contactPhone
        }, user);
        
        setSaved(true);
        safeNotify('success', 'Configuration enregistrée');
        setTimeout(() => setSaved(false), 3000);
        await loadAgency(); 
    } catch (e) {
        safeNotify('error', "Impossible de sauvegarder les modifications.");
    } finally {
        setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
        safeNotify('error', t.passwordTooShort);
        return;
    }
    if (newPassword !== confirmPassword) {
        safeNotify('error', t.passwordMismatch);
        return;
    }

    setPwdLoading(true);
    const success = await supabase.updatePassword(user.id, newPassword, user);
    setPwdLoading(false);

    if (success) {
        safeNotify('success', t.passwordChanged);
        setNewPassword('');
        setConfirmPassword('');
    } else {
        safeNotify('error', "Une erreur est survenue lors de la mise à jour.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-20">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 border-2 border-primary-200 dark:border-primary-800 shadow-inner">
          <Building2 className="w-10 h-10 md:w-12 md:h-12" />
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white leading-tight">{t.settings}</h2>
        <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight uppercase text-xs tracking-[0.2em]">Identité & Configuration</p>
      </div>

      <div className="space-y-6">
        {/* General Section */}
        <form onSubmit={handleSaveClick} className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-5 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/40 dark:shadow-none space-y-6 md:space-y-8">
              <div className="flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 pb-4">
                <Smartphone className="w-5 h-5 text-primary-500" />
                <h3 className="font-black text-lg text-gray-900 dark:text-white">{t.generalSettings}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.agencyName}</label>
                  <input type="text" className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500/30 rounded-2xl font-bold transition-all outline-none text-sm md:text-base" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.currency}</label>
                  <select className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500/30 rounded-2xl font-bold transition-all outline-none appearance-none text-sm md:text-base" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="GNF">GNF (Guinean Franc)</option>
                    <option value="USD">USD (Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="XOF">CFA (Franc CFA)</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.contactPhone}</label>
                  <input type="tel" placeholder="+224 ..." className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500/30 rounded-2xl font-bold transition-all outline-none text-sm md:text-base" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/40 dark:shadow-none space-y-6 md:space-y-8">
              <div className="flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 pb-4">
                <MessageSquare className="w-5 h-5 text-primary-500" />
                <h3 className="font-black text-lg text-gray-900 dark:text-white">{t.receiptSettings}</h3>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.receiptHeader}</label>
                <textarea rows={3} className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-primary-500/30 rounded-2xl font-medium transition-all outline-none resize-none text-sm md:text-base" placeholder="Ex: *MERCI DE VOTRE VISITE*" value={receiptHeader} onChange={(e) => setReceiptHeader(e.target.value)} />
              </div>
            </div>

            <button type="submit" disabled={saved || isSaving} className={`w-full py-5 md:py-6 rounded-[1.5rem] font-black text-base md:text-lg flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-2xl ${saved ? 'bg-green-500 text-white' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/40'}`}>
              {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : saved ? (<><CheckCircle className="w-6 h-6 animate-bounce" /> Enregistré</>) : (<><Save className="w-6 h-6" /> {t.saveSettings}</>)}
            </button>
        </form>

        {/* Section Sécurité : Changement de MDP personnel */}
        <div className="bg-white dark:bg-gray-800 p-5 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/40 dark:shadow-none space-y-6 md:space-y-8">
            <div className="flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 pb-4">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-lg text-gray-900 dark:text-white">{t.security}</h3>
            </div>
            
            <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2 relative">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.newPassword}</label>
                        <div className="relative">
                            <input 
                                type={showPwd ? "text" : "password"} 
                                className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-amber-500/30 rounded-2xl font-bold transition-all outline-none text-sm md:text-base"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 p-2">
                                {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">{t.confirmPassword}</label>
                        <input 
                            type={showPwd ? "text" : "password"} 
                            className="w-full px-5 py-4 md:px-6 md:py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-amber-500/30 rounded-2xl font-bold transition-all outline-none text-sm md:text-base"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                </div>
                <button type="submit" disabled={pwdLoading} className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-amber-500 text-white shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    {pwdLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldCheck className="w-4 h-4" />}
                    {t.changePassword}
                </button>
            </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-8 md:p-10 shadow-2xl animate-in zoom-in duration-300 text-center">
            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg border-2 border-amber-50 dark:border-amber-800">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">{t.confirmActionTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
              {t.confirmSaveSettings}
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={executeSave} className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all">
                {t.confirm}
              </button>
              <button onClick={() => setShowConfirm(false)} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
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