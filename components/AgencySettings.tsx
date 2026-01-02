
import React, { useState, useEffect } from 'react';
// Added Clock to the imports from lucide-react
import { Building2, Save, CheckCircle, Smartphone, MessageSquare, AlertTriangle, ShieldCheck, Eye, EyeOff, ShieldAlert, Ban, Loader2, Mail, MapPin, Hash, Trash2, Globe, Clock } from 'lucide-react';
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
  const [receiptFooter, setReceiptFooter] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [autoCleanupDays, setAutoCleanupDays] = useState(30);
  
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
        setReceiptFooter(data.settings?.whatsapp_receipt_footer || '');
        setContactPhone(data.settings?.contact_phone || '');
        setSupportEmail(data.settings?.support_email || '');
        setBusinessAddress(data.settings?.business_address || '');
        setAutoCleanupDays(data.settings?.auto_cleanup_days || 30);
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
            ...agency?.settings,
            currency,
            whatsapp_receipt_header: receiptHeader,
            whatsapp_receipt_footer: receiptFooter,
            contact_phone: contactPhone,
            support_email: supportEmail,
            business_address: businessAddress,
            auto_cleanup_days: autoCleanupDays
        }, user);
        
        setSaved(true);
        safeNotify('success', 'Configuration enregistrée');
        setTimeout(() => setSaved(false), 3000);
        await loadAgency(); 
    } catch (e) {
        safeNotify('error', "Impossible de sauvegarder.");
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
        safeNotify('error', "Une erreur est survenue.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-20">
      <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
        <div className="w-24 h-24 md:w-32 md:h-32 bg-primary-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-primary-500/20 border-4 border-white dark:border-gray-800 shrink-0">
          <Building2 size={48} />
        </div>
        <div className="text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white leading-tight uppercase tracking-tight">{t.settings}</h2>
            <p className="text-gray-500 dark:text-gray-400 font-black uppercase text-[10px] tracking-[0.3em] mt-1">Console d'administration • {agency?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation / Info Sidebar */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl flex items-center justify-center shadow-sm"><ShieldCheck size={20} /></div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Abonnement</p>
                        <p className="font-black dark:text-white uppercase leading-none">{agency?.plan_name || 'Standard'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl flex items-center justify-center shadow-sm"><Globe size={20} /></div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Région</p>
                        <p className="font-black dark:text-white uppercase leading-none">{currency === 'GNF' ? 'Guinée' : currency === 'XOF' ? 'UEMOA' : 'Internationale'}</p>
                    </div>
                </div>
                <div className="pt-4 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-gray-400 font-black uppercase">Consommation</span>
                        <span className="text-[10px] text-primary-500 font-black uppercase">Crédits</span>
                    </div>
                    <div className="w-full h-2 bg-gray-50 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 w-[65%]" />
                    </div>
                </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-900/30">
                <div className="flex gap-4">
                    <AlertTriangle className="text-amber-600 shrink-0" size={24} />
                    <div className="space-y-1">
                        <p className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase">Attention</p>
                        <p className="text-[10px] text-amber-700/80 dark:text-amber-500 font-medium leading-relaxed">Les modifications de devise ou de nom d'agence impactent instantanément l'affichage des reçus clients.</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Main Forms */}
        <div className="lg:col-span-2 space-y-8">
            <form onSubmit={handleSaveClick} className="space-y-8">
                {/* Section Identité */}
                <div className="bg-white dark:bg-gray-800 p-8 md:p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-2xl"><Smartphone size={24} /></div>
                        <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">{t.generalSettings}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SettingField label={t.agencyName} icon={<Building2 />}>
                            <input type="text" className="setting-input" value={name} onChange={(e) => setName(e.target.value)} required />
                        </SettingField>
                        
                        <SettingField label={t.currency} icon={<Globe />}>
                            <select className="setting-input appearance-none" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                                <option value="GNF">GNF (Guinée)</option>
                                <option value="XOF">CFA (UEMOA)</option>
                                <option value="USD">USD (Dollar)</option>
                            </select>
                        </SettingField>

                        <SettingField label={t.contactPhone} icon={<Smartphone />}>
                            <input type="tel" className="setting-input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="WhatsApp..." />
                        </SettingField>

                        <SettingField label={t.supportEmail} icon={<Mail />}>
                            <input type="email" className="setting-input" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@agence.com" />
                        </SettingField>

                        <div className="md:col-span-2">
                            <SettingField label={t.businessAddress} icon={<MapPin />}>
                                <input type="text" className="setting-input" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="Quartier, Avenue, Boutique #..." />
                            </SettingField>
                        </div>
                    </div>
                </div>

                {/* Section Reçus */}
                <div className="bg-white dark:bg-gray-800 p-8 md:p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl"><MessageSquare size={24} /></div>
                        <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">{t.receiptSettings}</h3>
                    </div>

                    <div className="space-y-6">
                        <SettingField label={t.receiptHeader} icon={<Hash />}>
                            <textarea rows={2} className="setting-input resize-none py-4" placeholder="Ex: *BIENVENUE CHEZ GESTA WIFI*" value={receiptHeader} onChange={(e) => setReceiptHeader(e.target.value)} />
                        </SettingField>
                        
                        <SettingField label={t.receiptFooter} icon={<Hash />}>
                            <textarea rows={2} className="setting-input resize-none py-4" placeholder="Ex: *MERCI ET A BIENTOT*" value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} />
                        </SettingField>
                    </div>
                </div>

                {/* Section Maintenance */}
                <div className="bg-white dark:bg-gray-800 p-8 md:p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-2xl"><Trash2 size={24} /></div>
                        <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">Maintenance Stock</h3>
                    </div>
                    
                    <SettingField label={t.autoCleanup} icon={<Clock />}>
                        <div className="flex items-center gap-4">
                            <input type="range" min="7" max="180" step="1" className="flex-1 accent-primary-600" value={autoCleanupDays} onChange={(e) => setAutoCleanupDays(parseInt(e.target.value))} />
                            <span className="w-16 text-center font-black text-primary-600 bg-primary-50 dark:bg-primary-900/30 py-2 rounded-xl text-sm">{autoCleanupDays} j</span>
                        </div>
                    </SettingField>
                </div>

                <button type="submit" disabled={saved || isSaving} className={`w-full py-6 rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-2xl uppercase tracking-widest ${saved ? 'bg-green-500 text-white' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/30'}`}>
                    {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : saved ? (<><CheckCircle className="w-6 h-6" /> {t.confirm}</>) : (<><Save className="w-6 h-6" /> {t.saveSettings}</>)}
                </button>
            </form>

            {/* Account Security */}
            <div className="bg-white dark:bg-gray-800 p-8 md:p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none space-y-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-2xl"><ShieldCheck size={24} /></div>
                    <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">{t.security}</h3>
                </div>
                
                <form onSubmit={handlePasswordChange} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SettingField label={t.newPassword} icon={<Lock />}>
                        <div className="relative">
                            <input type={showPwd ? "text" : "password"} className="setting-input pr-12" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 p-1 hover:text-primary-500 transition-colors">
                                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </SettingField>
                    
                    <SettingField label={t.confirmPassword} icon={<ShieldCheck />}>
                        <input type={showPwd ? "text" : "password"} className="setting-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    </SettingField>

                    <button type="submit" disabled={pwdLoading} className="md:col-span-2 py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-amber-500 text-white shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                        {pwdLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldCheck className="w-4 h-4" />}
                        {t.changePassword}
                    </button>
                </form>
            </div>
        </div>
      </div>

      <style>{`
        .setting-input {
          width: 100%;
          padding: 1.25rem 1.5rem;
          background-color: #f9fafb;
          border: 2px solid transparent;
          border-radius: 1.25rem;
          font-weight: 700;
          outline: none;
          transition: all 0.2s ease;
          color: #111827;
        }
        .dark .setting-input {
          background-color: #111827;
          color: white;
        }
        .setting-input:focus {
          border-color: rgba(14, 165, 233, 0.3);
          background-color: white;
        }
        .dark .setting-input:focus {
          background-color: #030712;
        }
      `}</style>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in duration-300 text-center border dark:border-gray-700">
            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg border-2 border-amber-50 dark:border-amber-800">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tight">{t.confirmActionTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
              Confirmez-vous les nouveaux paramètres de votre agence ?
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

const SettingField = ({ label, icon, children }: any) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 ml-2">
            <div className="text-gray-400">{React.cloneElement(icon, { size: 14 })}</div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
        </div>
        {children}
    </div>
);

export default AgencySettings;
