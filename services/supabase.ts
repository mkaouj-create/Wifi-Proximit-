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

/**
 * Récupération sécurisée des variables d'environnement.
 */
const getEnv = (key: string): string => {
  try {
    // @ts-ignore
    return import.meta.env?.[key] || '';
  } catch {
    return '';
  }
};

// Configuration Supabase avec fallback sur les identifiants fournis
const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://gqenaxalqkdaoylhwzoq.supabase.co';
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_ndkp28zh6qF0Ixm740HD4g_V-1Ew2vw';

const isConfigured = !!supabaseUrl && !!supabaseKey && !supabaseUrl.includes('placeholder');

if (!isConfigured) {
  console.warn("⚠️ [Config] Supabase non détecté. Activation du MODE DÉMO avec données locales.");
}

const client: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder',
  {
    auth: { 
      persistSession: false, 
      autoRefreshToken: false,
      detectSessionInUrl: false
    } 
  }
);

const TICKET_CREDIT_RATIO = 20; 

// --- DONNÉES DE DÉMO (MOCKS) ---
const DEMO_AGENCY_ID = 'agency-demo-001';
const DEMO_USER_ID = 'user-demo-001';

const MOCK_AGENCY: Agency = {
  id: DEMO_AGENCY_ID,
  name: 'WiFi Zone Démo',
  status: 'active',
  credits_balance: 250,
  plan_name: 'Business',
  subscription_start: new Date().toISOString(),
  subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  settings: {
    currency: 'XOF',
    contact_phone: '+221 77 000 00 00',
    whatsapp_receipt_header: '*WIFI ZONE PRO*',
    modules: { dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true }
  },
  created_at: new Date().toISOString()
};

const MOCK_USER: UserProfile = {
  id: DEMO_USER_ID,
  email: 'admin@demo.com',
  role: UserRole.ADMIN,
  agency_id: DEMO_AGENCY_ID,
  display_name: 'Admin Démo',
  created_at: new Date().toISOString()
};

const MOCK_TICKETS: Ticket[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `ticket-${i}`,
  username: `USER${8000 + i}`,
  password: `${8000 + i}`,
  profile: i % 2 === 0 ? '1H-500F' : '24H-2000F',
  time_limit: i % 2 === 0 ? '1 Heure' : '1 Jour',
  price: i % 2 === 0 ? 500 : 2000,
  status: TicketStatus.UNSOLD,
  agency_id: DEMO_AGENCY_ID,
  created_by: DEMO_USER_ID,
  created_at: new Date().toISOString()
}));

class SupabaseService {
  
  public isConfigured(): boolean {
    return isConfigured;
  }

