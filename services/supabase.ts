
import { createClient } from '@supabase/supabase-js';
import { UserRole, TicketStatus, UserProfile, Ticket, Sale, ActivityLog, Agency, AgencyModules, AgencySettings, AgencyStatus } from '../types';

// --- CONFIGURATION SÉCURISÉE ---
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const client = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

const DEFAULT_MODULES: AgencyModules = {
  dashboard: true,
  sales: true,
  history: true,
  tickets: true,
  team: true,
  tasks: true
};

class SupabaseService {
  
  // --- AUTHENTIFICATION ---
  
  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) return null;
    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (error || !data) return null;

      const { password: _, pin, ...safeUser } = data;
      this.log({ ...safeUser, agency_id: data.agency_id }, 'LOGIN', 'Connexion réussie');
      
      // Déclenchement automatique du nettoyage pour SuperAdmin
      if (safeUser.role === UserRole.SUPER_ADMIN) {
          this.cleanupOldData(safeUser as UserProfile).catch(console.error);
      }

      return safeUser as UserProfile;
    } catch (e) {
      return null;
    }
  }

  async signOut(user: UserProfile): Promise<void> {
    await this.log(user, 'LOGOUT', 'Déconnexion du système');
  }

  async verifyPin(userId: string, pinAttempt: string): Promise<boolean> {
    if (!supabaseUrl) return false;
    const { data } = await client.from('profiles').select('pin').eq('id', userId).single();
    return data?.pin === pinAttempt;
  }

  async updatePassword(userId: string, newPassword: string, actor: UserProfile): Promise<boolean> {
    if (!supabaseUrl) return false;
    const { error } = await client.from('profiles').update({ password: newPassword }).eq('id', userId);
    if (!error) this.log(actor, 'USER_PASSWORD_UPDATE', `Modification MDP pour utilisateur ID ${userId}`);
    return !error;
  }

  // --- RÉTENTION ET ARCHIVAGE ---

  async cleanupOldData(actor: UserProfile): Promise<{ sales: number, tickets: number }> {
    if (!supabaseUrl) return { sales: 0, tickets: 0 };
    
    const FIVE_MONTHS_AGO = new Date();
    FIVE_MONTHS_AGO.setMonth(FIVE_MONTHS_AGO.getMonth() - 5);
    const dateStr = FIVE_MONTHS_AGO.toISOString();

    let totalDeletedSales = 0;
    let totalDeletedTickets = 0;

    // 1. Récupération de toutes les agences pour traiter les statistiques d'archive
    const { data: agencies } = await client.from('agencies').select('*');
    if (!agencies) return { sales: 0, tickets: 0 };

    for (const agency of agencies) {
        // A. Calculer le montant des ventes à supprimer pour cette agence spécifique
        const { data: oldSales } = await client.from('sales')
            .select('amount')
            .eq('agency_id', agency.id)
            .lt('sold_at', dateStr);

        if (oldSales && oldSales.length > 0) {
            const sumToArchive = oldSales.reduce((acc, s) => acc + s.amount, 0);
            const countToArchive = oldSales.length;

            // B. Mettre à jour les totaux archivés dans les settings de l'agence
            const currentSettings = agency.settings || {};
            const updatedSettings: AgencySettings = {
                ...currentSettings,
                archived_revenue: (currentSettings.archived_revenue || 0) + sumToArchive,
                archived_sales_count: (currentSettings.archived_sales_count || 0) + countToArchive,
                last_cleanup_at: new Date().toISOString()
            };

            await client.from('agencies').update({ settings: updatedSettings }).eq('id', agency.id);

            // C. Supprimer les ventes
            const { error: delSalesErr } = await client.from('sales').delete().eq('agency_id', agency.id).lt('sold_at', dateStr);
            if (!delSalesErr) totalDeletedSales += countToArchive;
        }

        // D. Supprimer les tickets correspondants (Vendus ou Expirés) de plus de 5 mois
        const { error: delTicketsErr } = await client.from('tickets')
            .delete()
            .eq('agency_id', agency.id)
            .lt('created_at', dateStr);
            
        // Note: On supprime même les invendus de plus de 5 mois car ils sont considérés obsolètes techniquement
        if (!delTicketsErr) {
            // On ne peut pas facilement avoir le count ici sans select préalable, mais on log l'action
        }
    }

    if (totalDeletedSales > 0) {
        this.log(actor, 'DATA_CLEANUP', `Nettoyage automatique : ${totalDeletedSales} ventes archivées.`);
    }

    return { sales: totalDeletedSales, tickets: 0 };
  }

  // --- LOGGING ---

  private async log(user: {id: string, display_name: string, agency_id: string}, action: string, details: string) {
    if (!supabaseUrl) return;
    await client.from('logs').insert({
      user_id: user.id, user_name: user.display_name, agency_id: user.agency_id,
      action, details, created_at: new Date().toISOString()
    });
  }

  async getLogs(agencyId: string, role: UserRole): Promise<ActivityLog[]> {
    if (!supabaseUrl) return [];
    let query = client.from('logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (role !== UserRole.SUPER_ADMIN) query = query.eq('agency_id', agencyId);
    const { data } = await query;
    return (data as ActivityLog[]) || [];
  }

  // --- TICKETS ---

  async getTickets(agencyId: string, role: UserRole): Promise<Ticket[]> {
    if (!supabaseUrl) return [];
    let query = client.from('tickets').select('*');
    if (role !== UserRole.SUPER_ADMIN) query = query.eq('agency_id', agencyId);
    const { data } = await query;
    return (data as Ticket[]) || [];
  }

  async importTickets(tickets: Partial<Ticket>[], userId: string, agencyId: string): Promise<{ success: number; errors: number }> {
    if (!supabaseUrl) return { success: 0, errors: tickets.length };
    const validTickets = tickets.filter(t => t.username);
    const usernames = validTickets.map(t => t.username!);
    const BATCH_SIZE = 500;
    const existingSet = new Set<string>();

    for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
        const chunk = usernames.slice(i, i + BATCH_SIZE);
        const { data } = await client.from('tickets').select('username').in('username', chunk).eq('agency_id', agencyId);
        data?.forEach((t: any) => existingSet.add(t.username));
    }

    const toInsert = validTickets
      .filter(t => !existingSet.has(t.username!))
      .map(t => ({
            username: t.username, password: t.password || '', profile: t.profile || 'Default',
            time_limit: t.time_limit || '0', price: Math.min(Math.abs(t.price || 0), 99999999),
            expire_at: t.expire_at ? new Date(t.expire_at).toISOString() : null,
            status: TicketStatus.UNSOLD, agency_id: agencyId, created_by: userId,
            created_at: new Date().toISOString()
      }));

    let successCount = 0;
    if (toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
            const chunk = toInsert.slice(i, i + BATCH_SIZE);
            const { error } = await client.from('tickets').insert(chunk);
            if (!error) successCount += chunk.length;
        }
        if (successCount > 0) this.log({ id: userId, display_name: 'User', agency_id: agencyId }, 'TICKET_IMPORT', `Import de ${successCount} tickets`);
    }
    return { success: successCount, errors: validTickets.length - successCount };
  }

  async updateTicketPrice(ticketId: string, newPrice: number): Promise<boolean> {
    if (!supabaseUrl) return false;
    const { error } = await client.from('tickets').update({ price: Math.min(Math.abs(newPrice), 99999999) }).eq('id', ticketId);
    return !error;
  }
  
  async updateProfilePrices(agencyId: string, profile: string, newPrice: number): Promise<number> {
    if (!supabaseUrl) return 0;
    const { data, error } = await client.from('tickets').update({ price: Math.min(Math.abs(newPrice), 99999999) }).eq('agency_id', agencyId).eq('profile', profile).eq('status', TicketStatus.UNSOLD).select();
    return data?.length || 0;
  }

  async deleteTicket(ticketId: string): Promise<boolean> {
    if (!supabaseUrl) return false;
    const { error } = await client.from('tickets').delete().eq('id', ticketId);
    return !error;
  }

  // --- VENTES ---

  async sellTicket(ticketId: string, sellerId: string, agencyId: string, phone?: string): Promise<Sale | null> {
    if (!supabaseUrl) return null;
    const { data: ticket } = await client.from('tickets').select('*').eq('id', ticketId).eq('status', TicketStatus.UNSOLD).single();
    if (!ticket) return null;

    const now = new Date().toISOString();
    await client.from('tickets').update({ status: TicketStatus.SOLD, sold_by: sellerId, sold_at: now }).eq('id', ticketId);

    const { data: sale, error: saleError } = await client.from('sales').insert({
        ticket_id: ticketId, agency_id: agencyId, seller_id: sellerId, amount: ticket.price,
        sold_at: now, payment_method: 'CASH', customer_phone: phone
    }).select().single();

    if (saleError) return null;
    return sale as Sale;
  }

  async cancelSale(saleId: string): Promise<boolean> {
    if (!supabaseUrl) return false;
    const { data: sale } = await client.from('sales').select('*').eq('id', saleId).single();
    if (!sale) return false;
    if (sale.ticket_id) await client.from('tickets').update({ status: TicketStatus.UNSOLD, sold_by: null, sold_at: null }).eq('id', sale.ticket_id);
    await client.from('sales').delete().eq('id', saleId);
    return true;
  }

  async getSales(agencyId: string, role: UserRole): Promise<Sale[]> {
    if (!supabaseUrl) return [];
    let query = client.from('sales').select('*, profiles:seller_id(display_name), agencies:agency_id(name), tickets:ticket_id(username, profile, time_limit)').order('sold_at', { ascending: false });
    if (role !== UserRole.SUPER_ADMIN) query = query.eq('agency_id', agencyId);
    const { data } = await query;
    if (!data) return [];
    return data.map((s: any) => ({
        ...s,
        seller_name: s.profiles?.display_name || 'Inconnu',
        agency_name: s.agencies?.name || 'Inconnue',
        ticket_username: s.tickets?.username || 'Ticket Inconnu',
        ticket_profile: s.tickets?.profile || 'N/A',
        ticket_time_limit: s.tickets?.time_limit || 'N/A'
    })) as Sale[];
  }

  // --- STATS ---
  
  async getStats(agencyId: string, role: UserRole) {
    if (!supabaseUrl) return { revenue: 0, soldCount: 0, stockCount: 0, agencyCount: 0, userCount: 0, currency: 'GNF' };
    const isSuper = role === UserRole.SUPER_ADMIN;
    
    const [salesRes, ticketsRes, usersRes, agencyRes] = await Promise.all([
        isSuper ? client.from('sales').select('amount') : client.from('sales').select('amount').eq('agency_id', agencyId),
        isSuper ? client.from('tickets').select('status') : client.from('tickets').select('status').eq('agency_id', agencyId),
        isSuper ? client.from('profiles').select('id') : client.from('profiles').select('id').eq('agency_id', agencyId),
        isSuper ? client.from('agencies').select('id, settings') : client.from('agencies').select('settings').eq('id', agencyId).single()
    ]);

    const sales = salesRes.data || [];
    const tickets = ticketsRes.data || [];
    const users = usersRes.data || [];
    
    // Pour le SuperAdmin, on somme les archives de toutes les agences
    let archivedRev = 0;
    let archivedCount = 0;

    if (isSuper) {
        const agencies = (agencyRes.data as any[]) || [];
        agencies.forEach(a => {
            archivedRev += (a.settings?.archived_revenue || 0);
            archivedCount += (a.settings?.archived_sales_count || 0);
        });
    } else {
        const currentAgency = (agencyRes.data as any);
        archivedRev = currentAgency?.settings?.archived_revenue || 0;
        archivedCount = currentAgency?.settings?.archived_sales_count || 0;
    }

    const currentAgencyData = isSuper ? null : (agencyRes.data as any);

    return {
      revenue: sales.reduce((sum: number, s: any) => sum + s.amount, 0) + archivedRev,
      soldCount: sales.length + archivedCount,
      stockCount: tickets.filter((t: any) => t.status === TicketStatus.UNSOLD).length,
      agencyCount: isSuper ? (agencyRes.data as any[] || []).length : 1,
      userCount: users.length,
      currency: (isSuper ? 'GNF' : currentAgencyData?.settings?.currency) || 'GNF'
    };
  }

  // --- AGENCES & USERS ---

  async getAgencies(): Promise<Agency[]> {
    if (!supabaseUrl) return [];
    const { data } = await client.from('agencies').select('*').order('created_at');
    return (data as Agency[]) || [];
  }

  async getAgency(id: string): Promise<Agency | null> {
    if (!supabaseUrl) return null;
    const { data } = await client.from('agencies').select('*').eq('id', id).single();
    return data as Agency;
  }

  async addAgency(name: string): Promise<Agency> {
    const { data, error } = await client.from('agencies').insert({
      name, status: 'active',
      settings: { 
          currency: 'GNF', 
          whatsapp_receipt_header: `*REÇU ${name.toUpperCase()}*`, 
          modules: DEFAULT_MODULES,
          archived_revenue: 0,
          archived_sales_count: 0
      }
    }).select().single();
    if (error) throw error;
    return data as Agency;
  }

  async deleteAgency(id: string): Promise<void> {
    await client.from('agencies').delete().eq('id', id);
  }

  async updateAgency(id: string, name: string, settings: Partial<AgencySettings>, status?: AgencyStatus): Promise<void> {
    const updates: any = { name, settings };
    if (status) updates.status = status;
    await client.from('agencies').update(updates).eq('id', id);
  }

  async getUsers(agencyId: string, role: UserRole): Promise<UserProfile[]> {
    if (!supabaseUrl) return [];
    let query = client.from('profiles').select('*');
    if (role !== UserRole.SUPER_ADMIN) query = query.eq('agency_id', agencyId).neq('role', UserRole.SUPER_ADMIN);
    const { data } = await query;
    return (data?.map(({password, pin, ...u}) => u) as UserProfile[]) || [];
  }

  async addUser(user: Partial<UserProfile> & {password?: string, pin?: string}): Promise<UserProfile> {
    const newUser = {
      email: user.email, password: user.password || '123456', pin: user.pin || '0000',
      role: user.role || UserRole.SELLER, agency_id: user.agency_id, display_name: user.email?.split('@')[0] || 'User',
    };
    const { data, error } = await client.from('profiles').insert(newUser).select().single();
    if (error) throw error;
    const { password: _, pin, ...safeUser } = data;
    return safeUser as UserProfile;
  }

  async updateUserRole(userId: string, newRole: UserRole): Promise<boolean> {
    const { error } = await client.from('profiles').update({ role: newRole }).eq('id', userId);
    return !error;
  }
}

export const supabase = new SupabaseService();
