
import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, User, Shield, Mail, Edit3, X, Check, Building2, Lock, KeyRound, AlertTriangle, Key, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { UserProfile, UserRole, Agency } from '../types';
import { translations, Language } from '../i18n';

interface UserManagementProps {
  user: UserProfile;
  lang: Language;
}

const UserManagement: React.FC<UserManagementProps> = ({ user, lang }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<UserProfile | null>(null);
  const [confirmAction, setConfirmAction] = useState<{type: 'ADD' | 'UPDATE' | 'PWD' | 'DELETE', payload?: any} | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    email: '', password: '', pin: '', role: UserRole.SELLER, agencyId: user.agency_id
  });
  const [resetPwdValue, setResetPwdValue] = useState('');

  const t = translations[lang];
  const isSuper = user.role === UserRole.SUPER_ADMIN;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uData, aData] = await Promise.all([
        supabase.getUsers(user.agency_id, user.role),
        isSuper ? supabase.getAgencies() : Promise.resolve([])
      ]);
      setUsers(isSuper ? uData : uData.filter(u => u.role !== UserRole.SUPER_ADMIN));
      setAgencies(aData);
    } finally { setLoading(false); }
  };

  const canManage = (target: UserProfile) => {
    if (user.id === target.id) return false;
    if (isSuper) return true;
    if (user.role === UserRole.ADMIN && target.role === UserRole.SELLER) return true;
    return false;
  };

  const handleAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      switch (confirmAction.type) {
        case 'ADD':
          await supabase.addUser({ ...formData, display_name: formData.email.split('@')[0] });
          setShowAdd(false);
          break;
        case 'DELETE':
          await supabase.deleteUser(confirmAction.payload.id, user);
          break;
        case 'PWD':
          await supabase.updatePassword(passwordModalUser!.id, resetPwdValue, user);
          setPasswordModalUser(null);
          break;
        case 'UPDATE':
          await supabase.updateUserRole(editingUser!.id, formData.role);
          setEditingUser(null);
          break;
      }
      notify('success', 'Action réussie');
      await loadData();
    } catch (e) { notify('error', 'Erreur technique'); }
    finally { setActionLoading(false); setConfirmAction(null); }
  };

  const notify = (type: string, msg: string) => alert(msg); // Placeholder for a real notify system

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t.manageTeam}</h2>
          <p className="text-xs text-gray-500 font-black uppercase tracking-widest mt-1">{users.length} Collaborateurs</p>
        </div>
        {!isSuper && user.role === UserRole.SELLER ? null : (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-3 bg-primary-600 text-white px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all">
            <UserPlus size={20} /> {t.addMember}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin text-primary-500" /></div>
        ) : users.map(u => (
          <div key={u.id} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 flex items-center justify-between shadow-sm group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400"><User size={24} /></div>
              <div className="min-w-0">
                <p className="font-black text-gray-900 dark:text-white uppercase truncate">{u.display_name}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${u.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                {u.role.replace('_', ' ')}
              </span>
              {canManage(u) && (
                <div className="flex gap-1">
                  <button onClick={() => setPasswordModalUser(u)} className="p-2 text-gray-400 hover:text-amber-500 transition-colors"><Key size={16} /></button>
                  <button onClick={() => setConfirmAction({type: 'DELETE', payload: u})} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl text-center">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${confirmAction.type === 'DELETE' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-xl font-black uppercase mb-4">{confirmAction.type === 'DELETE' ? 'Supprimer ?' : t.confirm}</h3>
            <p className="text-sm text-gray-500 mb-8">{confirmAction.type === 'DELETE' ? t.confirmDeleteUser : 'Voulez-vous valider cette action ?'}</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleAction} disabled={actionLoading} className={`w-full py-5 text-white rounded-2xl font-black text-sm uppercase ${confirmAction.type === 'DELETE' ? 'bg-red-600' : 'bg-primary-600'}`}>
                {actionLoading ? <Loader2 className="animate-spin mx-auto" /> : t.confirm}
              </button>
              <button onClick={() => setConfirmAction(null)} className="w-full py-4 font-black uppercase text-xs text-gray-400">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase tracking-tight">{t.addMember}</h3>
              <button onClick={() => setShowAdd(false)}><X /></button>
            </div>
            <div className="space-y-4">
              <input type="email" placeholder="Email" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl outline-none" onChange={e => setFormData({...formData, email: e.target.value})} />
              <input type="password" placeholder="Password" className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl outline-none" onChange={e => setFormData({...formData, password: e.target.value})} />
              <input type="text" placeholder="PIN (4 chiffres)" maxLength={4} className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl outline-none" onChange={e => setFormData({...formData, pin: e.target.value})} />
              <select className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl outline-none" onChange={e => setFormData({...formData, role: e.target.value as UserRole})}>
                <option value={UserRole.SELLER}>{t.seller}</option>
                <option value={UserRole.ADMIN}>{t.admin}</option>
              </select>
              <button onClick={() => setConfirmAction({type: 'ADD'})} className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black uppercase text-sm mt-4 shadow-lg shadow-primary-500/20">{t.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
