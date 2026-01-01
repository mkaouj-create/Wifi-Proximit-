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

// Fonction utilitaire pour récupérer les variables d'environnement de manière sécurisée
const getSupabaseConfig = () => {
  try {
    // @ts-ignore
    const meta = import.meta;
    // @ts-ignore
    const env = meta && meta.env ? meta.env : {};
    return {
      // @ts-ignore
      url: env.VITE_SUPABASE_URL,
      // @ts-ignore
      key: env.VITE_SUPABASE_ANON_KEY
    };
  } catch (error) {
    console.warn("Erreur chargement env:", error);
    return { url: undefined, key: undefined };
  }
};

const { url: envUrl, key: envKey } = getSupabaseConfig();

// Configuration : Priorité aux variables d'environnement, sinon utilisation des clés fournies
const supabaseUrl = envUrl || 'https://gqenaxalqkdaoylhwzoq.supabase.co';
const supabaseKey = envKey || 'sb_publishable_ndkp28zh6qF0Ixm740HD4g_V-1Ew2vw';

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase non configuré. Vérifiez le fichier .env ou la configuration Vite.");
}

const client: SupabaseClient = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: { persistSession: false } // On gère la session manuellement via localStorage pour ce projet spécifique
  }
);

const TICKET_CREDIT_RATIO = 20; 

class SupabaseService {
  public isConfigured(): boolean {
    return !!supabaseUrl && !supabaseUrl.includes('placeholder');
  }

  private async log(user: Partial<UserProfile>, action: string, details: string): Promise<void> {
    if (!this.isConfigured()) return;
    // Exécution en tâche de fond pour ne pas bloquer l'UI
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

  // --- PLANS ---
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    if (!this.isConfigured()) return [];
    const { data } = await client.from('subscription_plans').select('*').order('order_index');
    return (data as SubscriptionPlan[]) || [];
  }

  async updateSubscriptionPlan(plan: Partial<SubscriptionPlan>, actor: UserProfile): Promise<void> {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Accès refusé");
    const { error } = await client.from('subscription_plans').upsert(plan);
    if (error) throw error;
    await this.log(actor, 'PLAN_UPDATE', `Plan ${plan.name} mis à jour`);
  }

  async deleteSubscriptionPlan(id: string, actor: UserProfile): Promise<void> {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Accès refusé");
    const { error } = await client.from('subscription_plans').delete().eq('id', id);
    if (error) throw error;
    await this.log(actor, 'PLAN_DELETE', `Plan ID ${id} supprimé`);
  }

  // --- ABONNEMENT & AGENCES ---
  public isSubscriptionActive(agency: Partial<Agency> | null): boolean {
    if (!agency || !agency.subscription_end) return false;
    return new Date(agency.subscription_end).getTime() > Date.now();
  }

  async getAgencies(): Promise<Agency[]> { 
    if (!this.isConfigured()) return [];
    const { data } = await client.from('agencies').select('*').order('name'); 
    return (data as Agency[]) || [];
  }

  async getAgency(id: string): Promise<Agency> { 
    if (!this.isConfigured()) throw new Error("Supabase non configuré");
    const { data } = await client.from('agencies').select('*').eq('id', id).single(); 
    return data as Agency;
  }

  async createAgency(name: string, actor: UserProfile): Promise<Agency> {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Accès refusé");
    const { data, error } = await client.from('agencies').insert({
      name,
      status: 'active',
      credits_balance: 50,
      plan_name: 'Trial',
      subscription_start: new Date().toISOString(),
      subscription_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 jours
      settings: {
        currency: 'GNF',
        modules: { dashboard: true, sales: true, history: true, tickets: true, team: true, tasks: true }
      }
    }).select().single();
    
    if (error) throw error;
    await this.log(actor, 'AGENCY_CREATE', `Agence ${name} créée`);
    return data as Agency;
  }