  private async log(user: Partial<UserProfile>, action: string, details: string): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[DÉMO LOG] ${action}: ${details}`);
      return;
    }
    
    client.from('logs').insert({
      user_id: user.id, 
      user_name: user.display_name || user.email || 'Système', 
      agency_id: user.agency_id,
      action, 
      details, 
      created_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) console.error("Log error:", error);
    });
  }

  // ==========================================
  //  AUTHENTIFICATION
  // ==========================================

  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    if (!this.isConfigured()) {
      // Mode Démo : Connexion toujours réussie
      return { ...MOCK_USER, email, display_name: email.split('@')[0] || 'Admin Démo' };
    }
    
    const { data, error } = await client.from('profiles')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();
    
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
      return await this.signIn(email, password);
    } catch { 
      return null; 
    }
  }

  async signOut(user: UserProfile): Promise<void> { 
    localStorage.removeItem('wifi_pro_session');
    await this.log(user, 'LOGOUT', 'Déconnexion'); 
  }

  async verifyPin(uid: string, pin: string): Promise<boolean> { 
    if (!this.isConfigured()) return pin === '0000';
    const { data } = await client.from('profiles').select('pin').eq('id', uid).single();
    return data?.pin === pin; 
  }

  // ==========================================
  //  GESTION DES AGENCES
  // ==========================================

  public isSubscriptionActive(agency: Partial<Agency> | null): boolean {
    if (!this.isConfigured()) return true;
    if (!agency || !agency.subscription_end) return false;
    return new Date(agency.subscription_end).getTime() > Date.now();
  }

  async getAgencies(): Promise<Agency[]> { 
    if (!this.isConfigured()) return [MOCK_AGENCY];
    const { data } = await client.from('agencies').select('*').order('name'); 
    return (data as Agency[]) || [];
  }

  async getAgency(id: string): Promise<Agency> { 
    if (!this.isConfigured()) return MOCK_AGENCY;
    const { data, error } = await client.from('agencies').select('*').eq('id', id).single(); 
    if (error) throw error;
    return data as Agency;
  }

  async createAgency(name: string, actor: UserProfile): Promise<Agency> {
    if (!this.isConfigured()) return { ...MOCK_AGENCY, name, id: crypto.randomUUID() };

    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Permission refusée");
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); 

    const { data, error } = await client.from('agencies').insert({
      name,
      status: 'active',
      credits_balance: 50,
      plan_name: 'Trial',
      subscription_start: now.toISOString(),
      subscription_end: trialEnd.toISOString(),
      settings: {
        currency: 'GNF',
        modules: { dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true }
      }
    }).select().single();
    
    if (error) throw error;
    await this.log(actor, 'AGENCY_CREATE', `Agence ${name} créée`);
    return data as Agency;
  }

  async updateAgency(id: string, name: string, settingsUpdate: Partial<AgencySettings>, actor?: UserProfile): Promise<void> {
    if (!this.isConfigured()) return;

    if (actor?.role === UserRole.SELLER) throw new Error("Accès interdit.");

    const { data: current } = await client.from('agencies').select('settings').eq('id', id).single();
    const mergedSettings = { ...(current?.settings || {}), ...settingsUpdate };

    const { error } = await client.from('agencies').update({ name, settings: mergedSettings }).eq('id', id);
    if (error) throw error;
    
    if (actor) await this.log(actor, 'AGENCY_UPDATE', `Mise à jour paramètres`);
  }

  async updateAgencyModules(id: string, modules: AgencyModules, actor: UserProfile): Promise<void> {
    if (!this.isConfigured()) return;
    if (actor.role === UserRole.SELLER) throw new Error("Permission refusée.");
    const { data: agency } = await client.from('agencies').select('settings').eq('id', id).single();
    const currentSettings = agency?.settings || {};
    await client.from('agencies').update({ settings: { ...currentSettings, modules } }).eq('id', id);
  }

  async setAgencyStatus(id: string, status: AgencyStatus, actor: UserProfile): Promise<void> {
    if (!this.isConfigured()) return;
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Permission refusée.");
    await client.from('agencies').update({ status }).eq('id', id);
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    if (!this.isConfigured()) return [
      { id: '1', name: 'Starter', price: 10000, currency: 'XOF', months: 1, features: ['Dashboard', 'Ventes'], is_popular: false, order_index: 1 },
      { id: '2', name: 'Business', price: 25000, currency: 'XOF', months: 1, features: ['Tout inclus', 'Multi-comptes'], is_popular: true, order_index: 2 }
    ];
    const { data } = await client.from('subscription_plans').select('*').order('order_index');
    return (data as SubscriptionPlan[]) || [];
  }

  async updateSubscription(aid: string, plan: string, months: number, actor: UserProfile): Promise<void> {
    if (!this.isConfigured()) return;
    const end = new Date();
    end.setMonth(end.getMonth() + months);
    const { error } = await client.from('agencies').update({
      plan_name: plan,
      subscription_end: end.toISOString(),
      status: 'active'
    }).eq('id', aid);
    if (error) throw error;
  }

  async updateSubscriptionPlan(plan: Partial<SubscriptionPlan>, actor: UserProfile): Promise<void> {
    if (!this.isConfigured()) return;
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Permission refusée");
    await client.from('subscription_plans').upsert(plan);
  }

  async deleteSubscriptionPlan(id: string, actor: UserProfile): Promise<void> {
    if (!this.isConfigured()) return;
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Permission refusée");
    await client.from('subscription_plans').delete().eq('id', id);
  }

  // ==========================================
  //  BUSINESS : TICKETS & VENTES
  // ==========================================

  async getStats(aid: string, role: UserRole) {
    if (!this.isConfigured()) {
      // Stats Démo
      return { 
        revenue: 125000, 
        soldCount: 42, 
        stockCount: 158, 
        userCount: 3, 
        agencyCount: 1, 
        currency: 'XOF', 
        credits: 250 
      };
    }

    const isSuper = role === UserRole.SUPER_ADMIN;
    const matchQuery = isSuper ? {} : { agency_id: aid };

    const [salesRes, ticketsRes, profilesRes, agenciesRes] = await Promise.all([
      client.from('sales').select('amount').match(matchQuery),
      client.from('tickets').select('status').match(matchQuery),
      client.from('profiles').select('id', { count: 'exact', head: true }).match(matchQuery),
      isSuper ? client.from('agencies').select('*') : client.from('agencies').select('*').eq('id', aid).single()
    ]);

    let archRev = 0, totalCredits = 0;
    const agenciesData = isSuper ? (agenciesRes.data as Agency[] || []) : [agenciesRes.data as Agency];

    agenciesData.forEach(a => {
      if (a) {
        archRev += (Number(a.settings?.archived_revenue) || 0);
        totalCredits += (Number(a.credits_balance) || 0);
      }
    });

    const currentRevenue = salesRes.data?.reduce((acc, s) => acc + (Number(s.amount) || 0), 0) || 0;

    return {
      revenue: currentRevenue + archRev,
      soldCount: salesRes.data?.length || 0,
      stockCount: ticketsRes.data?.filter(t => t.status === TicketStatus.UNSOLD).length || 0,
      userCount: profilesRes.count || 0,
      agencyCount: isSuper ? agenciesData.length : 1,
      currency: agenciesData[0]?.settings?.currency || 'GNF',
      credits: totalCredits
    };
  }

  async sellTicket(tid: string, sid: string, aid: string, phone?: string): Promise<Sale | null> {
    if (!this.isConfigured()) {
      // Simulation Vente Démo
      const t = MOCK_TICKETS.find(tk => tk.id === tid) || MOCK_TICKETS[0];
      return {
        id: 'sale-demo-' + Date.now(),
        ticket_id: tid,
        ticket_username: t.username,
        ticket_profile: t.profile,
        ticket_time_limit: t.time_limit,
        seller_id: sid,
        agency_id: aid,
        amount: t.price,
        sold_at: new Date().toISOString(),
        payment_method: 'CASH',
        customer_phone: phone
      } as Sale;
    }

    const { data: agency } = await client.from('agencies').select('subscription_end, settings').eq('id', aid).single();
    if (!this.isSubscriptionActive(agency)) throw new Error("Abonnement agence expiré.");

    const { data: tk } = await client.from('tickets').select('*').eq('id', tid).eq('status', TicketStatus.UNSOLD).single();
    if (!tk) return null;

    const now = new Date().toISOString();
    const { error: updateError } = await client.from('tickets')
      .update({ status: TicketStatus.SOLD, sold_by: sid, sold_at: now })
      .eq('id', tid).eq('status', TicketStatus.UNSOLD);

    if (updateError) return null;

    const { data: sale, error: saleError } = await client.from('sales').insert({ 
      ticket_id: tid, agency_id: aid, seller_id: sid, amount: tk.price, sold_at: now, customer_phone: phone 
    }).select().single();

    if (saleError) {
      await client.from('tickets').update({ status: TicketStatus.UNSOLD, sold_by: null, sold_at: null }).eq('id', tid);
      throw saleError;
    }

    await this.log({ id: sid, agency_id: aid }, 'SALE', `Vente ticket: ${tk.username}`);
    return sale as Sale;
  }

  async importTickets(ticketsData: Record<string, any>[], uid: string, aid: string) {
    if (!this.isConfigured()) {
       // Simulation Import
       return { success: ticketsData.length, cost: Math.ceil(ticketsData.length / TICKET_CREDIT_RATIO) };
    }

    const { data: agency } = await client.from('agencies').select('*').eq('id', aid).single();
    if (!agency || !this.isSubscriptionActive(agency)) throw new Error('Abonnement inactif');

    const cost = Math.ceil(ticketsData.length / TICKET_CREDIT_RATIO);
    const isUnlimited = agency.plan_name === 'UNLIMITED';
    
    if (agency.credits_balance < cost && !isUnlimited) {
      throw new Error(`Crédits insuffisants (Requis: ${cost}, Dispo: ${agency.credits_balance})`);
    }

    const toInsert = ticketsData.map(t => ({
      username: String(t.username).trim(),
      password: String(t.password || t.username).trim(),
      profile: String(t.profile || 'Default').trim(),
      time_limit: String(t.time_limit || 'N/A').trim(),
      price: Math.max(0, parseInt(t.price) || 0),
      agency_id: aid,
      created_by: uid,
      status: TicketStatus.UNSOLD
    }));

    const { error } = await client.from('tickets').insert(toInsert);
    if (error) throw error;

    if (!isUnlimited && cost > 0) {
      await client.from('agencies').update({ 
        credits_balance: agency.credits_balance - cost,
        settings: { ...agency.settings, total_tickets_ever: (agency.settings?.total_tickets_ever || 0) + toInsert.length }
      }).eq('id', aid);

      await client.from('credit_transactions').insert({
        agency_id: aid, amount: -cost, type: 'CONSUMPTION', description: `Import ${toInsert.length} tickets`, created_by: uid
      });
    }

    return { success: toInsert.length, cost: isUnlimited ? 0 : cost };
  }

  async updateTicketPrice(id: string, price: number): Promise<void> { 
    if (!this.isConfigured()) return;
    await client.from('tickets').update({ price }).eq('id', id); 
  }

  async updateProfilePrices(aid: string | null, profile: string, price: number, actor: UserProfile): Promise<number> {
    if (!this.isConfigured()) return 5;
    let query = client.from('tickets').update({ price }).eq('profile', profile).eq('status', TicketStatus.UNSOLD);
    if (actor.role !== UserRole.SUPER_ADMIN) { query = query.eq('agency_id', actor.agency_id); } 
    else if (aid && aid !== 'ALL') { query = query.eq('agency_id', aid); }

    const { data, error } = await query.select('id');
    if (error) throw error;
    const count = data?.length || 0;
    await this.log(actor, 'TICKET_UPDATE', `Mise à jour tarif profil ${profile} : ${price} (${count} tickets)`);
    return count;
  }

  async deleteTicket(id: string): Promise<void> { 
    if (!this.isConfigured()) return;
    await client.from('tickets').delete().eq('id', id); 
  }

  async cancelSale(id: string): Promise<void> {
    if (!this.isConfigured()) return;
    const { data } = await client.from('sales').select('ticket_id').eq('id', id).single();
    if (data?.ticket_id) {
      await client.from('tickets').update({ status: TicketStatus.UNSOLD, sold_by: null, sold_at: null }).eq('id', data.ticket_id);
      await client.from('sales').delete().eq('id', id);
    }
  }

  // ==========================================
  //  LECTURE DONNÉES (Getters)
  // ==========================================

  async getTickets(aid: string, role: UserRole): Promise<Ticket[]> {
    if (!this.isConfigured()) return MOCK_TICKETS;
    let q = client.from('tickets').select('*').order('created_at', { ascending: false });
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return (data as Ticket[]) || [];
  }

  async getSales(aid: string, role: UserRole): Promise<Sale[]> {
    if (!this.isConfigured()) return [];
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
  }

  async getUsers(aid: string, role: UserRole): Promise<UserProfile[]> {
    if (!this.isConfigured()) return [MOCK_USER];
    let q = client.from('profiles').select('*');
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return (data as UserProfile[]) || [];
  }

  async getLogs(aid: string, role: UserRole): Promise<ActivityLog[]> {
    if (!this.isConfigured()) return [];
    let q = client.from('logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (role !== UserRole.SUPER_ADMIN) q = q.eq('agency_id', aid);
    const { data } = await q;
    return (data as ActivityLog[]) || [];
  }

  // ==========================================
  //  ADMINISTRATION UTILISATEURS
  // ==========================================

  async addUser(userData: Partial<UserProfile> & { password?: string, pin?: string }): Promise<void> { 
    if (!this.isConfigured()) return;
    if (userData.email) {
      const { data: existing } = await client.from('profiles').select('id').eq('email', userData.email).single();
      if (existing) throw new Error("Cet email est déjà utilisé.");
    }
    const { error } = await client.from('profiles').insert({ 
      ...userData, 
      display_name: userData.email?.split('@')[0] || 'User' 
    });
    if (error) throw error;
  }

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    if (!this.isConfigured()) return;
    await client.from('profiles').update({ role }).eq('id', uid);
  }

  async updatePassword(uid: string, password: string, actor: UserProfile): Promise<boolean> { 
    if (!this.isConfigured()) return true;
    const isSelf = uid === actor.id;
    const isAuthorized = actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.ADMIN;
    if (!isSelf && !isAuthorized) { return false; }
    const { error } = await client.from('profiles').update({ password }).eq('id', uid);
    if (error) return false;
    await this.log(actor, 'PASSWORD_CHANGE', `Modification MDP pour ${uid}`);
    return true; 
  }

  async updateUserEmail(uid: string, newEmail: string, actor: UserProfile): Promise<boolean> {
    if (!this.isConfigured()) return true;
    if (actor.role === UserRole.SELLER) return false;
    const { data: existing } = await client.from('profiles').select('id').eq('email', newEmail).single();
    if (existing && existing.id !== uid) return false;
    const { error } = await client.from('profiles').update({ email: newEmail }).eq('id', uid);
    if (error) return false;
    await this.log(actor, 'USER_UPDATE', `Email modifié pour ${uid}`);
    return true;
  }

  async addCredits(aid: string, amount: number, actorId: string, desc: string): Promise<void> {
    if (!this.isConfigured()) return;
    const { data: ag } = await client.from('agencies').select('credits_balance').eq('id', aid).single();
    const newBalance = (ag?.credits_balance || 0) + amount;
    await client.from('agencies').update({ credits_balance: newBalance }).eq('id', aid);
    await client.from('credit_transactions').insert({ agency_id: aid, amount, type: 'RECHARGE', description: desc, created_by: actorId });
  }
}

export const supabase = new SupabaseService();