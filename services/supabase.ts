import { createClient } from '@supabase/supabase-js';
import { UserRole, TicketStatus, UserProfile, Ticket, Sale, ActivityLog, Agency, AgencyStatus, AgencyModules, Task, AgencySettings } from '../types';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://gqenaxalqkdaoylhwzoq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ndkp28zh6qF0Ixm740HD4g_V-1Ew2vw';

// NOTE DE SECURITÉ : On n'utilise JAMAIS la "Secret API Key" (service_role) côté client (navigateur).
// Elle donnerait tous les droits à n'importe qui. On utilise uniquement la clé publique (Anon Key).

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_MODULES: AgencyModules = {
  dashboard: true,
  sales: true,
  history: true,
  tickets: true,
  team: true,
  tasks: true
};

class SupabaseService {
  
  // --- AUTHENTIFICATION (Basée sur la table profiles customisée) ---
  
  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    try {
      // Note: Pour une sécurité optimale en prod, migrez vers supabase.auth.signInWithPassword
      // Ici on garde votre logique personnalisée basée sur la table 'profiles'
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('password', password) // Comparaison directe (Hashage recommandé en prod)
        .single();

      if (error || !data) {
        console.error('Login error:', error);
        return null;
      }

      const { password: _, pin, ...safeUser } = data;
      this.log({ ...safeUser, agency_id: data.agency_id }, 'LOGIN', 'Connexion réussie');
      return safeUser as UserProfile;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async signOut(user: UserProfile): Promise<void> {
    await this.log(user, 'LOGOUT', 'Déconnexion du système');
    // Si on utilisait Supabase Auth: await client.auth.signOut();
  }

  async verifyPin(userId: string, pinAttempt: string): Promise<boolean> {
    const { data } = await client
      .from('profiles')
      .select('pin')
      .eq('id', userId)
      .single();
    
    return data?.pin === pinAttempt;
  }

  // --- LOGGING ---

  private async log(user: {id: string, display_name: string, agency_id: string}, action: string, details: string) {
    await client.from('logs').insert({
      user_id: user.id,
      user_name: user.display_name,
      agency_id: user.agency_id,
      action,
      details,
      created_at: new Date().toISOString()
    });
  }

  async getLogs(agencyId: string, role: UserRole): Promise<ActivityLog[]> {
    let query = client.from('logs').select('*').order('created_at', { ascending: false }).limit(100);
    
    if (role !== UserRole.SUPER_ADMIN) {
      query = query.eq('agency_id', agencyId);
    }
    
    const { data } = await query;
    return (data as ActivityLog[]) || [];
  }

  // --- TICKETS ---

  async getTickets(agencyId: string, role: UserRole): Promise<Ticket[]> {
    let query = client.from('tickets').select('*');
    
    if (role !== UserRole.SUPER_ADMIN) {
      query = query.eq('agency_id', agencyId);
    }
    
    const { data } = await query;
    return (data as Ticket[]) || [];
  }

  async importTickets(tickets: Partial<Ticket>[], userId: string, agencyId: string): Promise<{ success: number; errors: number }> {
    // Nettoyage préalable : on garde seulement les entrées avec username
    const validTickets = tickets.filter(t => t.username);
    const usernames = validTickets.map(t => t.username!);

    // Vérification des doublons par lots (Batching)
    const BATCH_SIZE = 500;
    const existingSet = new Set<string>();

    for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
        const chunk = usernames.slice(i, i + BATCH_SIZE);
        if (chunk.length === 0) continue;
        
        const { data, error } = await client
            .from('tickets')
            .select('username')
            .in('username', chunk)
            .eq('agency_id', agencyId);
            
        if (!error && data) {
            data.forEach((t: any) => existingSet.add(t.username));
        }
    }

    // Préparation des données à insérer
    const toInsert = validTickets
      .filter(t => !existingSet.has(t.username!))
      .map(t => {
        // Gestion robuste de la date d'expiration
        let validExpireAt = null;
        if (t.expire_at) {
            const d = new Date(t.expire_at);
            if (!isNaN(d.getTime())) {
                validExpireAt = d.toISOString();
            }
        }
        
        // CORRECTION ERROR 22003 (Numeric Overflow)
        // La BDD est en numeric(10,2), max = 99,999,999.99
        let safePrice = 0;
        if (typeof t.price === 'number' && !isNaN(t.price)) {
            // On cap à 99 millions pour éviter le crash si erreur de parsing (ex: code barre lu comme prix)
            safePrice = Math.min(Math.abs(t.price), 99999999); 
        }

        return {
            username: t.username,
            password: t.password || '',
            profile: t.profile || 'Default',
            time_limit: t.time_limit || '0',
            price: safePrice,
            expire_at: validExpireAt,
            status: TicketStatus.UNSOLD,
            agency_id: agencyId,
            created_by: userId,
            created_at: new Date().toISOString()
        };
      });

    // Insertion par lots
    let successCount = 0;
    let insertErrors = 0;

    if (toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
            const chunk = toInsert.slice(i, i + BATCH_SIZE);
            const { error } = await client.from('tickets').insert(chunk);
            
            if (error) {
                console.error('Erreur insertion batch:', error);
                insertErrors += chunk.length;
            } else {
                successCount += chunk.length;
            }
        }

        // Log seulement si succès partiel ou total
        if (successCount > 0) {
             const { data: userData } = await client.from('profiles').select('display_name').eq('id', userId).single();
             if (userData) {
                 this.log(
                     { id: userId, display_name: userData.display_name, agency_id: agencyId }, 
                     'TICKET_IMPORT', 
                     `Import de ${successCount} tickets`
                 );
             }
        }
    }