  async updateSubscription(aid: string, plan: string, months: number, actor: UserProfile): Promise<void> {
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

  // --- AUTH ---
  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    if (!this.isConfigured()) return null;
    
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
      return await this.signIn(email, password);
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

  // --- MÉTIER (STATS, TICKETS & VENTES) ---
  async getStats(aid: string, role: UserRole) {
    if (!this.isConfigured()) {
      return { revenue: 0, soldCount: 0, stockCount: 0, userCount: 0, agencyCount: 0, currency: 'GNF', credits: 0 };
    }

    const isSuper = role === UserRole.SUPER_ADMIN;
    
    // Requêtes parallèles optimisées
    const [salesRes, ticketsRes, profilesRes, agenciesRes] = await Promise.all([
      client.from('sales').select('amount').match(isSuper ? {} : { agency_id: aid }),
      client.from('tickets').select('status').match(isSuper ? {} : { agency_id: aid }),
      client.from('profiles').select('id', { count: 'exact', head: true }).match(isSuper ? {} : { agency_id: aid }),
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
      userCount: profilesRes.count || 0,
      agencyCount: isSuper ? (agenciesRes.data as Agency[]).length : 1,
      currency: (isSuper ? 'GNF' : (agenciesRes.data as Agency)?.settings?.currency) || 'GNF',
      credits: totalCredits
    };
  }

  async sellTicket(tid: string, sid: string, aid: string, phone?: string): Promise<Sale | null> {
    const { data: agency } = await client.from('agencies').select('subscription_end, settings').eq('id', aid).single();
    if (!this.isSubscriptionActive(agency as Partial<Agency>)) throw new Error("Abonnement expiré.");

    const { data: tk } = await client.from('tickets').select('*').eq('id', tid).eq('status', TicketStatus.UNSOLD).single();
    if (!tk) return null;

    const now = new Date().toISOString();
    
    const { error: updateError } = await client.from('tickets')
        .update({ status: TicketStatus.SOLD, sold_by: sid, sold_at: now })
        .eq('id', tid)
        .eq('status', TicketStatus.UNSOLD);

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

  async importTickets(ts: any[], uid: string, aid: string) {
    const { data: agency } = await client.from('agencies').select('*').eq('id', aid).single();
    if (!agency || !this.isSubscriptionActive(agency)) throw new Error('Abonnement inactif');

    const cost = Math.ceil(ts.length / TICKET_CREDIT_RATIO);
    if (agency.credits_balance < cost && agency.plan_name !== 'UNLIMITED') throw new Error(`Crédits insuffisants (Requis: ${cost}).`);

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
      settings: { ...agency.settings, total_tickets_ever: (agency.settings?.total_tickets_ever || 0) + toInsert.length }
    }).eq('id', aid);

    await client.from('credit_transactions').insert({
      agency_id: aid, amount: -cost, type: 'CONSUMPTION', description: `Import ${toInsert.length} tickets`, created_by: uid
    });

    return { success: toInsert.length, cost };
  }

  async addCredits(aid: string, amount: number, actorId: string, desc: string): Promise<void> {
    const { data: ag } = await client.from('agencies').select('credits_balance').eq('id', aid).single();
    await client.from('agencies').update({ credits_balance: (ag?.credits_balance || 0) + amount }).eq('id', aid);
    await client.from('credit_transactions').insert({ agency_id: aid, amount, type: 'RECHARGE', description: desc, created_by: actorId });
  }

  async getTickets(aid: string, role: UserRole): Promise<Ticket[]> {
    if (!this.isConfigured()) return [];
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
    if (!this.isConfigured()) return [];
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

  // --- SÉCURITÉ & RESTRICTIONS ---

  async updateAgency(id: string, name: string, settingsUpdate: Partial<AgencySettings>, actor?: UserProfile): Promise<void> {
    if (actor && actor.role === UserRole.SELLER) throw new Error("Accès interdit aux vendeurs.");
    
    // 1. Récupérer les settings actuels pour ne pas les écraser
    const { data: currentAgency } = await client.from('agencies').select('settings').eq('id', id).single();
    const currentSettings = currentAgency?.settings || {};

    // 2. Fusionner les nouveaux settings
    const mergedSettings = { ...currentSettings, ...settingsUpdate };

    // 3. Update
    const { error } = await client.from('agencies').update({ name, settings: mergedSettings }).eq('id', id);
    
    if (error) throw error;
    if (actor) await this.log(actor, 'AGENCY_UPDATE', `Mise à jour paramètres agence`);
  }

  async updateAgencyModules(id: string, modules: AgencyModules, actor: UserProfile): Promise<void> {
    if (actor.role === UserRole.SELLER) throw new Error("Accès interdit.");
    
    const { data: agency } = await client.from('agencies').select('settings').eq('id', id).single();
    const currentSettings = agency?.settings || {};
    
    await client.from('agencies').update({ settings: { ...currentSettings, modules } }).eq('id', id);
    await this.log(actor, 'AGENCY_MODULES', `Modules mis à jour pour ${id}`);
  }

  async setAgencyStatus(id: string, status: AgencyStatus, actor: UserProfile): Promise<void> {
    if (actor.role !== UserRole.SUPER_ADMIN) throw new Error("Accès refusé.");
    await client.from('agencies').update({ status }).eq('id', id);
    await this.log(actor, 'AGENCY_STATUS', `Agence ${id} -> ${status}`);
  }

  async addUser(userData: any): Promise<void> { 
    // Vérifier unicité email manuellement (simule contrainte unique si non définie en DB)
    const { data: existing } = await client.from('profiles').select('id').eq('email', userData.email).single();
    if (existing) throw new Error("Cet email est déjà utilisé.");

    const { error } = await client.from('profiles').insert({ ...userData, display_name: userData.email.split('@')[0] });
    if (error) throw error;
  }

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    await client.from('profiles').update({ role }).eq('id', uid);
  }

  async updatePassword(uid: string, password: string, actor: UserProfile): Promise<boolean> { 
    const isSelf = uid === actor.id;
    const isAuthorized = actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.ADMIN;

    if (!isSelf && !isAuthorized) {
      console.error("Tentative non autorisée de modification de mot de passe");
      return false;
    }

    const { error } = await client.from('profiles').update({ password }).eq('id', uid);
    if (error) return false;
    
    await this.log(actor, 'PASSWORD_CHANGE', `Profil ${uid} (Target)`);
    return true; 
  }

  async updateUserEmail(uid: string, newEmail: string, actor: UserProfile): Promise<boolean> {
    if (actor.role === UserRole.SELLER) return false;

    // Vérif unicité
    const { data: existing } = await client.from('profiles').select('id').eq('email', newEmail).single();
    if (existing && existing.id !== uid) return false; // Email pris par un autre

    const { error } = await client.from('profiles').update({ email: newEmail }).eq('id', uid);
    if (error) return false;

    await this.log(actor, 'USER_UPDATE', `Email modifié pour l'utilisateur ${uid}`);
    return true;
  }

  async deleteTicket(id: string): Promise<void> { await client.from('tickets').delete().eq('id', id); }

  async updateTicketPrice(id: string, price: number): Promise<void> { await client.from('tickets').update({ price }).eq('id', id); }

  async updateProfilePrices(aid: string | null, profile: string, price: number, actor: UserProfile): Promise<number> {
    let query = client.from('tickets')
      .update({ price })
      .eq('profile', profile)
      .eq('status', TicketStatus.UNSOLD);

    if (actor.role !== UserRole.SUPER_ADMIN) {
      query = query.eq('agency_id', actor.agency_id);
    } else if (aid && aid !== 'ALL') {
      query = query.eq('agency_id', aid);
    }

    const { data, error } = await query.select('id');
    if (error) throw error;

    const count = data?.length || 0;
    await this.log(actor, 'TICKET_UPDATE', `Mise à jour groupée profil ${profile} : ${price} (${count} tickets affectés)`);
    return count;
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
