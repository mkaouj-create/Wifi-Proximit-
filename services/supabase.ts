
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  UserRole, 
  TicketStatus, 
  UserProfile, 
  Ticket, 
  Sale, 
  ActivityLog, 
  Agency, 
  AgencyModules, 
  AgencyStatus, 
  CreditTransaction,
  AgencySettings 
} from '../types';

// Safely retrieve environment variables checking both Vite and generic process.env sources
const getEnvVar = (name: string): string => {
  try {
    return (import.meta as any).env?.[name] || (process as any).env?.[name] || '';
  } catch (e) {
    return '';
  }
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// Initialisation du client unique (Singleton)
const client: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

const DEFAULT_MODULES: AgencyModules = {
  dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true
};

const TICKET_CREDIT_RATIO = 20; 
const FREE_TICKET_LIMIT = 50;   

class SupabaseService {
  /**
   * Vérifie si les identifiants Supabase sont présents.
   * Crucial pour le fonctionnement en mode dégradé ou mobile.
   */
  public isConfigured(): boolean {
    return !!supabaseUrl && !supabaseUrl.includes('placeholder');
  }

  /**
   * Enregistre une action dans le journal d'audit.
   */
  private async log(user: Partial<UserProfile>, action: string, details: string): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      await client.from('logs').insert({
        user_id: user.id, 
        user_name: user.display_name || user.email || 'Système', 
        agency_id: user.agency_id,
        action, 
        details, 
        created_at: new Date().toISOString()
      });
    } catch (e) { 
      console.error("Audit Log error:", e); 
    }
  }

  // --- LOGIQUE ABONNEMENT ---

  public isSubscriptionActive(agency: Agency): boolean {
    if (!agency || !agency.subscription_end) return false;
    const end = new Date(agency.subscription_end).getTime();
    const now = Date.now();
    return end > now;
  }

  async updateSubscription(aid: string, plan: string, months: number, actor: UserProfile): Promise<void> {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Accès refusé");
    
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + months);

    const { error } = await client.from('agencies').update({
      plan_name: plan,
      subscription_start: start.toISOString(),
      subscription_end: end.toISOString(),
      status: 'active'
    }).eq('id', aid);

    if (error) throw error;

    await this.log(actor, 'AGENCY_SUBSCRIPTION', `Plan ${plan} activé (${months} mois) pour l'agence ${aid}`);
  }

  // --- GESTION DES CRÉDITS ---

  async getCreditHistory(aid: string): Promise<CreditTransaction[]> {
    const { data, error } = await client.from('credit_transactions')
      .select('*')
      .eq('agency_id', aid)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data as CreditTransaction[]) || [];
  }

  async addCredits(aid: string, amount: number, adminUid: string, description: string): Promise<void> {
    // 1. Récupération sécurisée du solde actuel
    const { data: agency, error: fetchError } = await client.from('agencies')
      .select('credits_balance')
      .eq('id', aid)
      .single();
    
    if (fetchError) throw fetchError;

    const newBalance = (agency?.credits_balance || 0) + amount;
    
    // 2. Mise à jour atomique simulée
    const { error: updateError } = await client.from('agencies')
      .update({ credits_balance: newBalance })
      .eq('id', aid);
    
    if (updateError) throw updateError;

    // 3. Journalisation de la transaction
    await client.from('credit_transactions').insert({
      agency_id: aid, 
      amount, 
      type: 'RECHARGE', 
      description, 
      created_by: adminUid, 
      created_at: new Date().toISOString()
    });

    await this.log({ id: adminUid, agency_id: aid }, 'CREDIT_RECHARGE', `Recharge de ${amount} crédits.`);
  }

  private calculateCreditCost(ticketCount: number, totalTicketsEver: number): number {
    let billableTickets = ticketCount;
    if (totalTicketsEver < FREE_TICKET_LIMIT) {
      const remainingFree = FREE_TICKET_LIMIT - totalTicketsEver;
      billableTickets = Math.max(0, ticketCount - remainingFree);
    }
    return billableTickets > 0 ? Math.ceil(billableTickets / TICKET_CREDIT_RATIO) : 0;
  }

  // --- AUTHENTIFICATION ---

  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    if (!this.isConfigured()) return null;
    
    const { data, error } = await client.from('profiles')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) return null;

    const user = data as UserProfile;
    if (user.role === UserRole.SUPER_ADMIN) {
      this.cleanupOldData(user).catch(console.error);
    }

    await this.log(user, 'LOGIN', 'Connexion réussie');
    return user;
  }

  async signOut(user: UserProfile): Promise<void> { 
    await this.log(user, 'LOGOUT', 'Déconnexion manuelle'); 
  }

  async verifyPin(uid: string, pin: string): Promise<boolean> { 
    if (!this.isConfigured()) return false;
    const { data } = await client.from('profiles').select('pin').eq('id', uid).single();
    return data?.pin === pin; 
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
      const { data: oldSales } = await client.from('sales')
        .select('amount')
        .eq('agency_id', agency.id)
        .lt('sold_at', dateStr);

      if (oldSales && oldSales.length > 0) {
        const sum = oldSales.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
        const count = oldSales.length;
        const currentSettings = agency.settings || {};

        await client.from('agencies').update({ 
          settings: { 
            ...currentSettings, 
            archived_revenue: (Number(currentSettings.archived_revenue) || 0) + sum, 
            archived_sales_count: (Number(currentSettings.archived_sales_count) || 0) + count, 
            last_cleanup_at: new Date().toISOString() 
          }
        }).eq('id', agency.id);

        await client.from('sales').delete().eq('agency_id', agency.id).lt('sold_at', dateStr);
        totalCleaned += count;
      }
      
      await client.from('tickets')
        .delete()
        .eq('agency_id', agency.id)
        .lt('created_at', dateStr)
        .in('status', [TicketStatus.SOLD, TicketStatus.EXPIRED]);
    }
    return { sales: totalCleaned };
  }

  // --- STATISTIQUES ---

  async getStats(aid: string, role: UserRole) {
    if (!this.isConfigured()) return { revenue: 0, soldCount: 0, stockCount: 0, agencyCount: 0, userCount: 0, currency: 'GNF', credits: 0 };
    
    const isSuper = role === UserRole.SUPER_ADMIN;
    
    // Requêtes en parallèle pour optimisation mobile (latence)
    const [salesRes, ticketsRes, profilesRes, agenciesRes] = await Promise.all([
      isSuper ? client.from('sales').select('amount') : client.from('sales').select('amount').eq('agency_id', aid),
      isSuper ? client.from('tickets').select('status') : client.from('tickets').select('status').eq('agency_id', aid),
      isSuper ? client.from('profiles').select('id') : client.from('profiles').select('id').eq('agency_id', aid),
      isSuper ? client.from('agencies').select('*') : client.from('agencies').select('*').eq('id', aid).single()
    ]);

    let archRev = 0, archCount = 0, totalCredits = 0;
    
    if (isSuper) {
      const agencies = (agenciesRes.data as Agency[]) || [];
      agencies.forEach(a => { 
        archRev += (Number(a.settings?.archived_revenue) || 0); 
        archCount += (Number(a.settings?.archived_sales_count) || 0); 
        totalCredits += (Number(a.credits_balance) || 0);
      });
    } else {
      const agency = agenciesRes.data as Agency;
      archRev = Number(agency?.settings?.archived_revenue) || 0;
      archCount = Number(agency?.settings?.archived_sales_count) || 0;
      totalCredits = Number(agency?.credits_balance) || 0;
    }

    return {
      revenue: (salesRes.data?.reduce((acc, s) => acc + (Number(s.amount) || 0), 0) || 0) + archRev,
      soldCount: (salesRes.data?.length || 0) + archCount,
      stockCount: (ticketsRes.data?.filter(t => t.status === TicketStatus.UNSOLD).length || 0),
      userCount: (profilesRes.data?.length || 0),
      agencyCount: isSuper ? (agenciesRes.data?.length || 0) : 1,
      currency: (isSuper ? 'GNF' : (agenciesRes.data as Agency)?.settings?.currency) || 'GNF',
      credits: totalCredits
    };
  }

  // --- GESTION TICKETS ---

  async getTickets(aid: string, role: UserRole): Promise<Ticket[]> {
    let q = client.from('tickets').select('*').order('created_at', { ascending: false });
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data, error } = await q;
    if (error) throw error;
    return (data as Ticket[]) || [];
  }

  async importTickets(ts: any[], uid: string, aid: string) {
    if (!this.isConfigured()) throw new Error('Supabase non configuré');
    
    const { data: agencyData, error: agencyError } = await client.from('agencies').select('*').eq('id', aid).single();
    if (agencyError || !agencyData) throw new Error('Agence introuvable');
    
    const agency = agencyData as Agency;

    if (!this.isSubscriptionActive(agency)) {
        throw new Error('Abonnement expiré. Veuillez contacter un Super-Admin.');
    }

    const validTickets = ts.filter(t => t.username && String(t.username).trim().length > 0);
    const { data: existing } = await client.from('tickets').select('username').eq('agency_id', aid);
    const existingSet = new Set(existing?.map(e => e.username) || []);
    
    const toInsertRaw = validTickets.filter(t => !existingSet.has(String(t.username).trim()));
    const skipped = validTickets.length - toInsertRaw.length;
    
    if (toInsertRaw.length === 0) return { success: 0, errors: 0, skipped };

    const totalEver = agency.settings?.total_tickets_ever || 0;
    const creditCost = this.calculateCreditCost(toInsertRaw.length, totalEver);

    if (agency.credits_balance < creditCost && agency.status !== 'inactive') {
      throw new Error(`Crédits insuffisants. Coût requis: ${creditCost} crédits.`);
    }

    const toInsert = toInsertRaw.map(t => ({
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

    const { error: insertError } = await client.from('tickets').insert(toInsert);
    if (insertError) throw insertError;

    // Mise à jour du solde et du compteur
    await client.from('agencies').update({ 
      credits_balance: agency.credits_balance - creditCost, 
      settings: { 
        ...(agency.settings || {}), 
        total_tickets_ever: totalEver + toInsert.length 
      } 
    }).eq('id', aid);

    if (creditCost > 0) {
      await client.from('credit_transactions').insert({ 
        agency_id: aid, 
        amount: -creditCost, 
        type: 'CONSUMPTION', 
        description: `Import de ${toInsert.length} tickets`, 
        created_by: uid, 
        created_at: new Date().toISOString() 
      });
    }

    await this.log({ id: uid, agency_id: aid }, 'TICKET_IMPORT', `Import de ${toInsert.length} tickets.`);
    return { success: toInsert.length, errors: 0, skipped, cost: creditCost };
  }

  async sellTicket(tid: string, sid: string, aid: string, phone?: string): Promise<Sale | null> {
    const { data: agencyData } = await client.from('agencies').select('*').eq('id', aid).single();
    if (!this.isSubscriptionActive(agencyData as Agency)) throw new Error("Abonnement expiré.");

    const { data: tk, error: tkError } = await client.from('tickets')
      .select('*')
      .eq('id', tid)
      .eq('status', TicketStatus.UNSOLD)
      .single();
    
    if (tkError || !tk) return null;

    const now = new Date().toISOString();
    
    // Mise à jour du ticket
    await client.from('tickets').update({ 
      status: TicketStatus.SOLD, 
      sold_by: sid, 
      sold_at: now 
    }).eq('id', tid);

    // Création de la vente
    const { data: sale, error: saleError } = await client.from('sales').insert({ 
      ticket_id: tid, 
      agency_id: aid, 
      seller_id: sid, 
      amount: tk.price, 
      sold_at: now, 
      customer_phone: phone 
    }).select().single();

    if (saleError) throw saleError;
    
    await this.log({ id: sid, agency_id: aid }, 'SALE', `Ticket ${tk.username} vendu.`);
    return sale as Sale;
  }

  // --- AGENCES ---
  
  async getAgencies(): Promise<Agency[]> { 
    const { data, error } = await client.from('agencies').select('*').order('name'); 
    if (error) throw error;
    return (data as Agency[]) || [];
  }

  async getAgency(id: string): Promise<Agency> { 
    const { data, error } = await client.from('agencies').select('*').eq('id', id).single(); 
    if (error) throw error;
    return data as Agency;
  }
  
  async updateAgencyModules(id: string, modules: AgencyModules, actor: UserProfile): Promise<void> {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Super-Admin requis.");
    const { data: agency } = await client.from('agencies').select('*').eq('id', id).single();
    if (!agency) throw new Error("Agence introuvable.");

    const updatedSettings = { ...(agency.settings || {}), modules };
    const { error } = await client.from('agencies').update({ settings: updatedSettings }).eq('id', id);
    if (error) throw error;
    await this.log(actor, 'AGENCY_MODULES', `Modules mis à jour pour ${agency.name}`);
  }

  // Fix: Added AgencySettings to imports and fixed updateAgency signature
  async updateAgency(id: string, name: string, settings: Partial<AgencySettings>, status?: AgencyStatus): Promise<void> {
    const body: any = { name, settings };
    if (status) body.status = status;
    const { error } = await client.from('agencies').update(body).eq('id', id);
    if (error) throw error;
  }

  async addAgency(name: string): Promise<Agency> { 
    const { data, error } = await client.from('agencies').insert({ 
      name, 
      status: 'active', 
      credits_balance: 10,
      plan_name: 'Trial',
      subscription_start: new Date().toISOString(),
      subscription_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      settings: { 
        currency: 'GNF', 
        archived_revenue: 0, 
        archived_sales_count: 0, 
        modules: DEFAULT_MODULES,
        total_tickets_ever: 0
      } 
    }).select().single();
    
    if (error) throw error;
    return data as Agency;
  }

  async deleteAgency(id: string): Promise<void> { 
    const { error } = await client.from('agencies').delete().eq('id', id); 
    if (error) throw error;
  }

  async setAgencyStatus(id: string, status: AgencyStatus, actor: UserProfile): Promise<void> {
    if (actor.role !== UserRole.SUPER_ADMIN) return;
    const { error } = await client.from('agencies').update({ status }).eq('id', id);
    if (error) throw error;
    await this.log(actor, 'AGENCY_STATUS', `Agence ${id} passée en ${status}`);
  }

  // --- UTILISATEURS ---

  async getUsers(aid: string, role: UserRole): Promise<UserProfile[]> {
    let q = client.from('profiles').select('*');
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid).neq('role', UserRole.SUPER_ADMIN);
    const { data, error } = await q;
    if (error) throw error;
    return (data as UserProfile[]) || [];
  }

  async addUser(userData: any): Promise<UserProfile> { 
    const { data, error } = await client.from('profiles').insert({ 
      ...userData, 
      display_name: userData.email.split('@')[0] 
    }).select().single();
    
    if (error) throw error;
    return data as UserProfile;
  }

  async updateUserRole(uid: string, role: UserRole): Promise<void> { 
    const { error } = await client.from('profiles').update({ role }).eq('id', uid); 
    if (error) throw error;
  }

  async updatePassword(uid: string, password: string, actor: UserProfile): Promise<boolean> { 
    const { error } = await client.from('profiles').update({ password }).eq('id', uid); 
    if (error) throw error;
    await this.log(actor, 'PASSWORD_CHANGE', `MDP mis à jour pour utilisateur ${uid}`);
    return true; 
  }

  async getLogs(aid: string, role: UserRole): Promise<ActivityLog[]> {
    let q = client.from('logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data, error } = await q;
    if (error) throw error;
    return (data as ActivityLog[]) || [];
  }

  async updateTicketPrice(id: string, price: number): Promise<void> { 
    const { error } = await client.from('tickets').update({ price }).eq('id', id); 
    if (error) throw error;
  }

  async updateProfilePrices(aid: string, profile: string, price: number): Promise<number> {
    const { data, error } = await client.from('tickets')
      .update({ price })
      .eq('agency_id', aid)
      .eq('profile', profile)
      .eq('status', TicketStatus.UNSOLD)
      .select();
    
    if (error) throw error;
    return data?.length || 0;
  }

  async deleteTicket(id: string): Promise<void> { 
    const { error } = await client.from('tickets').delete().eq('id', id); 
    if (error) throw error;
  }

  async getSales(aid: string, role: UserRole): Promise<Sale[]> {
    let q = client.from('sales')
      .select('*, profiles:seller_id(display_name), tickets:ticket_id(username, profile, time_limit)')
      .order('sold_at', { ascending: false });
    
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    
    const { data, error } = await q;
    if (error) throw error;

    return (data || []).map((s: any) => ({ 
      ...s, 
      seller_name: s.profiles?.display_name, 
      ticket_username: s.tickets?.username, 
      ticket_profile: s.tickets?.profile, 
      ticket_time_limit: s.tickets?.time_limit 
    })) as Sale[];
  }

  async cancelSale(id: string): Promise<boolean> {
    const { data, error: fetchError } = await client.from('sales')
      .select('ticket_id')
      .eq('id', id)
      .single();
    
    if (fetchError || !data?.ticket_id) return false;

    // Réintégration du ticket
    await client.from('tickets').update({ 
      status: TicketStatus.UNSOLD, 
      sold_by: null, 
      sold_at: null 
    }).eq('id', data.ticket_id);

    // Suppression de la vente
    const { error: deleteError } = await client.from('sales').delete().eq('id', id);
    if (deleteError) throw deleteError;

    return true;
  }
}

// Export de l'instance unique du service
export const supabase = new SupabaseService();
