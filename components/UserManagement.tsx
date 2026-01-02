
import React, { useState, useEffect } from 'react';
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
  
  // États d'édition unifiés
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>(UserRole.SELLER);
  const [editEmail, setEditEmail] = useState('');
  
  const [passwordModalUser, setPasswordModalUser] = useState<UserProfile | null>(null);
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.SELLER);
  const [targetAgencyId, setTargetAgencyId] = useState<string>(user.agency_id);
  
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [confirmAction, setConfirmAction] = useState<{type: 'ADD' | 'UPDATE_USER' | 'RESET_PWD' | 'DELETE_USER', payload?: any} | null>(null);

  const t = translations[lang];
  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const [userData, agencyData] = await Promise.all([
          supabase.getUsers(user.agency_id, user.role),
          supabase.getAgencies()
        ]);
        
        const safeUsers = isSuperAdmin ? userData : userData.filter(u => u.role !== UserRole.SUPER_ADMIN);
        setUsers(safeUsers);
        setAgencies(agencyData.filter(a => a.status === 'active'));
    } finally {
        setLoading(false);
    }
  };

  const getAgencyName = (id: string) => agencies.find(a => a.id === id)?.name || 'Inconnue';

  // Sécurité: Qui peut modifier qui ?
  const canEditUser = (target: UserProfile) => {
    // Un vendeur ne peut rien modifier
    if (user.role === UserRole.SELLER) return false;
    
    // Un Super Admin peut tout modifier (sauf lui-même ici pour éviter verrouillage accidentel)
    if (isSuperAdmin) return user.id !== target.id;
    
    // Un Admin peut modifier les Vendeurs de SON agence, mais pas les autres Admins
    if (user.role === UserRole.ADMIN && target.role === UserRole.SELLER && target.agency_id === user.agency_id) return true;
    
    return false;
  };

  const canDeleteUser = (target: UserProfile) => canEditUser(target);
  const canResetPassword = (target: UserProfile) => canEditUser(target);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmAction({ type: 'ADD' });
  };

  const executeAddUser = async () => {
    setConfirmAction(null);
    setActionLoading(true);
    try {
        const roleToAssign = (newRole === UserRole.SUPER_ADMIN && !isSuperAdmin) ? UserRole.SELLER : newRole;

        await supabase.addUser({ 
          email: newEmail, password: newPassword, pin: newPin, role: roleToAssign, agency_id: targetAgencyId 
        });
        
        setNewEmail(''); setNewPassword(''); setNewPin('');
        setShowAdd(false);
        await loadData();
    } catch (e: any) {
        alert("Erreur: " + (e.message || "Impossible de créer l'utilisateur (Email déjà pris ?)"));
    } finally {
        setActionLoading(false);
    }
  };

  const executeDeleteUser = async () => {
    const target = confirmAction?.payload;
    setConfirmAction(null);
    if (!target) return;

    setActionLoading(true);
    try {
        await supabase.deleteUser(target.id, user);
        await loadData();
    } catch (e) {
        alert("Échec de la suppression.");
    } finally {
        setActionLoading(false);
    }
  };

  const openEditModal = (u: UserProfile) => {
      setEditingUser(u);
      setEditRole(u.role);
      setEditEmail(u.email);
  };

  const handleUpdateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmAction({ type: 'UPDATE_USER' });
  };

  const executeUpdateUser = async () => {
    setConfirmAction(null);
    if (!editingUser) return;
    
    setActionLoading(true);
    try {
        let needsRefresh = false;
        
        // 1. Mise à jour du rôle
        if (editRole !== editingUser.role) {
            await supabase.updateUserRole(editingUser.id, editRole);
            needsRefresh = true;
        }
        
        // 2. Mise à jour de l'email (si changé)
        if (editEmail !== editingUser.email) {
            const success = await supabase.updateUserEmail(editingUser.id, editEmail, user);
            if (!success) {
                alert("Erreur: Cet email est déjà utilisé ou vous n'avez pas la permission.");
                return; // On arrête ici si l'email échoue
            }
            needsRefresh = true;
        }
        
        if(needsRefresh) {
            setEditingUser(null);
            await loadData();
        }
    } catch(e) {
        alert("Une erreur technique est survenue.");
    } finally {
        setActionLoading(false);
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPasswordValue.length < 6) {
        alert(t.passwordTooShort);
        return;
    }
    setConfirmAction({ type: 'RESET_PWD' });
  };

  const executeResetPassword = async () => {
    setConfirmAction(null);
    if (!passwordModalUser) return;
    
    setActionLoading(true);
    const success = await supabase.updatePassword(passwordModalUser.id, resetPasswordValue, user);
    setActionLoading(false);

    if (success) {
        setPasswordModalUser(null);
        setResetPasswordValue('');
    } else {
        alert("Erreur technique.");
    }
  };

  const allowedRoles = [
      UserRole.SELLER, UserRole.ADMIN, ...(isSuperAdmin ? [UserRole.SUPER_ADMIN] : [])
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white leading-tight uppercase tracking-tight">{t.manageTeam}</h2>
          <p className="text-xs text-gray-500 font-black uppercase tracking-widest mt-1 leading-none">{users.length} collaborateurs actifs</p>
        </div>
        {user.role !== UserRole.SELLER && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-3 bg-primary-600 text-white px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary-500/30 active:scale-95 transition-all">
            <UserPlus className="w-5 h-5" /> {t.addMember}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
            <div className="col-span-full flex justify-center py-20">
                <Loader2 className="animate-spin text-primary-500 w-8 h-8" />
            </div>
        ) : users.map(u => (
          <div key={u.id} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-primary-500 transition-colors">
                <User className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-gray-900 dark:text-white text-lg truncate uppercase tracking-tight">{u.display_name}</p>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-500 font-medium truncate">{u.email}</p>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-gray-400" />
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-tight">{getAgencyName(u.agency_id)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 shrink-0">
              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                u.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-700' :
                u.role === UserRole.ADMIN ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {u.role.replace('_', ' ')}
              </span>
              
              <div className="flex gap-2">
                {canResetPassword(u) && (
                  <button onClick={() => setPasswordModalUser(u)} className="p-2.5 bg-gray-50 dark:bg-gray-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-400 hover:text-amber-600 rounded-xl transition-all active:scale-90" title={t.resetPassword}>
                    <Key className="w-4 h-4" />
                  </button>
                )}
                {canEditUser(u) && (
                  <button onClick={() => openEditModal(u)} className="p-2.5 bg-gray-50 dark:bg-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 rounded-xl transition-all active:scale-90">
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                {canDeleteUser(u) && (
                  <button onClick={() => setConfirmAction({type: 'DELETE_USER', payload: u})} className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-600 rounded-xl transition-all active:scale-90">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Réinitialisation MDP */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Key className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">{t.resetPassword}</h3>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">{passwordModalUser.display_name}</p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t.newPassword}</label>
                        <input 
                            type="text" 
                            autoFocus
                            className="w-full p-5 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-amber-500 rounded-2xl font-bold dark:text-white"
                            value={resetPasswordValue}
                            onChange={(e) => setResetPasswordValue(e.target.value)}
                            placeholder="Min. 6 caractères"
                        />
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={() => { setPasswordModalUser(null); setResetPasswordValue(''); }} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest">{t.cancel}</button>
                        <button type="submit" disabled={actionLoading} className="flex-1 py-5 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-500/30 flex justify-center">{actionLoading ? <Loader2 className="animate-spin w-4 h-4"/> : t.confirm}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Modal Confirmation Générique */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300 text-center border dark:border-gray-700">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg border-2 ${confirmAction.type === 'DELETE_USER' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 border-red-50 dark:border-red-900' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 border-amber-50 dark:border-amber-800'}`}>
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tight">
                {confirmAction.type === 'DELETE_USER' ? t.deleteUser : t.confirmActionTitle}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
              {confirmAction.type === 'ADD' ? t.confirmCreateUser : 
               confirmAction.type === 'UPDATE_USER' ? "Voulez-vous enregistrer ces modifications ?" : 
               confirmAction.type === 'DELETE_USER' ? t.confirmDeleteUser : "Voulez-vous vraiment réinitialiser ce mot de passe ?"}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                    if(confirmAction.type === 'ADD') executeAddUser();
                    else if(confirmAction.type === 'UPDATE_USER') executeUpdateUser();
                    else if(confirmAction.type === 'DELETE_USER') executeDeleteUser();
                    else executeResetPassword();
                }}
                disabled={actionLoading}
                className={`w-full py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2 ${confirmAction.type === 'DELETE_USER' ? 'bg-red-600 shadow-red-500/30' : 'bg-primary-600 shadow-primary-500/30'}`}
              >
                {actionLoading && <Loader2 className="animate-spin w-4 h-4" />}
                {t.confirm}
              </button>
              <button onClick={() => setConfirmAction(null)} disabled={actionLoading} className="w-full py-5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'Ajout */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300 overflow-y-auto max-h-[90vh] no-scrollbar border dark:border-gray-700">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t.inviteMember}</h3>
              <button onClick={() => setShowAdd(false)} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl text-gray-500 dark:text-gray-400 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-6">
              {isSuperAdmin && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t.selectAgency}</label>
                  <div className="relative">
                    <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    <select className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold appearance-none text-gray-900 dark:text-white cursor-pointer" value={targetAgencyId} onChange={(e) => setTargetAgencyId(e.target.value)} required>
                      {agencies.map(agency => (
                        <option key={agency.id} value={agency.id}>{agency.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t.emailAddress}</label>
                <div className="relative"><Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" /><input type="email" className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold text-gray-900 dark:text-white" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required /></div>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t.password}</label>
                <div className="relative"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" /><input type="text" className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold text-gray-900 dark:text-white" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="123456" required /></div>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t.pinCode}</label>
                <div className="relative"><KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" /><input type="text" maxLength={4} pattern="\d{4}" className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold text-gray-900 dark:text-white" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="0000" required /></div>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t.role}</label>
                <div className="relative"><Shield className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" /><select className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold appearance-none text-gray-900 dark:text-white cursor-pointer" value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>{allowedRoles.map(role => (<option key={role} value={role}>{role.replace('_', ' ')}</option>))}</select></div>
              </div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-900 dark:text-white">{t.cancel}</button><button type="submit" className="flex-1 py-5 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/30">{t.confirm}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edition Utilisateur (Rôle + Email) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300 border dark:border-gray-700">
            <div className="text-center space-y-3 mb-8">
                <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Edit3 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Modifier Profil</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">{editingUser.display_name}</p>
            </div>
            
            <form onSubmit={handleUpdateUserSubmit} className="space-y-6">
                
                {/* Modification Email */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        <input 
                            type="email" 
                            className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-4 focus:ring-primary-500/10 font-bold text-gray-900 dark:text-white" 
                            value={editEmail} 
                            onChange={(e) => setEditEmail(e.target.value)} 
                            required 
                        />
                    </div>
                </div>

                {/* Modification Rôle */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t.role}</label>
                    <div className="grid grid-cols-1 gap-2">
                        {allowedRoles.map(role => (
                            <button key={role} type="button" onClick={() => setEditRole(role)} className={`p-4 rounded-2xl text-left border-2 transition-all flex items-center justify-between font-bold text-sm ${editRole === role ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                {role.replace('_', ' ')}
                                {editRole === role && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-5 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-900 dark:text-white">{t.cancel}</button>
                    <button type="submit" disabled={actionLoading} className="flex-1 py-5 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/30 flex justify-center items-center gap-2">
                        {actionLoading && <Loader2 className="animate-spin w-4 h-4" />}
                        {t.confirm}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
