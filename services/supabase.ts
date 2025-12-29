
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
  private isConfigured() {
    return supabaseUrl && !supabaseUrl.includes('placeholder');
  }

  // --- LOGGING CENTRALISÉ ---
  private async log(user: {id: string, display_name: string, agency_id: string}, action: string, details: string) {
    if (!this.isConfigured()) return;
    try {
      await client.from('logs').insert({
        user_id: user.id, user_name: user.display_name, agency_id: user.agency_id,
        action, details, created_at: new Date().toISOString()
      });
    } catch (e) { console.error("Logging error:", e); }
  }

  // --- AUTHENTIFICATION ---
  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    if (!this.isConfigured()) return null;
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) return null;

    const { password: _, pin, ...safeUser } = data;
    this.log({ ...safeUser, agency_id: data.agency_id }, 'LOGIN', 'Connexion réussie');
    
    if (safeUser.role === UserRole.SUPER_ADMIN) {
      this.cleanupOldData(safeUser as UserProfile).catch(() => {});
    }
    return safeUser as UserProfile;
  }

  async signOut(user: UserProfile): Promise<void> {
    await this.log(user, 'LOGOUT', 'Déconnexion manuelle');
  }

  async verifyPin(userId: string, pinAttempt: string): Promise<boolean> {
    const { data } = await client.from('profiles').select('pin').eq('id', userId).single();
    return data?.pin === pinAttempt;
  }

  async updatePassword(userId: string, newPassword: string, actor: UserProfile): Promise<boolean> {
    const { error } = await client.from('profiles').update({ password: newPassword }).eq('id', userId);
    if (!error) this.log(actor, 'USER_PASSWORD_UPDATE', `Changement MDP pour ${userId}`);
    return !error;
  }

  // --- MAINTENANCE & RÉTENTION ---
  async cleanupOldData(actor: UserProfile): Promise<{ sales: number }> {
    const FIVE_MONTHS_AGO = new Date();
    FIVE_MONTHS_AGO.setMonth(FIVE_MONTHS_AGO.getMonth() - 5);
    const dateStr = FIVE_MONTHS_AGO.toISOString();

    const { data: agencies } = await client.from('agencies').select('*');
    if (!agencies) return { sales: 0 };

    let totalSales = 0;
    for (const agency of agencies) {
      const { data: oldSales } = await client.from('sales').select('amount').eq('agency_id', agency.id).lt('sold_at', dateStr);
      
      if (oldSales && oldSales.length > 0) {
        const sum = oldSales.reduce((acc, s) => acc + s.amount, 0);
        const count = oldSales.length;
        const currentSettings = agency.settings || {};
        
        await client.from('agencies').update({ 
          settings: {
            ...currentSettings,
            archived_revenue: (currentSettings.archived_revenue || 0) + sum,
            archived_sales_count: (currentSettings.archived_sales_count || 0) + count,
            last_cleanup_at: new Date().toISOString()
          }
        }).eq('id', agency.id);

        await client.from('sales').delete().eq('agency_id', agency.id).lt('sold_at', dateStr);
        totalSales += count;
      }
      await client.from('tickets').delete().eq('agency_id', agency.id).lt('created_at', dateStr).eq('status', TicketStatus.SOLD);
    }
    return { sales: totalSales };
  }

  // --- TICKETS & VENTES ---
  async sellTicket(ticketId: string, sellerId: string, agencyId: string, phone?: string): Promise<Sale | null> {
    // 1. Vérification de disponibilité avant tout
    const { data: ticket } = await client.from('tickets').select('*').eq('id', ticketId).eq('status', TicketStatus.UNSOLD).single();
    if (!ticket) return null;

    const now = new Date().toISOString();
    
    // 2. Transaction simplifiée (Update status + Insert sale)
    const { error: updateErr } = await client.from('tickets').update({ status: TicketStatus.SOLD, sold_by: sellerId, sold_at: now }).eq('id', ticketId);
    if (updateErr) return null;

    const { data: sale, error: saleErr } = await client.from('sales').insert({
      ticket_id: ticketId, agency_id: agencyId, seller_id: sellerId, amount: ticket.price,
      sold_at: now, payment_method: 'CASH', customer_phone: phone
    }).select().single();

    if (saleErr) {
      await client.from('tickets').update({ status: TicketStatus.UNSOLD, sold_by: null, sold_at: null }).eq('id', ticketId);
      return null;
    }

    this.log({id: sellerId, display_name: 'Vendeur', agency_id: agencyId}, 'SALE', `Vente: ${ticket.username}`);
    return sale as Sale;
  }

  async getStats(agencyId: string, role: UserRole) {
    const isSuper = role === UserRole.SUPER_ADMIN;
    const [sales, tickets, profiles, agencies] = await Promise.all([
      isSuper ? client.from('sales').select('amount') : client.from('sales').select('amount').eq('agency_id', agencyId),
      isSuper ? client.from('tickets').select('status') : client.from('tickets').select('status').eq('agency_id', agencyId),
      isSuper ? client.from('profiles').select('id') : client.from('profiles').select('id').eq('agency_id', agencyId),
      isSuper ? client.from('agencies').select('settings') : client.from('agencies').select('settings').eq('id', agencyId).single()
    ]);

    let archRev = 0, archCount = 0;
    if (isSuper) {
      (agencies.data as any[] || []).forEach(a => {
        archRev += (a.settings?.archived_revenue || 0);
        archCount += (a.settings?.archived_sales_count || 0);
      });
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

  // --- MÉTHODES GÉNÉRIQUES ---
  async getAgencies() { return (await client.from('agencies').select('*').order('name')).data as Agency[] || []; }
  async getAgency(id: string) { return (await client.from('agencies').select('*').eq('id', id).single()).data as Agency; }
  async deleteAgency(id: string) { await client.from('agencies').delete().eq('id', id); }
  async updateAgency(id: string, name: string, settings: any, status?: string) {
    const body: any = { name, settings };
    if (status) body.status = status;
    await client.from('agencies').update(body).eq('id', id);
  }
  async addAgency(name: string) {
    return (await client.from('agencies').insert({ 
      name, status: 'active', 
      settings: { currency: 'GNF', archived_revenue: 0, archived_sales_count: 0, modules: DEFAULT_MODULES } 
    }).select().single()).data as Agency;
  }
  async getUsers(agencyId: string, role: UserRole) {
    let q = client.from('profiles').select('*');
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', agencyId).neq('role', UserRole.SUPER_ADMIN);
    return (await q).data as UserProfile[] || [];
  }
  async addUser(u: any) {
    return (await client.from('profiles').insert({ ...u, display_name: u.email.split('@')[0] }).select().single()).data;
  }
  // --- FIX: Add missing updateUserRole method ---
  async updateUserRole(userId: string, role: UserRole) {
    await client.from('profiles').update({ role }).eq('id', userId);
  }
  async getLogs(agencyId: string, role: UserRole) {
    let q = client.from('logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', agencyId);
    return (await q).data as ActivityLog[] || [];
  }
  async getTickets(agencyId: string, role: UserRole) {
    let q = client.from('tickets').select('*');
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', agencyId);
    return (await q).data as Ticket[] || [];
  }
  async importTickets(ts: any[], uid: string, aid: string) {
    const { error } = await client.from('tickets').insert(ts.map(t => ({...t, agency_id: aid, created_by: uid, status: 'UNSOLD', created_at: new Date().toISOString()})));
    return { success: error ? 0 : ts.length, errors: error ? ts.length : 0 };
  }
  async updateTicketPrice(id: string, p: number) { await client.from('tickets').update({ price: p }).eq('id', id); }
  async updateProfilePrices(aid: string, prof: string, p: number) { 
    const { data } = await client.from('tickets').update({ price: p }).eq('agency_id', aid).eq('profile', prof).eq('status', 'UNSOLD').select();
    return data?.length || 0;
  }
  async deleteTicket(id: string) { await client.from('tickets').delete().eq('id', id); }
  async getSales(aid: string, role: UserRole) {
    let q = client.from('sales').select('*, profiles:seller_id(display_name), tickets:ticket_id(username, profile, time_limit)').order('sold_at', {ascending: false});
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return (data || []).map((s: any) => ({
      ...s, seller_name: s.profiles?.display_name, ticket_username: s.tickets?.username, ticket_profile: s.tickets?.profile, ticket_time_limit: s.tickets?.time_limit
    })) as Sale[];
  }
  async cancelSale(id: string) {
    const { data } = await client.from('sales').select('ticket_id').eq('id', id).single();
    if (data?.ticket_id) await client.from('tickets').update({ status: 'UNSOLD', sold_by: null, sold_at: null }).eq('id', data.ticket_id);
    await client.from('sales').delete().eq('id', id);
    return true;
  }
}

export const supabase = new SupabaseService();
