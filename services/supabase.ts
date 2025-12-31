
import { createClient } from '@supabase/supabase-js';
import { UserRole, TicketStatus, UserProfile, Ticket, Sale, ActivityLog, Agency, AgencyModules, AgencySettings, AgencyStatus, CreditTransaction } from '../types';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const client = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

const DEFAULT_MODULES: AgencyModules = {
  dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true
};

const TICKET_CREDIT_RATIO = 20; 
const FREE_TICKET_LIMIT = 50;   

class SupabaseService {
  public isConfigured() {
    return !!supabaseUrl && !supabaseUrl.includes('placeholder');
  }

  private async log(user: any, action: string, details: string) {
    if (!this.isConfigured()) return;
    try {
      await client.from('logs').insert({
        user_id: user.id, 
        user_name: user.display_name || user.email, 
        agency_id: user.agency_id,
        action, 
        details, 
        created_at: new Date().toISOString()
      });
    } catch (e) { console.error("Audit Log error:", e); }
  }

  // --- LOGIQUE ABONNEMENT ---

  public isSubscriptionActive(agency: Agency): boolean {
    if (!agency.subscription_end) return false;
    const end = new Date(agency.subscription_end).getTime();
    const now = new Date().getTime();
    return end > now;
  }

  async updateSubscription(aid: string, plan: string, months: number, actor: UserProfile) {
    if (actor.role !== UserRole.SUPER_ADMIN) return;
    
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + months);

    await client.from('agencies').update({
      plan_name: plan,
      subscription_start: start.toISOString(),
      subscription_end: end.toISOString(),
      status: 'active'
    }).eq('id', aid);

