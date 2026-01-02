
import React, { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle, MessageSquare, AlertTriangle, ShieldCheck, Eye, EyeOff, Loader2, Trash2, Globe, Clock, ShieldAlert } from 'lucide-react';
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
  
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const t = translations[lang];

  useEffect(() => { loadAgency(); }, []);

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
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
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
      setShowConfirm(false);
      setTimeout(() => setSaved(false), 2000);
      loadAgency();
    } catch (e) { alert("Erreur de sauvegarde"); }
    finally { setIsSaving(false); }
  };

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return alert(t.passwordTooShort);
    setPwdLoading(true);
    const success = await supabase.updatePassword(user.id, newPassword, user);
    setPwdLoading(false);
    if (success) {
      setNewPassword('');
      alert("Mot de passe mis à jour avec succès.");
    }
  };

  if (user.role === UserRole.SELLER) return (
    <div className="p-20 flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-red-500/10">
        <ShieldAlert size={40} />
      </div>
      <h2 className="text-2xl font-black uppercase text-red-500 tracking-tighter">Accès Restreint</h2>
      <p className="text-gray-500 font-medium mt-2 max-w-xs">Seuls les administrateurs peuvent modifier les paramètres de l'agence.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 pb-32">
      <div className="flex items-center gap-6">
        <div className="w-20 h-20 bg-primary-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary-500/20 shrink-0 border-4 border-white dark:border-gray-800">
          <Building2 size={36} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">{t.settings}</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-2">Console d'administration • {name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Section title={t.generalSettings} icon={<Globe size={20} />}>
          <Field label={t.agencyName}><input value={name} onChange={e => setName(e.target.value)} className="input-field" /></Field>
          <Field label={t.currency}>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-field cursor-pointer">
              <option value="GNF">GNF (Guinée)</option>
              <option value="XOF">CFA (UEMOA)</option>
              <option value="USD">USD ($)</option>
            </select>
          </Field>
          <Field label={t.contactPhone}><input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="input-field" placeholder="+224 ..." /></Field>
          <Field label={t.supportEmail}><input type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} className="input-field" placeholder="support@monwifi.com" /></Field>
          <div className="md:col-span-2">
            <Field label={t.businessAddress}><input value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} className="input-field" placeholder="Adresse physique de la boutique" /></Field>
          </div>
        </Section>

        <Section title={t.receiptSettings} icon={<MessageSquare size={20} />}>
          <Field label={t.receiptHeader}><textarea value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)} className="input-field min-h-[100px] resize-none" placeholder="Texte en haut du reçu..." /></Field>
          <Field label={t.receiptFooter}><textarea value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} className="input-field min-h-[100px] resize-none" placeholder="Texte en bas du reçu..." /></Field>
        </Section>

        <Section title="Maintenance & Stock" icon={<Trash2 size={20} />} fullWidth>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2 space-y-4">
              <div className="flex justify-between items-center px-2">
                <label className="text-[11px] font-black uppercase text-gray-500 tracking-widest">{t.autoCleanup}</label>
                <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-600 px-3 py-1 rounded-lg font-black text-xs">{autoCleanupDays} jours</span>
              </div>
              <input type="range" min="7" max="180" value={autoCleanupDays} onChange={e => setAutoCleanupDays(parseInt(e.target.value))} className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary-600 focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-800 flex gap-4">
              <Clock className="text-amber-500 shrink-0" size={24} />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-relaxed uppercase">Nettoyage auto des tickets vendus après ce délai pour optimiser le cloud.</p>
            </div>
          </div>
        </Section>

        <Section title="Sécurité Administrateur" icon={<ShieldCheck size={20} />} fullWidth>
          <form onSubmit={handleChangePwd} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">{t.changePassword}</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} className="input-field pr-12" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-all p-2">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button disabled={pwdLoading || !newPassword} className="w-full md:w-auto h-[62px] px-10 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl disabled:opacity-50 transition-all active:scale-95">
              {pwdLoading ? <Loader2 size={18} className="animate-spin" /> : 'Mettre à jour'}
            </button>
          </form>
        </Section>
      </div>

      <div className="fixed bottom-10 left-4 right-4 md:relative md:bottom-0 flex justify-center pt-10">
        <button onClick={() => setShowConfirm(true)} className="w-full md:max-w-md py-6 bg-primary-600 text-white rounded-[2rem] font-black text-lg uppercase tracking-[0.2em] shadow-2xl shadow-primary-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-4">
          {saved ? <CheckCircle className="w-7 h-7" /> : <div className="flex items-center gap-3"><Save size={24} /> {t.saveSettings}</div>}
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl text-center border dark:border-gray-700">
            <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner"><AlertTriangle size={40} /></div>
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Sauvegarder ?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8 leading-relaxed">Ces paramètres affecteront tous les reçus envoyés à vos clients.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleSave} disabled={isSaving} className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                {isSaving && <Loader2 className="animate-spin w-4 h-4" />}
                {t.confirm}
              </button>
              <button onClick={() => setShowConfirm(false)} className="w-full py-4 text-xs font-black uppercase text-gray-400 active:scale-95">Annuler</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input-field {
          width: 100%;
          padding: 1.25rem 1.5rem;
          background-color: rgba(249, 250, 251, 0.6);
          border: 2px solid transparent;
          border-radius: 1.25rem;
          font-weight: 700;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s ease;
          color: #111827;
        }
        .dark .input-field { background-color: rgba(17, 24, 39, 0.6); color: white; }
        .input-field:focus { border-color: rgba(14, 165, 233, 0.4); background-color: white; box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1); }
        .dark .input-field:focus { background-color: #030712; }
      `}</style>
    </div>
  );
};

const Section = ({ title, icon, children, fullWidth }: any) => (
  <div className={`bg-white dark:bg-gray-800 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-8 flex flex-col ${fullWidth ? 'md:col-span-2' : ''}`}>
    <div className="flex items-center gap-3 text-primary-600">
      <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-xl">{icon}</div>
      <h3 className="font-black uppercase tracking-tight dark:text-white text-lg">{title}</h3>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {children}
    </div>
  </div>
);

const Field = ({ label, children }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest leading-none">{label}</label>
    {children}
  </div>
);

export default AgencySettings;
