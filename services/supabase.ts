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
  AgencySettings,
  SubscriptionPlan
} from '../types';

const getEnv = (key: string): string => {
  try {
    // @ts-ignore
    return import.meta.env?.[key] || '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://gqenaxalqkdaoylhwzoq.supabase.co';
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_ndkp28zh6qF0Ixm740HD4g_V-1Ew2vw';

const isConfigured = !!supabaseUrl && !!supabaseKey && !supabaseUrl.includes('placeholder');

const client: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder',
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } 
  }
);

const TICKET_CREDIT_RATIO = 20; 

class SupabaseService {
  public isConfigured(): boolean { return isConfigured; }

  /**
   * Vérifie si l'abonnement d'une agence est toujours valide.
   */
  isSubscriptionActive(agency: Agency | null): boolean {
    if (!agency || !agency.subscription_end) return false;
    return new Date(agency.subscription_end).getTime() > Date.now();
  }

  /**
   * Enregistre une action dans le journal d'audit de manière non-bloquante.
   */
  private async log(user: Partial<UserProfile>, action: string, details: string): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      // On ne 'await' pas l'insertion pour ne pas ralentir l'UX
      client.from('logs').insert({
        user_id: user.id, 
        user_name: user.display_name || user.email || 'Système', 
        agency_id: user.agency_id,
        action, 
        details, 
        created_at: new Date().toISOString()
      }).then(({ error }) => {
        if (error) console.error("Échec de l'enregistrement du log d'audit:", error.message);
      });
    } catch (e) {
      console.warn("Audit Log silent failure:", e);
    }
  }

  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    if (!this.isConfigured()) return null;
    try {
      const { data, error } = await client.from('profiles').select('*').eq('email', email).eq('password', password).single();
      if (error || !data) return null;
      
      localStorage.setItem('wifi_pro_session', JSON.stringify({ email, password }));
      const user = data as UserProfile;
      await this.log(user, 'LOGIN', 'Authentification réussie');
      return user;
    } catch (err) {
      console.error("Erreur d'authentification:", err);
      return null;
    }
  }

  async checkPersistedSession(): Promise<UserProfile | null> {
    const session = localStorage.getItem('wifi_pro_session');
    if (!session) return null;
    try {
      const { email, password } = JSON.parse(session);
      return await this.signIn(email, password);
    } catch { 
      localStorage.removeItem('wifi_pro_session');
      return null; 
    }
  }

  async signOut(user: UserProfile): Promise<void> { 
    localStorage.removeItem('wifi_pro_session');
    await this.log(user, 'LOGOUT', 'Déconnexion utilisateur'); 
  }

  async verifyPin(uid: string, pin: string): Promise<boolean> { 
    if (!this.isConfigured()) return pin === '0000';
    try {
      const { data } = await client.from('profiles').select('pin').eq('id', uid).single();
      return data?.pin === pin; 
    } catch { return false; }
  }

  async getAgencies(): Promise<Agency[]> { 
    if (!this.isConfigured()) return [];
    try {
      const { data } = await client.from('agencies').select('*').order('name'); 
      return (data as Agency[]) || [];
    } catch { return []; }
  }

  async getAgency(id: string): Promise<Agency> { 
    const { data, error } = await client.from('agencies').select('*').eq('id', id).single(); 
    if (error) throw error;
    return data as Agency;
  }

  async createAgency(name: string, actor: UserProfile): Promise<Agency> {
    const now = new Date();
    // Licence initiale Standard de 14 jours
    const subscriptionEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); 
    
    const { data, error } = await client.from('agencies').insert({
      name,
      status: 'active',
      credits_balance: 2.5, // 50 tickets offerts (2.5 * 20)
      plan_name: 'Standard',
      subscription_start: now.toISOString(),
      subscription_end: subscriptionEnd.toISOString(),
      settings: {
        currency: 'XOF',
        modules: { dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true }
      }
    }).select().single();
    
    if (error) throw error;
    await this.log(actor, 'AGENCY_CREATE', `Nouvelle agence créée: ${name}`);
    return data as Agency;
  }

  async importTickets(ticketsData: Record<string, any>[], uid: string, aid: string) {
    const { data: agency, error: agencyErr } = await client.from('agencies').select('*').eq('id', aid).single();
    if (agencyErr || !agency) throw new Error('Agence introuvable');
    
    const rawCost = ticketsData.length / TICKET_CREDIT_RATIO;
    const cost = Number.parseFloat(rawCost.toFixed(4));
    const isUnlimited = agency.plan_name === 'UNLIMITED';
    
    if (agency.credits_balance < cost && !isUnlimited) {
      throw new Error(`Crédits insuffisants. Requis: ${cost.toFixed(2)}, Disponible: ${agency.credits_balance.toFixed(2)}`);
    }

    const toInsert = ticketsData.map(t => ({
      username: String(t.username || '').trim(),
      password: String(t.password || t.username || '').trim(),
      profile: String(t.profile || 'Standard').trim(),
      time_limit: String(t.time_limit || 'N/A').trim(),
      price: Math.max(0, Number.parseInt(String(t.price)) || 0),
      agency_id: aid,
      created_by: uid,
      status: TicketStatus.UNSOLD
    })).filter(t => t.username !== '');

    if (toInsert.length === 0) throw new Error('Aucun ticket valide trouvé dans le fichier.');

    const { error: insertErr } = await client.from('tickets').insert(toInsert);
    if (insertErr) throw new Error(`Erreur lors de l'insertion SQL: ${insertErr.message}`);

    if (!isUnlimited && cost > 0) {
      const newBalance = Number.parseFloat((agency.credits_balance - cost).toFixed(4));
      await client.from('agencies').update({ credits_balance: newBalance }).eq('id', aid);
    }

    await this.log({id: uid, agency_id: aid}, 'TICKET_IMPORT', `Importation massive: ${toInsert.length} tickets ajoutés (Coût: ${cost.toFixed(2)})`);
    return { success: toInsert.length, cost };
  }

  async getStats(aid: string, role: UserRole) {
    if (!this.isConfigured()) return { revenue: 0, soldCount: 0, stockCount: 0, userCount: 0, agencyCount: 0, currency: 'XOF', credits: 0 };
    const matchQuery = role === UserRole.SUPER_ADMIN ? {} : { agency_id: aid };
    
    try {
      const [salesRes, ticketsRes, profilesRes, agenciesRes] = await Promise.all([
        client.from('sales').select('amount').match(matchQuery),
        client.from('tickets').select('status').match(matchQuery).eq('status', TicketStatus.UNSOLD),
        client.from('profiles').select('id', { count: 'exact', head: true }).match(matchQuery),
        role === UserRole.SUPER_ADMIN ? client.from('agencies').select('*') : client.from('agencies').select('*').eq('id', aid).single()
      ]);

      const agenciesData = role === UserRole.SUPER_ADMIN ? (agenciesRes.data as Agency[] || []) : [agenciesRes.data as Agency];
      const totalCredits = agenciesData.reduce((acc, a) => acc + (Number(a?.credits_balance) || 0), 0);
      const revenue = salesRes.data?.reduce((acc, s) => acc + (Number(s.amount) || 0), 0) || 0;
      
      return {
        revenue,
        soldCount: salesRes.data?.length || 0,
        stockCount: ticketsRes.data?.length || 0,
        userCount: profilesRes.count || 0,
        agencyCount: role === UserRole.SUPER_ADMIN ? agenciesData.length : 1,
        currency: agenciesData[0]?.settings?.currency || 'XOF',
        credits: totalCredits
      };
    } catch (err) {
      console.error("Stats fetching failure:", err);
      return { revenue: 0, soldCount: 0, stockCount: 0, userCount: 0, agencyCount: 0, currency: 'XOF', credits: 0 };
    }
  }

  async sellTicket(tid: string, sid: string, aid: string, phone?: string): Promise<Sale | null> {
    const { data: tk } = await client.from('tickets')
      .select('*')
      .eq('id', tid)
      .eq('status', TicketStatus.UNSOLD)
      .single();

    if (!tk) return null;
    
    const now = new Date().toISOString();
    const { error: updateError } = await client.from('tickets')
      .update({ status: TicketStatus.SOLD, sold_by: sid, sold_at: now })
      .eq('id', tid)
      .eq('status', TicketStatus.UNSOLD);
    
    if (updateError) return null;

    const { data: sale, error: saleError } = await client.from('sales').insert({ 
      ticket_id: tid, agency_id: aid, seller_id: sid, amount: tk.price, sold_at: now, customer_phone: phone, payment_method: 'CASH'
    }).select().single();

    if (saleError) {
      // Rollback manuel du statut
      await client.from('tickets').update({ status: TicketStatus.UNSOLD, sold_by: null, sold_at: null }).eq('id', tid);
      throw saleError;
    }

    await this.log({id: sid, agency_id: aid}, 'SALE', `Vente ticket: ${tk.username} pour ${tk.price} XOF`);
    return sale as Sale;
  }

  async getTickets(aid: string, role: UserRole): Promise<Ticket[]> {
    try {
      let q = client.from('tickets').select('*').order('created_at', { ascending: false });
      if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
      const { data } = await q;
      return (data as Ticket[]) || [];
    } catch { return []; }
  }

  async getSales(aid: string, role: UserRole): Promise<Sale[]> {
    try {
      let q = client.from('sales').select('*, profiles:seller_id(display_name), tickets:ticket_id(username, profile, time_limit)');
      if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
      const { data } = await q.order('sold_at', { ascending: false });
      return (data || []).map((s: any) => ({ 
        ...s, 
        seller_name: s.profiles?.display_name, 
        ticket_username: s.tickets?.username, 
        ticket_profile: s.tickets?.profile, 
        ticket_time_limit: s.tickets?.time_limit 
      })) as Sale[];
    } catch { return []; }
  }

  async getUsers(aid: string, role: UserRole): Promise<UserProfile[]> {
    try {
      let q = client.from('profiles').select('*');
      if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
      const { data } = await q;
      return (data as UserProfile[]) || [];
    } catch { return []; }
  }

  async getLogs(aid: string, role: UserRole): Promise<ActivityLog[]> {
    try {
      let q = client.from('logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
      const { data } = await q;
      return (data as ActivityLog[]) || [];
    } catch { return []; }
  }

  async addUser(u: any) { 
    const { error } = await client.from('profiles').insert({
      ...u,
      display_name: u.email.split('@')[0],
      created_at: new Date().toISOString()
    }); 
    if (error) throw error;
  }
  
  async updateUserRole(id: string, role: UserRole) { 
    await client.from('profiles').update({ role }).eq('id', id); 
  }
  
  async updatePassword(id: string, password: string, actor: UserProfile) { 
    const { error } = await client.from('profiles').update({ password }).eq('id', id);
    if (error) return false;
    await this.log(actor, 'PASSWORD_CHANGE', `Mot de passe utilisateur ID ${id} modifié`);
    return true; 
  }
  
  async updateAgency(id: string, name: string, settings: any, actor: UserProfile) { 
    const { error } = await client.from('agencies').update({ name, settings }).eq('id', id);
    if (error) throw error;
    await this.log(actor, 'AGENCY_UPDATE', `Paramètres agence "${name}" mis à jour`);
  }
  
  async deleteAgency(id: string, actor: UserProfile) { 
    const { error } = await client.from('agencies').delete().eq('id', id); 
    if (error) throw error;
    await this.log(actor, 'AGENCY_DELETE', `Agence ID ${id} supprimée`);
  }
  
  async addCredits(aid: string, amount: number, actorId: string, desc: string) {
    const { data: ag } = await client.from('agencies').select('credits_balance').eq('id', aid).single();
    const newBalance = Number.parseFloat(((ag?.credits_balance || 0) + amount).toFixed(4));
    await client.from('agencies').update({ credits_balance: newBalance }).eq('id', aid);
    await this.log({id: actorId}, 'CREDIT_RECHARGE', `Ajout de ${amount} crédits à l'agence ID ${aid}`);
  }
  
  async getSubscriptionPlans() { 
    const { data } = await client.from('subscription_plans').select('*').order('order_index');
    return (data as SubscriptionPlan[]) || [];
  }
  
  async updateUserEmail(id: string, email: string, actor: UserProfile): Promise<boolean> {
    const { data: existing } = await client.from('profiles').select('id').eq('email', email).neq('id', id).maybeSingle();
    if (existing) return false;
    const { error } = await client.from('profiles').update({ email }).eq('id', id);
    if (error) return false;
    await this.log(actor, 'USER_UPDATE', `Email utilisateur changé pour: ${email}`);
    return true;
  }
  
  async cancelSale(saleId: string, actor?: UserProfile) {
    const { data: sale } = await client.from('sales').select('*').eq('id', saleId).single();
    if (!sale) throw new Error('Vente non trouvée');
    
    await client.from('tickets').update({ status: TicketStatus.UNSOLD, sold_by: null, sold_at: null }).eq('id', sale.ticket_id);
    await client.from('sales').delete().eq('id', saleId);
    
    if (actor) { 
      await this.log(actor, 'SALE_CANCEL', `Vente ID ${saleId} annulée (Ticket ${sale.ticket_id} remis en stock)`); 
    }
  }
  
  async updateAgencyModules(id: string, modules: AgencyModules, actor: UserProfile) {
    const { data: agency } = await client.from('agencies').select('settings').eq('id', id).single();
    const settings = { ...(agency?.settings || {}), modules };
    await client.from('agencies').update({ settings }).eq('id', id);
    await this.log(actor, 'AGENCY_MODULES', `Modules modifiés pour l'agence ID ${id}`);
  }
  
  async updateSubscriptionPlan(plan: SubscriptionPlan, actor: UserProfile) { 
    await client.from('subscription_plans').upsert(plan); 
    await this.log(actor, 'PLAN_UPDATE', `Plan "${plan.name}" mis à jour`);
  }
  
  async deleteSubscriptionPlan(id: string, actor: UserProfile) { 
    await client.from('subscription_plans').delete().eq('id', id); 
    await this.log(actor, 'PLAN_DELETE', `Plan ID ${id} supprimé`);
  }
  
  async setAgencyStatus(id: string, status: AgencyStatus, actor: UserProfile) { 
    await client.from('agencies').update({ status }).eq('id', id); 
    await this.log(actor, 'AGENCY_STATUS', `Statut agence ID ${id} changé en: ${status}`);
  }
  
  async updateSubscription(aid: string, planName: string, months: number, actor: UserProfile) {
    const now = new Date();
    const end = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000); 
    const { error } = await client.from('agencies').update({ 
      plan_name: planName, 
      subscription_start: now.toISOString(), 
      subscription_end: end.toISOString() 
    }).eq('id', aid);
    
    if(error) throw error;
    await this.log(actor, 'AGENCY_SUBSCRIPTION', `Licence ${planName} (${months} mois) activée pour l'agence ID ${aid}`);
  }
}

export const supabase = new SupabaseService();