    this.log(actor, 'AGENCY_SUBSCRIPTION', `Plan ${plan} activé pour ${months} mois sur l'agence ${aid}`);
  }

  // --- GESTION DES CRÉDITS ---

  async getCreditHistory(aid: string): Promise<CreditTransaction[]> {
    const { data } = await client.from('credit_transactions').select('*').eq('agency_id', aid).order('created_at', { ascending: false });
    return data || [];
  }

  async addCredits(aid: string, amount: number, adminUid: string, description: string) {
    const { data: agency } = await client.from('agencies').select('credits_balance').eq('id', aid).single();
    const newBalance = (agency?.credits_balance || 0) + amount;
    await client.from('agencies').update({ credits_balance: newBalance }).eq('id', aid);
    await client.from('credit_transactions').insert({
      agency_id: aid, amount, type: 'RECHARGE', description, created_by: adminUid, created_at: new Date().toISOString()
    });
    this.log({id: adminUid, agency_id: aid}, 'CREDIT_RECHARGE', `Recharge de ${amount} crédits.`);
  }

  private calculateCreditCost(ticketCount: number, totalTicketsEver: number): number {
    let cost = 0;
    let billableTickets = ticketCount;
    if (totalTicketsEver < FREE_TICKET_LIMIT) {
      const remainingFree = FREE_TICKET_LIMIT - totalTicketsEver;
      billableTickets = Math.max(0, ticketCount - remainingFree);
    }
    if (billableTickets > 0) cost = Math.ceil(billableTickets / TICKET_CREDIT_RATIO);
    return cost;
  }

  // --- AUTHENTIFICATION ---
  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    if (!this.isConfigured()) return null;
    const { data, error } = await client.from('profiles').select('*').eq('email', email).eq('password', password).single();
    if (error || !data) return null;
    const { password: _, pin, ...safeUser } = data;
    if (safeUser.role === UserRole.SUPER_ADMIN) this.cleanupOldData(safeUser as UserProfile).catch(console.error);
    this.log(safeUser, 'LOGIN', 'Connexion réussie');
    return safeUser as UserProfile;
  }

  async signOut(u: UserProfile) { 
    await this.log(u, 'LOGOUT', 'Déconnexion manuelle'); 
  }

  async verifyPin(uid: string, p: string) { 
    if (!this.isConfigured()) return false;
    const { data } = await client.from('profiles').select('pin').eq('id', uid).single();
    return data?.pin === p; 
  }

  // --- RÉTENTION DES DONNÉES ---
  async cleanupOldData(actor: UserProfile): Promise<{ sales: number }> {
    if (!this.isConfigured()) return { sales: 0 };
    const LIMIT_DATE = new Date();
    LIMIT_DATE.setMonth(LIMIT_DATE.getMonth() - 5);
    const dateStr = LIMIT_DATE.toISOString();
    const { data: agencies } = await client.from('agencies').select('id, settings');
    if (!agencies) return { sales: 0 };
    let totalCleaned = 0;
    for (const agency of agencies) {
      const { data: oldSales } = await client.from('sales').select('amount').eq('agency_id', agency.id).lt('sold_at', dateStr);
      if (oldSales && oldSales.length > 0) {
        const sum = oldSales.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
        const count = oldSales.length;
        const currentSettings = agency.settings || {};
        await client.from('agencies').update({ 
          settings: { ...currentSettings, archived_revenue: (Number(currentSettings.archived_revenue) || 0) + sum, archived_sales_count: (Number(currentSettings.archived_sales_count) || 0) + count, last_cleanup_at: new Date().toISOString() }
        }).eq('id', agency.id);
        await client.from('sales').delete().eq('agency_id', agency.id).lt('sold_at', dateStr);
        totalCleaned += count;
      }
      await client.from('tickets').delete().eq('agency_id', agency.id).lt('created_at', dateStr).in('status', [TicketStatus.SOLD, TicketStatus.EXPIRED]);
    }
    return { sales: totalCleaned };
  }

  // --- STATISTIQUES ---
  async getStats(aid: string, role: UserRole) {
    if (!this.isConfigured()) return { revenue: 0, soldCount: 0, stockCount: 0, agencyCount: 0, userCount: 0, currency: 'GNF', credits: 0 };
    const isSuper = role === UserRole.SUPER_ADMIN;
    const [sales, tickets, profiles, agencies] = await Promise.all([
      isSuper ? client.from('sales').select('amount') : client.from('sales').select('amount').eq('agency_id', aid),
      isSuper ? client.from('tickets').select('status') : client.from('tickets').select('status').eq('agency_id', aid),
      isSuper ? client.from('profiles').select('id') : client.from('profiles').select('id').eq('agency_id', aid),
      isSuper ? client.from('agencies').select('*') : client.from('agencies').select('*').eq('id', aid).single()
    ]);
    let archRev = 0, archCount = 0, totalCredits = 0;
    if (isSuper) {
      (agencies.data as any[] || []).forEach(a => { 
        archRev += (Number(a.settings?.archived_revenue) || 0); archCount += (Number(a.settings?.archived_sales_count) || 0); totalCredits += (Number(a.credits_balance) || 0);
      });
    } else {
      archRev = Number((agencies.data as any)?.settings?.archived_revenue) || 0; archCount = Number((agencies.data as any)?.settings?.archived_sales_count) || 0; totalCredits = Number((agencies.data as any)?.credits_balance) || 0;
    }
    return { revenue: (sales.data || []).reduce((acc, s) => acc + (Number(s.amount) || 0), 0) + archRev, soldCount: (sales.data || []).length + archCount, stockCount: (tickets.data || []).filter(t => t.status === TicketStatus.UNSOLD).length, userCount: (profiles.data || []).length, agencyCount: isSuper ? (agencies.data as any[] || []).length : 1, currency: (isSuper ? 'GNF' : (agencies.data as any)?.settings?.currency) || 'GNF', credits: totalCredits };
  }

  // --- GESTION TICKETS ---
  async getTickets(aid: string, role: UserRole) {
    let q = client.from('tickets').select('*').order('created_at', { ascending: false });
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return data as Ticket[] || [];
  }

  async importTickets(ts: any[], uid: string, aid: string) {
    if (!this.isConfigured()) return { success: 0, errors: ts.length, skipped: 0, error: 'Non configuré' };
    const { data: agency } = await client.from('agencies').select('*').eq('id', aid).single();
    if (!agency) return { success: 0, errors: 0, skipped: 0, error: 'Agence introuvable' };

    // SÉCURITÉ ABONNEMENT
    if (!this.isSubscriptionActive(agency as Agency)) {
        return { success: 0, errors: 0, skipped: 0, error: 'Abonnement expiré. Veuillez contacter un Super-Admin.' };
    }

    const validTickets = ts.filter(t => t.username && String(t.username).trim().length > 0);
    const { data: existing } = await client.from('tickets').select('username').eq('agency_id', aid);
    const existingSet = new Set(existing?.map(e => e.username) || []);
    const toInsertRaw = validTickets.filter(t => !existingSet.has(String(t.username).trim()));
    const skipped = validTickets.length - toInsertRaw.length;
    if (toInsertRaw.length === 0) return { success: 0, errors: 0, skipped };
    const totalEver = agency.settings?.total_tickets_ever || 0;
    const creditCost = this.calculateCreditCost(toInsertRaw.length, totalEver);
    if (agency.credits_balance < creditCost && agency.status !== 'inactive') return { success: 0, errors: 0, skipped, error: `Crédits insuffisants. Coût: ${creditCost} crédits.` };
    const toInsert = toInsertRaw.map(t => ({
      username: String(t.username).trim(), password: String(t.password || t.username).trim(), profile: String(t.profile || 'Default').trim(), time_limit: String(t.time_limit || 'N/A').trim(), price: Math.max(0, parseInt(String(t.price)) || 0), status: TicketStatus.UNSOLD, agency_id: aid, created_by: uid, created_at: new Date().toISOString()
    }));
    const { error: insertError } = await client.from('tickets').insert(toInsert);
    if (insertError) return { success: 0, errors: toInsert.length, skipped, error: insertError.message };
    if (creditCost > 0) {
      await client.from('agencies').update({ credits_balance: agency.credits_balance - creditCost, settings: { ...(agency.settings || {}), total_tickets_ever: totalEver + toInsert.length } }).eq('id', aid);
      await client.from('credit_transactions').insert({ agency_id: aid, amount: -creditCost, type: 'CONSUMPTION', description: `Import de ${toInsert.length} tickets`, created_by: uid, created_at: new Date().toISOString() });
    } else {
      await client.from('agencies').update({ settings: { ...(agency.settings || {}), total_tickets_ever: totalEver + toInsert.length } }).eq('id', aid);
    }
    this.log({id: uid, agency_id: aid}, 'TICKET_IMPORT', `Import de ${toInsert.length} tickets.`);
    return { success: toInsert.length, errors: 0, skipped, cost: creditCost };
  }

  async sellTicket(tid: string, sid: string, aid: string, phone?: string) {
    const { data: agency } = await client.from('agencies').select('*').eq('id', aid).single();
    
    // SÉCURITÉ ABONNEMENT
    if (!this.isSubscriptionActive(agency as Agency)) {
        throw new Error("Abonnement expiré.");
    }

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
  
  async updateAgencyModules(id: string, modules: AgencyModules, actor: UserProfile) {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Super-Admin requis.");
    const { data: agency } = await client.from('agencies').select('*').eq('id', id).single();
    if (!agency) throw new Error("Agence introuvable.");
    const updatedSettings = { ...(agency.settings || {}), modules };
    const { error } = await client.from('agencies').update({ settings: updatedSettings }).eq('id', id);
    if (error) throw error;
    this.log(actor, 'AGENCY_MODULES', `Modules mis à jour pour ${agency.name}`);
  }

  async updateAgency(id: string, name: string, settings: any, status?: AgencyStatus) {
    const body: any = { name, settings };
    if (status) body.status = status;
    const { error } = await client.from('agencies').update(body).eq('id', id);
    if (error) throw error;
  }

  async addAgency(name: string) { 
    return (await client.from('agencies').insert({ 
      name, 
      status: 'active', 
      credits_balance: 10,
      plan_name: 'Trial',
      subscription_start: new Date().toISOString(),
      subscription_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 jours d'essai
      settings: { 
        currency: 'GNF', 
        archived_revenue: 0, 
        archived_sales_count: 0, 
        modules: DEFAULT_MODULES,
        total_tickets_ever: 0
      } 
    }).select().single()).data as Agency; 
  }

  async deleteAgency(id: string) { await client.from('agencies').delete().eq('id', id); }

  async setAgencyStatus(id: string, status: AgencyStatus, actor: UserProfile) {
    if (actor.role !== UserRole.SUPER_ADMIN) return;
    await client.from('agencies').update({ status }).eq('id', id);
    this.log(actor, 'AGENCY_STATUS', `Agence ${id} passée en ${status}`);
  }

  // --- UTILISATEURS ---
  async getUsers(aid: string, role: UserRole) {
    let q = client.from('profiles').select('*');
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid).neq('role', UserRole.SUPER_ADMIN);
    const { data } = await q;
    return data as UserProfile[] || [];
  }

  async addUser(u: any) { return (await client.from('profiles').insert({ ...u, display_name: u.email.split('@')[0] }).select().single()).data; }
  async updateUserRole(uid: string, r: UserRole) { await client.from('profiles').update({ role: r }).eq('id', uid); }
  async updatePassword(uid: string, p: string, actor: UserProfile) { await client.from('profiles').update({ password: p }).eq('id', uid); this.log(actor, 'PASSWORD_CHANGE', `MDP mis à jour pour utilisateur ${uid}`); return true; }

  async getLogs(aid: string, role: UserRole) {
    let q = client.from('logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return data as ActivityLog[] || [];
  }

  async updateTicketPrice(id: string, p: number) { await client.from('tickets').update({ price: p }).eq('id', id); }
  async updateProfilePrices(aid: string, prof: string, price: number) {
    const { data } = await client.from('tickets').update({ price }).eq('agency_id', aid).eq('profile', prof).eq('status', TicketStatus.UNSOLD).select();
    return data?.length || 0;
  }
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
