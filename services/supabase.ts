
import { createClient } from '@supabase/supabase-js';
import { UserRole, TicketStatus, UserProfile, Ticket, Sale, ActivityLog, Agency, AgencyModules, AgencySettings, AgencyStatus } from '../types';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const client = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

const DEFAULT_MODULES: AgencyModules = {
  dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true
};

class SupabaseService {
  public isConfigured() {
    return !!supabaseUrl && !supabaseUrl.includes('placeholder');
  }

  // --- LOGGING ---
  private async log(user: any, action: string, details: string) {
    if (!this.isConfigured()) return;
    try {
      await client.from('logs').insert({
        user_id: user.id, user_name: user.display_name || user.email, agency_id: user.agency_id,
        action, details, created_at: new Date().toISOString()
      });
    } catch (e) { console.error("Log error:", e); }
  }

  // --- AUTHENTIFICATION ---
  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    if (!this.isConfigured()) return null;
    const { data, error } = await client.from('profiles').select('*').eq('email', email).eq('password', password).single();
    if (error || !data) return null;
    const { password: _, pin, ...safeUser } = data;
    if (safeUser.role === UserRole.SUPER_ADMIN) this.cleanupOldData(safeUser as UserProfile).catch(console.error);
    this.log(safeUser, 'LOGIN', 'Connexion stable établie');
    return safeUser as UserProfile;
  }

  async signOut(u: UserProfile) { await this.log(u, 'LOGOUT', 'Déconnexion session'); }
  async verifyPin(uid: string, p: string) { return (await client.from('profiles').select('pin').eq('id', uid).single()).data?.pin === p; }

  // --- RÉTENTION DES DONNÉES (5 MOIS) ---
  async cleanupOldData(actor: UserProfile): Promise<{ sales: number }> {
    if (!this.isConfigured()) return { sales: 0 };
    const LIMIT_DATE = new Date();
    LIMIT_DATE.setMonth(LIMIT_DATE.getMonth() - 5);
    const dateStr = LIMIT_DATE.toISOString();

    const { data: agencies } = await client.from('agencies').select('*');
    if (!agencies) return { sales: 0 };

    let totalCleaned = 0;
    for (const agency of agencies) {
      const { data: oldSales } = await client.from('sales').select('amount').eq('agency_id', agency.id).lt('sold_at', dateStr);
      if (oldSales && oldSales.length > 0) {
        const sum = oldSales.reduce((acc, s) => acc + s.amount, 0);
        const count = oldSales.length;
        const s = agency.settings || {};
        await client.from('agencies').update({ 
          settings: { ...s, archived_revenue: (s.archived_revenue || 0) + sum, archived_sales_count: (s.archived_sales_count || 0) + count, last_cleanup_at: new Date().toISOString() }
        }).eq('id', agency.id);
        await client.from('sales').delete().eq('agency_id', agency.id).lt('sold_at', dateStr);
        totalCleaned += count;
      }
      await client.from('tickets').delete().eq('agency_id', agency.id).lt('created_at', dateStr).in('status', [TicketStatus.SOLD, TicketStatus.EXPIRED]);
    }
    if (totalCleaned > 0) this.log(actor, 'DATA_CLEANUP', `${totalCleaned} enregistrements archivés.`);
    return { sales: totalCleaned };
  }

  // --- STATISTIQUES ---
  async getStats(aid: string, role: UserRole) {
    if (!this.isConfigured()) return { revenue: 0, soldCount: 0, stockCount: 0, agencyCount: 0, userCount: 0, currency: 'GNF' };
    const isSuper = role === UserRole.SUPER_ADMIN;
    const [sales, tickets, profiles, agencies] = await Promise.all([
      isSuper ? client.from('sales').select('amount') : client.from('sales').select('amount').eq('agency_id', aid),
      isSuper ? client.from('tickets').select('status') : client.from('tickets').select('status').eq('agency_id', aid),
      isSuper ? client.from('profiles').select('id') : client.from('profiles').select('id').eq('agency_id', aid),
      isSuper ? client.from('agencies').select('settings, expires_at') : client.from('agencies').select('settings, expires_at').eq('id', aid).single()
    ]);

    let archRev = 0, archCount = 0;
    if (isSuper) {
      (agencies.data as any[] || []).forEach(a => { archRev += (a.settings?.archived_revenue || 0); archCount += (a.settings?.archived_sales_count || 0); });
    } else {
      archRev = (agencies.data as any)?.settings?.archived_revenue || 0;
      archCount = (agencies.data as any)?.settings?.archived_sales_count || 0;
    }

    return {
      revenue: (sales.data || []).reduce((acc, s) => acc + s.amount, 0) + archRev,
      soldCount: (sales.data || []).length + archCount,
      stockCount: (tickets.data || []).filter(t => t.status === TicketStatus.UNSOLD).length,
      userCount: (profiles.data || []).length,
      agencyCount: isSuper ? (agencies.data as any[] || []).length : 1,
      currency: (isSuper ? 'GNF' : (agencies.data as any)?.settings?.currency) || 'GNF'
    };
  }

  // --- GESTION TICKETS ---
  async getTickets(aid: string, role: UserRole) {
    let q = client.from('tickets').select('*').order('created_at', { ascending: false });
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    return (await q).data as Ticket[] || [];
  }

  async importTickets(ts: any[], uid: string, aid: string) {
    if (!this.isConfigured()) return { success: 0, errors: ts.length, skipped: 0 };
    const validTickets = ts.filter(t => t.username && String(t.username).trim().length > 0);
    if (validTickets.length === 0) return { success: 0, errors: 0, skipped: 0 };
    const { data: existing } = await client.from('tickets').select('username').eq('agency_id', aid);
    const existingSet = new Set(existing?.map(e => e.username) || []);
    const toInsert = validTickets.filter(t => !existingSet.has(String(t.username).trim())).map(t => ({
      username: String(t.username).trim(),
      password: String(t.password || t.username).trim(),
      profile: String(t.profile || 'Default').trim(),
      time_limit: String(t.time_limit || 'N/A').trim(),
      price: Math.max(0, parseInt(String(t.price)) || 0),
      status: TicketStatus.UNSOLD,
      agency_id: aid,
      created_by: uid,
      created_at: new Date().toISOString()
    }));
    const skipped = validTickets.length - toInsert.length;
    if (toInsert.length > 0) {
      const { error } = await client.from('tickets').insert(toInsert);
      if (!error) this.log({id: uid, agency_id: aid}, 'TICKET_IMPORT', `Importation: ${toInsert.length} tickets.`);
    }
    return { success: toInsert.length, errors: 0, skipped };
  }

  async updateProfilePrices(aid: string, prof: string, price: number) {
    const { data } = await client.from('tickets').update({ price }).eq('agency_id', aid).eq('profile', prof).eq('status', TicketStatus.UNSOLD).select();
    return data?.length || 0;
  }

  async sellTicket(tid: string, sid: string, aid: string, phone?: string) {
    const { data: tk } = await client.from('tickets').select('*').eq('id', tid).eq('status', TicketStatus.UNSOLD).single();
    if (!tk) return null;
    const now = new Date().toISOString();
    await client.from('tickets').update({ status: TicketStatus.SOLD, sold_by: sid, sold_at: now }).eq('id', tid);
    const { data: s } = await client.from('sales').insert({ ticket_id: tid, agency_id: aid, seller_id: sid, amount: tk.price, sold_at: now, customer_phone: phone }).select().single();
    return s as Sale;
  }

  // --- AGENCES ---
  async getAgencies() { return (await client.from('agencies').select('*').order('name')).data as Agency[] || []; }
  async getAgency(id: string) { return (await client.from('agencies').select('*').eq('id', id).single()).data as Agency; }
  async updateAgency(id: string, name: string, settings: any, status?: string) {
    const b: any = { name, settings }; if (status) b.status = status;
    await client.from('agencies').update(b).eq('id', id);
  }
  async addAgency(name: string) { 
    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 3); // 3 jours d'essai par défaut
    return (await client.from('agencies').insert({ 
      name, 
      status: 'active', 
      activated_at: now.toISOString(),
      expires_at: expiry.toISOString(),
      settings: { currency: 'GNF', archived_revenue: 0, archived_sales_count: 0, modules: DEFAULT_MODULES } 
    }).select().single()).data as Agency; 
  }
  async deleteAgency(id: string) { await client.from('agencies').delete().eq('id', id); }

  async setAgencyStatus(id: string, status: AgencyStatus, actor: UserProfile) {
    if (actor.role !== UserRole.SUPER_ADMIN) return;
    await client.from('agencies').update({ status }).eq('id', id);
    this.log(actor, 'AGENCY_STATUS_CHANGE', `Statut de l'agence ID ${id} passé à ${status}`);
  }

  async updateSubscription(id: string, days: number, modules: AgencyModules, actor: UserProfile) {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Permission refusée (Super-Admin requis)");
    
    const { data: agency, error: fetchError } = await client.from('agencies').select('*').eq('id', id).single();
    if (fetchError || !agency) throw new Error("Agence non trouvée en base de données");

    const now = new Date();
    let currentExpiry = agency.expires_at ? new Date(agency.expires_at) : now;
    if (isNaN(currentExpiry.getTime())) currentExpiry = now;

    // Calcul de la nouvelle date d'expiration
    // Si jours > 0, on cumule ou on repart de maintenant si déjà expiré
    let startDate = agency.activated_at ? new Date(agency.activated_at) : now;
    let newExpiry = new Date(currentExpiry);
    
    if (days > 0) {
        const baseDate = currentExpiry > now ? currentExpiry : now;
        startDate = baseDate;
        newExpiry = new Date(baseDate);
        newExpiry.setDate(newExpiry.getDate() + days);
    }
    
    const newSettings = {
      ...(agency.settings || {}),
      modules: modules
    };

    const { error: updateError } = await client.from('agencies').update({ 
      activated_at: startDate.toISOString(),
      expires_at: newExpiry.toISOString(),
      settings: newSettings,
      status: 'active'
    }).eq('id', id);

    if (updateError) throw new Error(`Erreur Supabase: ${updateError.message}`);

    this.log(actor, 'SUBSCRIPTION_UPDATE', `Mise à jour pour ${agency.name}: +${days}j, modules: ${Object.keys(modules).filter(k => (modules as any)[k]).join(', ')}`);
    return newExpiry.toISOString();
  }

  // --- UTILISATEURS ---
  async getUsers(aid: string, role: UserRole) {
    let q = client.from('profiles').select('*');
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid).neq('role', UserRole.SUPER_ADMIN);
    return (await q).data as UserProfile[] || [];
  }
  async addUser(u: any) { return (await client.from('profiles').insert({ ...u, display_name: u.email.split('@')[0] }).select().single()).data; }
  async updateUserRole(uid: string, r: UserRole) { await client.from('profiles').update({ role: r }).eq('id', uid); }
  async updatePassword(uid: string, p: string, actor: UserProfile) { await client.from('profiles').update({ password: p }).eq('id', uid); return true; }
  async getLogs(aid: string, role: UserRole) {
    let q = client.from('logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    return (await q).data as ActivityLog[] || [];
  }
  async updateTicketPrice(id: string, p: number) { await client.from('tickets').update({ price: p }).eq('id', id); }
  async deleteTicket(id: string) { await client.from('tickets').delete().eq('id', id); }
  async getSales(aid: string, role: UserRole) {
    let q = client.from('sales').select('*, profiles:seller_id(display_name), tickets:ticket_id(username, profile, time_limit)').order('sold_at', {ascending: false});
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return (data || []).map((s: any) => ({ ...s, seller_name: s.profiles?.display_name, ticket_username: s.tickets?.username, ticket_profile: s.tickets?.profile, ticket_time_limit: s.tickets?.time_limit })) as Sale[];
  }
  async cancelSale(id: string) {
    const { data } = await client.from('sales').select('ticket_id').eq('id', id).single();
    if (data?.ticket_id) await client.from('tickets').update({ status: TicketStatus.UNSOLD, sold_by: null, sold_at: null }).eq('id', data.ticket_id);
    await client.from('sales').delete().eq('id', id);
    return true;
  }
}

export const supabase = new SupabaseService();
