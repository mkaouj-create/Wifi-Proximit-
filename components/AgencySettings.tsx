
import React, { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle, Smartphone, MessageSquare, AlertTriangle, ShieldCheck, Eye, EyeOff, Loader2, Mail, MapPin, Hash, Trash2, Globe, Clock } from 'lucide-react';
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
    } catch (e) { alert("Erreur de sauvegarde"); }
    finally { setIsSaving(false); }
  };

  if (user.role === UserRole.SELLER) return <div className="p-20 text-center font-black uppercase text-red-500">Accès Interdit</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 pb-32">
      <div className="flex items-center gap-6">
        <div className="w-20 h-20 bg-primary-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-primary-500/20 shrink-0">
          <Building2 size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t.settings}</h2>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Console d'administration • {name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Identité Section */}
        <Section title={t.generalSettings} icon={<Globe size={20} />}>
          <Field label={t.agencyName}><input value={name} onChange={e => setName(e.target.value)} className="input-field" /></Field>
          <Field label={t.currency}>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-field">
              <option value="GNF">GNF (Guinée)</option>
              <option value="XOF">CFA (XOF)</option>
              <option value="USD">USD ($)</option>
            </select>
          </Field>
          <Field label={t.contactPhone}><input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="input-field" placeholder="WhatsApp..." /></Field>
          <Field label={t.supportEmail}><input value={supportEmail} onChange={e => setSupportEmail(e.target.value)} className="input-field" placeholder="Email support" /></Field>
        </Section>

        {/* Format Reçus Section */}
        <Section title={t.receiptSettings} icon={<MessageSquare size={20} />}>
          <Field label={t.receiptHeader}><textarea value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)} className="input-field min-h-[80px]" placeholder="En-tête..." /></Field>
          <Field label={t.receiptFooter}><textarea value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} className="input-field min-h-[80px]" placeholder="Pied de page..." /></Field>
        </Section>

        {/* Maintenance Section */}
        <Section title="Maintenance & Archive" icon={<Trash2 size={20} />} fullWidth>
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400">{t.autoCleanup} ({autoCleanupDays} j)</label>
              <input type="range" min="7" max="180" value={autoCleanupDays} onChange={e => setAutoCleanupDays(parseInt(e.target.value))} className="w-full accent-primary-600" />
            </div>
            <p className="text-xs text-gray-400 font-medium md:max-w-xs">Les tickets vendus seront automatiquement archivés après ce délai pour maintenir les performances.</p>
          </div>
        </Section>
      </div>

      <div className="fixed bottom-10 left-4 right-4 md:relative md:bottom-0 flex justify-center pt-10">
        <button onClick={() => setShowConfirm(true)} className="w-full md:max-w-sm py-5 bg-primary-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-2xl shadow-primary-500/40 active:scale-95 transition-all">
          {saved ? <CheckCircle className="mx-auto" /> : <div className="flex items-center justify-center gap-2"><Save size={20} /> {t.saveSettings}</div>}
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl text-center border dark:border-gray-700">
            <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6"><AlertTriangle size={40} /></div>
            <h3 className="text-xl font-black uppercase mb-4">Confirmer ?</h3>
            <p className="text-sm text-gray-500 mb-8">Les modifications impacteront tous les terminaux de vente de votre agence.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleSave} disabled={isSaving} className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase">
                {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'Enregistrer'}
              </button>
              <button onClick={() => setShowConfirm(false)} className="w-full py-4 text-xs font-black uppercase text-gray-400">Annuler</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input-field {
          width: 100%;
          padding: 1.25rem;
          background-color: rgba(249, 250, 251, 0.5);
          border: 2px solid transparent;
          border-radius: 1.25rem;
          font-weight: 700;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s ease;
        }
        .dark .input-field { background-color: rgba(17, 24, 39, 0.5); color: white; }
        .input-field:focus { border-color: rgba(14, 165, 233, 0.3); background-color: white; }
        .dark .input-field:focus { background-color: #030712; }
      `}</style>
    </div>
  );
};

const Section = ({ title, icon, children, fullWidth }: any) => (
  <div className={`bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 space-y-6 ${fullWidth ? 'md:col-span-2' : ''}`}>
    <div className="flex items-center gap-3 text-primary-600">
      {icon} <h3 className="font-black uppercase tracking-tight dark:text-white">{title}</h3>
    </div>
    {children}
  </div>
);

const Field = ({ label, children }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-widest">{label}</label>
    {children}
  </div>
);

export default AgencySettings;