    // Total erreurs = (total entrées - insérés avec succès)
    return { 
      success: successCount, 
      errors: validTickets.length - successCount 
    };
  }

  async updateTicketPrice(ticketId: string, newPrice: number): Promise<boolean> {
    // Sécurité aussi pour la mise à jour manuelle
    const safePrice = Math.min(Math.abs(newPrice), 99999999);
    
    const { error } = await client
      .from('tickets')
      .update({ price: safePrice })
      .eq('id', ticketId);
    return !error;
  }
  
  async updateProfilePrices(agencyId: string, profile: string, newPrice: number): Promise<number> {
    // Sécurité aussi pour la mise à jour de masse
    const safePrice = Math.min(Math.abs(newPrice), 99999999);

    const { data, error } = await client
      .from('tickets')
      .update({ price: safePrice })
      .eq('agency_id', agencyId)
      .eq('profile', profile)
      .eq('status', TicketStatus.UNSOLD)
      .select(); // Pour savoir combien ont été modifiés

    if (!error) {
         this.log({id: 'system', display_name: 'Système', agency_id: agencyId}, 'TICKET_UPDATE', `Mise à jour prix profil ${profile} à ${safePrice}`);
    }
    
    return data?.length || 0;
  }

  async deleteTicket(ticketId: string): Promise<boolean> {
    // Récupérer infos pour le log avant suppression
    const { data: ticket } = await client.from('tickets').select('*').eq('id', ticketId).single();
    
    const { error } = await client.from('tickets').delete().eq('id', ticketId);
    
    if (!error && ticket) {
         this.log({id: 'system', display_name: 'Système', agency_id: ticket.agency_id}, 'TICKET_DELETE', `Suppression ticket ${ticket.username}`);
    }
    return !error;
  }

  // --- VENTES ---

  async sellTicket(ticketId: string, sellerId: string, agencyId: string, phone?: string): Promise<Sale | null> {
    // 1. Récupérer le ticket et vérifier
    const { data: ticket } = await client
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('status', TicketStatus.UNSOLD)
        .single();

    if (!ticket) return null;

    const { data: seller } = await client.from('profiles').select('*').eq('id', sellerId).single();
    
    // 2. Mettre à jour le ticket
    const now = new Date().toISOString();
    const { error: updateError } = await client
        .from('tickets')
        .update({ 
            status: TicketStatus.SOLD,
            sold_by: sellerId,
            sold_at: now
        })
        .eq('id', ticketId);

    if (updateError) return null;

    // 3. Créer la vente
    // CORRECTION CRITIQUE : On ne stocke QUE les IDs et le montant dans 'sales'.
    // Les colonnes ticket_username, ticket_profile, etc. sont supprimées de l'insert
    // car elles n'existent pas dans la BDD, ce qui causait l'erreur [object Object].
    const saleData = {
        ticket_id: ticketId,
        agency_id: agencyId,
        seller_id: sellerId,
        amount: ticket.price,
        sold_at: now,
        payment_method: 'CASH',
        customer_phone: phone
    };

    const { data: sale, error: saleError } = await client
        .from('sales')
        .insert(saleData)
        .select()
        .single();

    if (saleError) {
        console.error("Erreur création vente (Détails):", JSON.stringify(saleError));
        // En cas d'erreur critique, on essaie d'annuler la mise à jour du ticket (Rollback manuel)
        await client.from('tickets').update({ status: TicketStatus.UNSOLD, sold_by: null, sold_at: null }).eq('id', ticketId);
        return null;
    }

    if (seller) {
        this.log(seller, 'SALE', `Vente ticket ${ticket.username} (${ticket.profile})`);
    }

    // On retourne un objet Sale complet pour l'UI, en combinant les données insérées et les données du ticket qu'on a déjà
    return {
        ...sale,
        seller_name: seller?.display_name || 'Inconnu',
        agency_name: '...', // Pas critique pour l'instant T
        ticket_username: ticket.username,
        ticket_profile: ticket.profile,
        ticket_time_limit: ticket.time_limit
    } as Sale;
  }

  async cancelSale(saleId: string): Promise<boolean> {
    // 1. Récupérer la vente
    const { data: sale } = await client.from('sales').select('*').eq('id', saleId).single();
    if (!sale) return false;

    // 2. Remettre le ticket en stock
    if (sale.ticket_id) {
        await client.from('tickets').update({
            status: TicketStatus.UNSOLD,
            sold_by: null,
            sold_at: null
        }).eq('id', sale.ticket_id);
    }

    // 3. Supprimer la vente
    await client.from('sales').delete().eq('id', saleId);

    this.log({id: 'admin', display_name: 'Admin', agency_id: sale.agency_id}, 'SALE_CANCEL', `Annulation vente ID ${saleId}`);
    return true;
  }

  async getSales(agencyId: string, role: UserRole): Promise<Sale[]> {
    // CORRECTION : On récupère les infos du ticket (username, profile) via la relation `tickets`.
    // Cela remplace les colonnes "vides" de la table sales et évite les erreurs de données manquantes.
    let query = client
        .from('sales')
        .select(`
            *, 
            profiles:seller_id(display_name), 
            agencies:agency_id(name),
            tickets:ticket_id(username, profile, time_limit)
        `)
        .order('sold_at', { ascending: false });

    if (role !== UserRole.SUPER_ADMIN) {
      query = query.eq('agency_id', agencyId);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error("Erreur lecture ventes:", error);
        return [];
    }
    
    if (!data) return [];

    // Mapping pour aplatir la structure retournée par Supabase
    return data.map((s: any) => ({
        ...s,
        seller_name: s.profiles?.display_name || 'Inconnu',
        agency_name: s.agencies?.name || 'Inconnue',
        // Fallback: si le ticket a été supprimé physiquement (rare), on gère le null
        ticket_username: s.tickets?.username || 'Ticket Inconnu',
        ticket_profile: s.tickets?.profile || 'N/A',
        ticket_time_limit: s.tickets?.time_limit || 'N/A'
    })) as Sale[];
  }

  // --- STATS ---
  
  async getStats(agencyId: string, role: UserRole) {
    // Note: Pour de la grosse prod, utiliser des RPC (Stored Procedures) pour les stats
    const isSuper = role === UserRole.SUPER_ADMIN;
    
    // Récupérer les données brutes (Attention performance si beaucoup de données)
    let salesQuery = client.from('sales').select('amount, agency_id');
    let ticketsQuery = client.from('tickets').select('status, agency_id');
    let usersQuery = client.from('profiles').select('id, agency_id, role');
    let agenciesQuery = client.from('agencies').select('id, settings');

    if (!isSuper) {
        salesQuery = salesQuery.eq('agency_id', agencyId);
        ticketsQuery = ticketsQuery.eq('agency_id', agencyId);
        usersQuery = usersQuery.eq('agency_id', agencyId);
    }

    const [salesRes, ticketsRes, usersRes, agencyRes] = await Promise.all([
        salesQuery, ticketsQuery, usersQuery, 
        isSuper ? agenciesQuery : client.from('agencies').select('settings').eq('id', agencyId).single()
    ]);

    const sales = salesRes.data || [];
    const tickets = ticketsRes.data || [];
    const users = usersRes.data || [];
    const agencies = isSuper ? (agencyRes.data || []) : [];
    const currentAgency = isSuper ? null : agencyRes.data;

    return {
      revenue: sales.reduce((sum: number, s: any) => sum + s.amount, 0),
      soldCount: sales.length,
      stockCount: tickets.filter((t: any) => t.status === TicketStatus.UNSOLD).length,
      agencyCount: isSuper ? agencies.length : 1,
      userCount: users.length,
      currency: (isSuper ? 'GNF' : (currentAgency as any)?.settings?.currency) || 'GNF'
    };
  }

  // --- AGENCES ---

  async getAgencies(): Promise<Agency[]> {
    const { data } = await client.from('agencies').select('*').order('created_at');
    return (data as Agency[]) || [];
  }

  async getAgency(id: string): Promise<Agency | null> {
    const { data } = await client.from('agencies').select('*').eq('id', id).single();
    return data as Agency;
  }

  async addAgency(name: string): Promise<Agency> {
    const newAgency = {
      name,
      status: 'active',
      settings: {
        currency: 'GNF',
        whatsapp_receipt_header: `*REÇU WIFI ${name.toUpperCase()}*`,
        contact_phone: '',
        modules: { ...DEFAULT_MODULES }
      }
    };
    
    const { data, error } = await client.from('agencies').insert(newAgency).select().single();
    
    if (!error && data) {
         this.log({id: 'super_admin', display_name: 'Super Admin', agency_id: data.id}, 'AGENCY_CREATE', `Création agence: ${name}`);
         return data as Agency;
    }
    throw error;
  }

  async deleteAgency(id: string): Promise<void> {
    await client.from('agencies').delete().eq('id', id);
  }

  async updateAgency(id: string, name: string, settings: Partial<AgencySettings>, status?: AgencyStatus): Promise<void> {
    const updates: any = { name, settings };
    if (status) updates.status = status;

    await client.from('agencies').update(updates).eq('id', id);
    
    this.log({id: 'super_admin', display_name: 'Super Admin', agency_id: id}, 'AGENCY_UPDATE', `Modif agence: ${name}`);
  }

  // --- UTILISATEURS ---

  async getUsers(agencyId: string, role: UserRole): Promise<UserProfile[]> {
    let query = client.from('profiles').select('*');
    
    if (role !== UserRole.SUPER_ADMIN) {
      query = query.eq('agency_id', agencyId).neq('role', UserRole.SUPER_ADMIN);
    } else {
        // Super admin voit tout le monde sauf les mots de passe (déjà filtré par select mais on est prudent)
    }
    
    const { data } = await query;
    return (data?.map(({password, pin, ...u}) => u) as UserProfile[]) || [];
  }

  async addUser(user: Partial<UserProfile> & {password?: string, pin?: string}): Promise<UserProfile> {
    const newUser = {
      email: user.email,
      password: user.password || '123456',
      pin: user.pin || '0000',
      role: user.role || UserRole.SELLER,
      agency_id: user.agency_id,
      display_name: user.email?.split('@')[0] || 'User',
    };
    
    const { data, error } = await client.from('profiles').insert(newUser).select().single();
    
    if (error) throw error;
    
    this.log({id: 'admin', display_name: 'Admin', agency_id: user.agency_id || ''}, 'USER_CREATE', `Création collaborateur: ${newUser.display_name}`);

    const { password: _, pin, ...safeUser } = data;
    return safeUser as UserProfile;
  }

  async updateUserRole(userId: string, newRole: UserRole): Promise<boolean> {
    const { error } = await client.from('profiles').update({ role: newRole }).eq('id', userId);
    return !error;
  }
}

export const supabase = new SupabaseService();
