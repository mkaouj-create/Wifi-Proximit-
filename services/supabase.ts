
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
  AgencySettings,
  SubscriptionPlan
} from '../types';

const getEnvVar = (name: string): string => {
  try {
    return (import.meta as any).env?.[name] || (process as any).env?.[name] || '';
  } catch (e) { return ''; }
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

const client: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

const TICKET_CREDIT_RATIO = 20; 

class SupabaseService {
  public isConfigured(): boolean {
    return !!supabaseUrl && !supabaseUrl.includes('placeholder');
  }

  public subscribeToChanges(table: string, callback: (payload: any) => void) {
    return client
      .channel('public-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
  }

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
    } catch (e) { console.error("Audit Log error:", e); }
  }

  // --- PLANS D'ABONNEMENT ---
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await client.from('subscription_plans').select('*').order('order_index');
    if (error) {
      console.warn("Table subscription_plans non trouvée, utilisation des données par défaut.");
      return [
        { id: '1', name: 'Starter', months: 3, price: 50000, currency: 'GNF', features: ['1 Agence', 'Support Email'], is_popular: false, order_index: 0 },
        { id: '2', name: 'Professional', months: 6, price: 90000, currency: 'GNF', features: ['Multi-vendeurs', 'Support Pro'], is_popular: true, order_index: 1 },
        { id: '3', name: 'Business', months: 12, price: 150000, currency: 'GNF', features: ['Tout illimité', 'Support VIP'], is_popular: false, order_index: 2 }
      ];
    }
    return data as SubscriptionPlan[];
  }

  async updateSubscriptionPlan(plan: Partial<SubscriptionPlan>, actor: UserProfile): Promise<void> {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Accès refusé");
    const { error } = await client.from('subscription_plans').upsert(plan);
    if (error) throw error;
    await this.log(actor, 'PLAN_UPDATE', `Plan ${plan.name} mis à jour`);
  }

  // --- ABONNEMENT ---
  public isSubscriptionActive(agency: Agency): boolean {
    if (!agency || !agency.subscription_end) return false;
    return new Date(agency.subscription_end).getTime() > Date.now();
  }

  async updateSubscription(aid: string, plan: string, months: number, actor: UserProfile): Promise<void> {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Accès refusé");
    const end = new Date();
    end.setMonth(end.getMonth() + months);
    const { error } = await client.from('agencies').update({
      plan_name: plan,
      subscription_end: end.toISOString(),
      status: 'active'
    }).eq('id', aid);
    if (error) throw error;
    await this.log(actor, 'AGENCY_SUBSCRIPTION', `Plan ${plan} activé pour ${aid}`);
  }

  // --- AUTH & SESSION ---
  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    const { data, error } = await client.from('profiles')
      .select('*').eq('email', email).eq('password', password).single();
    if (error || !data) return null;
    const user = data as UserProfile;
    localStorage.setItem('wifi_pro_session', JSON.stringify({ email, password }));
    await this.log(user, 'LOGIN', 'Connexion réussie');
    return user;
  }

  async checkPersistedSession(): Promise<UserProfile | null> {
    const session = localStorage.getItem('wifi_pro_session');
    if (!session) return null;
    try {
      const { email, password } = JSON.parse(session);
      return this.signIn(email, password);
    } catch { return null; }
  }

  async signOut(user: UserProfile): Promise<void> { 
    localStorage.removeItem('wifi_pro_session');
    await this.log(user, 'LOGOUT', 'Déconnexion'); 
  }

  async verifyPin(uid: string, pin: string): Promise<boolean> { 
    const { data } = await client.from('profiles').select('pin').eq('id', uid).single();
    return data?.pin === pin; 
  }

  // --- STATISTIQUES ---
  async getStats(aid: string, role: UserRole) {
    const isSuper = role === UserRole.SUPER_ADMIN;
    const [salesRes, ticketsRes, profilesRes, agenciesRes] = await Promise.all([
      isSuper ? client.from('sales').select('amount') : client.from('sales').select('amount').eq('agency_id', aid),
      isSuper ? client.from('tickets').select('status') : client.from('tickets').select('status').eq('agency_id', aid),
      isSuper ? client.from('profiles').select('id') : client.from('profiles').select('id').eq('agency_id', aid),
      isSuper ? client.from('agencies').select('*') : client.from('agencies').select('*').eq('id', aid).single()
    ]);

    let archRev = 0, totalCredits = 0;
    if (isSuper) {
      (agenciesRes.data as Agency[] || []).forEach(a => {
        archRev += (Number(a.settings?.archived_revenue) || 0);
        totalCredits += (Number(a.credits_balance) || 0);
      });
    } else {
      const a = agenciesRes.data as Agency;
      archRev = Number(a?.settings?.archived_revenue) || 0;
      totalCredits = Number(a?.credits_balance) || 0;
    }

    return {
      revenue: (salesRes.data?.reduce((acc, s) => acc + (Number(s.amount) || 0), 0) || 0) + archRev,
      soldCount: salesRes.data?.length || 0,
      stockCount: ticketsRes.data?.filter(t => t.status === TicketStatus.UNSOLD).length || 0,
      userCount: profilesRes.data?.length || 0,
      agencyCount: isSuper ? agenciesRes.data?.length || 0 : 1,
      currency: (isSuper ? 'GNF' : (agenciesRes.data as Agency)?.settings?.currency) || 'GNF',
      credits: totalCredits
    };
  }

  async sellTicket(tid: string, sid: string, aid: string, phone?: string): Promise<Sale | null> {
    const { data: agency } = await client.from('agencies').select('*').eq('id', aid).single();
    if (!this.isSubscriptionActive(agency)) throw new Error("Abonnement expiré.");

    const { data: tk } = await client.from('tickets').select('*').eq('id', tid).eq('status', TicketStatus.UNSOLD).single();
    if (!tk) return null;

    const now = new Date().toISOString();
    await client.from('tickets').update({ status: TicketStatus.SOLD, sold_by: sid, sold_at: now }).eq('id', tid);
    const { data: sale, error } = await client.from('sales').insert({ 
      ticket_id: tid, agency_id: aid, seller_id: sid, amount: tk.price, sold_at: now, customer_phone: phone 
    }).select().single();

    if (error) throw error;
    await this.log({ id: sid, agency_id: aid }, 'SALE', `Vente ticket: ${tk.username}`);
    return sale as Sale;
  }

  async importTickets(ts: any[], uid: string, aid: string) {
    const { data: agency } = await client.from('agencies').select('*').eq('id', aid).single();
    if (!agency || !this.isSubscriptionActive(agency)) throw new Error('Abonnement inactif');

    const totalEver = agency.settings?.total_tickets_ever || 0;
    const cost = Math.ceil(ts.length / TICKET_CREDIT_RATIO);
    
    if (agency.credits_balance < cost && agency.plan_name !== 'UNLIMITED') {
      throw new Error(`Solde insuffisant (${cost} requis)`);
    }

    const toInsert = ts.map(t => ({
      username: String(t.username).trim(),
      password: String(t.password || t.username).trim(),
      profile: String(t.profile || 'Default').trim(),
      time_limit: String(t.time_limit || 'N/A').trim(),
      price: Math.max(0, parseInt(t.price) || 0),
      agency_id: aid,
      created_by: uid
    }));

    const { error } = await client.from('tickets').insert(toInsert);
    if (error) throw error;

    await client.from('agencies').update({ 
      credits_balance: agency.credits_balance - cost,
      settings: { ...agency.settings, total_tickets_ever: totalEver + toInsert.length }
    }).eq('id', aid);

    await client.from('credit_transactions').insert({
      agency_id: aid, amount: -cost, type: 'CONSUMPTION', description: `Import ${toInsert.length} tickets`, created_by: uid
    });

    return { success: toInsert.length, cost };
  }

  async addCredits(aid: string, amount: number, actorId: string, desc: string): Promise<void> {
    const { data: ag } = await client.from('agencies').select('credits_balance').eq('id', aid).single();
    const newBal = (ag?.credits_balance || 0) + amount;
    await client.from('agencies').update({ credits_balance: newBal }).eq('id', aid);
    await client.from('credit_transactions').insert({
      agency_id: aid, amount, type: 'RECHARGE', description: desc, created_by: actorId
    });
  }

  async getAgencies(): Promise<Agency[]> { 
    const { data } = await client.from('agencies').select('*').order('name'); 
    return (data as Agency[]) || [];
  }
  async getAgency(id: string): Promise<Agency> { 
    const { data } = await client.from('agencies').select('*').eq('id', id).single(); 
    return data as Agency;
  }
  async getTickets(aid: string, role: UserRole): Promise<Ticket[]> {
    let q = client.from('tickets').select('*').order('created_at', { ascending: false });
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return (data as Ticket[]) || [];
  }
  async getSales(aid: string, role: UserRole): Promise<Sale[]> {
    let q = client.from('sales').select('*, profiles:seller_id(display_name), tickets:ticket_id(username, profile, time_limit)');
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q.order('sold_at', { ascending: false });
    return (data || []).map((s: any) => ({ 
      ...s, seller_name: s.profiles?.display_name, ticket_username: s.tickets?.username, 
      ticket_profile: s.tickets?.profile, ticket_time_limit: s.tickets?.time_limit 
    })) as Sale[];
  }
  async getUsers(aid: string, role: UserRole): Promise<UserProfile[]> {
    let q = client.from('profiles').select('*');
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return (data as UserProfile[]) || [];
  }
  async getLogs(aid: string, role: UserRole): Promise<ActivityLog[]> {
    let q = client.from('logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return (data as ActivityLog[]) || [];
  }

  async updateAgency(id: string, name: string, settings: Partial<AgencySettings>): Promise<void> {
    await client.from('agencies').update({ name, settings }).eq('id', id);
  }

  async updateAgencyModules(id: string, modules: AgencyModules, actor: UserProfile): Promise<void> {
    const { data: agency } = await client.from('agencies').select('settings').eq('id', id).single();
    const settings = { ...(agency?.settings || {}), modules };
    await client.from('agencies').update({ settings }).eq('id', id);
    await this.log(actor, 'AGENCY_MODULES', `Modules mis à jour pour ${id}`);
  }

  async setAgencyStatus(id: string, status: AgencyStatus, actor: UserProfile): Promise<void> {
    await client.from('agencies').update({ status }).eq('id', id);
    await this.log(actor, 'AGENCY_STATUS', `Agence ${id} -> ${status}`);
  }
  async addUser(userData: any): Promise<void> { 
    await client.from('profiles').insert({ ...userData, display_name: userData.email.split('@')[0] });
  }

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    const { error } = await client.from('profiles').update({ role }).eq('id', uid);
    if (error) throw error;
  }

  async updatePassword(uid: string, password: string, actor: UserProfile): Promise<boolean> { 
    await client.from('profiles').update({ password }).eq('id', uid);
    await this.log(actor, 'PASSWORD_CHANGE', `Profil ${uid}`);
    return true; 
  }
  async deleteTicket(id: string): Promise<void> { await client.from('tickets').delete().eq('id', id); }
  async updateTicketPrice(id: string, price: number): Promise<void> { await client.from('tickets').update({ price }).eq('id', id); }
  async updateProfilePrices(aid: string, profile: string, price: number): Promise<number> {
    const { data } = await client.from('tickets').update({ price }).eq('agency_id', aid).eq('profile', profile).eq('status', TicketStatus.UNSOLD).select();
    return data?.length || 0;
  }
  async cancelSale(id: string): Promise<void> {
    const { data } = await client.from('sales').select('ticket_id').eq('id', id).single();
    if (data?.ticket_id) {
      await client.from('tickets').update({ status: TicketStatus.UNSOLD, sold_by: null, sold_at: null }).eq('id', data.ticket_id);
      await client.from('sales').delete().eq('id', id);
    }
  }
}

export const supabase = new SupabaseService();
