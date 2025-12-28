
import { UserRole, TicketStatus, UserProfile, Ticket, Sale, ActivityLog, Agency, AgencyStatus, AgencyModules, Task, AgencySettings } from '../types';

const STORAGE_KEY = 'wifiproximite_data';

// Extension interne pour la DB (ne pas exposer Password/PIN dans les types publics)
interface DBUser extends UserProfile {
  password?: string;
  pin?: string;
}

interface Database {
  users: DBUser[];
  tickets: Ticket[];
  sales: Sale[];
  logs: ActivityLog[];
  agencies: Agency[];
  tasks: Task[];
}

const DEFAULT_MODULES: AgencyModules = {
  dashboard: true,
  sales: true,
  history: true,
  tickets: true,
  team: true,
  tasks: true
};

class MockSupabase {
  private data: Database;

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      this.data = JSON.parse(saved);
      if (!this.data.tasks) this.data.tasks = [];
      if (!this.data.logs) this.data.logs = [];
    } else {
      this.data = this.initializeDefaultData();
      this.save();
    }
  }

  private initializeDefaultData(): Database {
    const agency1Id = 'agency_1';
    const agency2Id = 'agency_2';
    const superAdminId = 'user_super';
    return {
      agencies: [
        { 
          id: agency1Id, 
          name: 'Wifi Proximité Kaloum', 
          status: 'active',
          created_at: new Date().toISOString(),
          settings: {
            currency: 'GNF',
            whatsapp_receipt_header: '*REÇU WIFI PROXIMITÉ*',
            contact_phone: '',
            modules: { ...DEFAULT_MODULES }
          }
        },
        { 
          id: agency2Id, 
          name: 'Wifi Proximité Dixinn', 
          status: 'active',
          created_at: new Date().toISOString(),
          settings: {
            currency: 'GNF',
            whatsapp_receipt_header: '*REÇU WIFI DIXINN*',
            contact_phone: '',
            modules: { ...DEFAULT_MODULES }
          }
        }
      ],
      users: [
        { 
          id: superAdminId, 
          email: 'admin@wifiproximite.com', 
          password: 'admin',
          pin: '1234',
          role: UserRole.SUPER_ADMIN, 
          agency_id: agency1Id, 
          display_name: 'Super Admin',
          created_at: new Date().toISOString()
        },
        { 
          id: 'user_admin', 
          email: 'admin@kaloum.com',
          password: '123456', 
          pin: '0000',
          role: UserRole.ADMIN, 
          agency_id: agency1Id, 
          display_name: 'Admin Kaloum',
          created_at: new Date().toISOString()
        },
        { 
          id: 'user_seller', 
          email: 'vendeur@kaloum.com',
          password: '123456', 
          pin: '0000',
          role: UserRole.SELLER, 
          agency_id: agency1Id, 
          display_name: 'Vendeur K1',
          created_at: new Date().toISOString()
        }
      ],
      tickets: [],
      sales: [],
      logs: [],
      tasks: [
        {
          id: 'task_1',
          title: 'Vérifier le stock de tickets',
          description: 'Il ne reste que 10 tickets VIP.',
          status: 'TODO',
          priority: 'HIGH',
          agency_id: agency1Id,
          created_by: 'user_admin',
          created_at: new Date().toISOString(),
          assigned_to: 'user_seller',
          assigned_to_name: 'Vendeur K1'
        }
      ]
    };
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  // --- LOGGING ---
  private log(user: UserProfile | {id: string, display_name: string, agency_id: string}, action: string, details: string) {
    this.data.logs.unshift({
      id: Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      user_name: user.display_name,
      agency_id: user.agency_id,
      action,
      details,
      created_at: new Date().toISOString()
    });
    if (this.data.logs.length > 200) {
        this.data.logs = this.data.logs.slice(0, 200);
    }
    this.save();
  }

  async getLogs(agencyId: string, role: UserRole): Promise<ActivityLog[]> {
    if (role === UserRole.SUPER_ADMIN) {
        return this.data.logs;
    }
    return this.data.logs.filter(l => l.agency_id === agencyId);
  }

  // --- AUTHENTIFICATION ---

  async signIn(email: string, password?: string): Promise<UserProfile | null> {
    await new Promise(r => setTimeout(r, 800));
    const user = this.data.users.find(u => 
      u.email.toLowerCase() === email.toLowerCase() && 
      (password ? u.password === password : true)
    );
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, pin, ...safeUser } = user;
      this.log(safeUser, 'LOGIN', 'Connexion réussie');
      return safeUser;
    }
    return null;
  }

  async signOut(user: UserProfile): Promise<void> {
      this.log(user, 'LOGOUT', 'Déconnexion du système');
  }

  async verifyPin(userId: string, pinAttempt: string): Promise<boolean> {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return false;
    return user.pin === pinAttempt;
  }

  // --- TÂCHES ---

  async getTasks(agencyId: string, userId: string, role: UserRole): Promise<Task[]> {
    if (role === UserRole.SUPER_ADMIN) return this.data.tasks;
    if (role === UserRole.ADMIN) {
      return this.data.tasks.filter(t => t.agency_id === agencyId);
    }
    return this.data.tasks.filter(t => 
      t.agency_id === agencyId && 
      (!t.assigned_to || t.assigned_to === userId)
    );
  }

  async addTask(task: Partial<Task>, creator: UserProfile): Promise<Task> {
    const newTask: Task = {
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      title: task.title || 'Nouvelle tâche',
      description: task.description || '',
      status: 'TODO',
      priority: task.priority || 'MEDIUM',
      assigned_to: task.assigned_to,
      assigned_to_name: task.assigned_to ? this.data.users.find(u => u.id === task.assigned_to)?.display_name : undefined,
      agency_id: creator.agency_id,
      due_date: task.due_date,
      created_by: creator.id,
      created_at: new Date().toISOString()
    };

    this.data.tasks.push(newTask);
    this.log(creator, 'TASK_CREATED', `Création tâche: ${newTask.title}`);
    this.save();
    return newTask;
  }

  async updateTaskStatus(taskId: string, status: Task['status'], user: UserProfile): Promise<boolean> {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task) return false;
    
    task.status = status;
    this.log(user, 'TASK_UPDATE', `Tâche "${task.title}" passée en ${status}`);
    this.save();
    return true;
  }

  async deleteTask(taskId: string, user: UserProfile): Promise<boolean> {
    const idx = this.data.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return false;
    
    const title = this.data.tasks[idx].title;
    this.data.tasks.splice(idx, 1);
    this.log(user, 'TASK_DELETE', `Suppression tâche: ${title}`);
    this.save();
    return true;
  }

  // --- TICKETS ---

  async getTickets(agencyId: string, role: UserRole): Promise<Ticket[]> {
    if (role === UserRole.SUPER_ADMIN) return this.data.tickets;
    return this.data.tickets.filter(t => t.agency_id === agencyId);
  }

  async importTickets(tickets: Partial<Ticket>[], userId: string, agencyId: string): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;
    const existingUsernames = new Set(this.data.tickets.filter(t => t.agency_id === agencyId).map(t => t.username));
    const newTickets: Ticket[] = [];

    for (const t of tickets) {
        if (!t.username) continue;
        if (existingUsernames.has(t.username)) { errors++; continue; }
        existingUsernames.add(t.username);
        success++;
        newTickets.push({
            id: Math.random().toString(36).substr(2, 9),
            username: t.username,
            password: t.password || '',
            profile: t.profile || 'Default',
            time_limit: t.time_limit || '0',
            price: t.price || 0,
            expire_at: t.expire_at,
            status: TicketStatus.UNSOLD,
            agency_id: agencyId,
            created_by: userId,
            created_at: new Date().toISOString()
        } as Ticket);
    }
    this.data.tickets.push(...newTickets);
    
    const user = this.data.users.find(u => u.id === userId);
    if (user) {
        this.log(user, 'TICKET_IMPORT', `Import de ${success} tickets`);
    }

    this.save();
    return { success, errors };
  }

  async updateTicketPrice(ticketId: string, newPrice: number): Promise<boolean> {
    const ticket = this.data.tickets.find(t => t.id === ticketId);
    if (!ticket) return false;
    ticket.price = newPrice;
    this.save();
    return true;
  }
  
  async updateProfilePrices(agencyId: string, profile: string, newPrice: number): Promise<number> {
    let count = 0;
    this.data.tickets.forEach(t => {
      if (t.agency_id === agencyId && t.profile === profile && t.status === TicketStatus.UNSOLD) {
        t.price = newPrice;
        count++;
      }
    });
    this.data.logs.unshift({
        id: Math.random().toString(36).substr(2, 9),
        user_id: 'system',
        user_name: 'Système/Admin',
        agency_id: agencyId,
        action: 'TICKET_UPDATE',
        details: `Mise à jour prix profil ${profile} à ${newPrice}`,
        created_at: new Date().toISOString()
    });
    
    this.save();
    return count;
  }

  async deleteTicket(ticketId: string): Promise<boolean> {
    const initialLength = this.data.tickets.length;
    const ticket = this.data.tickets.find(t => t.id === ticketId);
    
    if (ticket) {
        this.data.logs.unshift({
            id: Math.random().toString(36).substr(2, 9),
            user_id: 'system',
            user_name: 'Système/Admin',
            agency_id: ticket.agency_id,
            action: 'TICKET_DELETE',
            details: `Suppression ticket ${ticket.username}`,
            created_at: new Date().toISOString()
        });
    }

    this.data.tickets = this.data.tickets.filter(t => t.id !== ticketId);
    if (this.data.tickets.length < initialLength) {
        this.save();
        return true;
    }
    return false;
  }


  // --- VENTES ---

  async sellTicket(ticketId: string, sellerId: string, agencyId: string, phone?: string): Promise<Sale | null> {
    const ticketIdx = this.data.tickets.findIndex(t => t.id === ticketId && t.status === TicketStatus.UNSOLD);
    if (ticketIdx === -1) return null;

    const ticket = this.data.tickets[ticketIdx];
    if (ticket.agency_id !== agencyId) return null;

    const seller = this.data.users.find(u => u.id === sellerId);
    const agency = this.data.agencies.find(a => a.id === agencyId);

    ticket.status = TicketStatus.SOLD;
    ticket.sold_by = sellerId;
    ticket.sold_at = new Date().toISOString();

    const sale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      ticket_id: ticketId,
      ticket_username: ticket.username,
      ticket_profile: ticket.profile,
      ticket_time_limit: ticket.time_limit,
      seller_id: sellerId,
      seller_name: seller?.display_name || 'System',
      agency_id: agencyId,
      agency_name: agency?.name || 'Inconnue',
      amount: ticket.price,
      sold_at: new Date().toISOString(),
      payment_method: 'CASH',
      customer_phone: phone
    };

    this.data.sales.push(sale);
    
    if (seller) {
        this.log(seller, 'SALE', `Vente ticket ${ticket.username} (${ticket.profile})`);
    }

    this.save();
    return sale;
  }

  async cancelSale(saleId: string): Promise<boolean> {
    const saleIndex = this.data.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) return false;

    const sale = this.data.sales[saleIndex];
    const ticketIndex = this.data.tickets.findIndex(t => t.id === sale.ticket_id);
    
    if (ticketIndex !== -1) {
        const ticket = this.data.tickets[ticketIndex];
        ticket.status = TicketStatus.UNSOLD;
        ticket.sold_by = undefined;
        ticket.sold_at = undefined;
    }

    this.data.logs.unshift({
        id: Math.random().toString(36).substr(2, 9),
        user_id: 'admin', 
        user_name: 'Admin',
        agency_id: sale.agency_id,
        action: 'SALE_CANCEL',
        details: `Annulation vente ${sale.ticket_username}`,
        created_at: new Date().toISOString()
    });

    this.data.sales.splice(saleIndex, 1);
    this.save();
    return true;
  }

  async getSales(agencyId: string, role: UserRole): Promise<Sale[]> {
    if (role === UserRole.SUPER_ADMIN) return [...this.data.sales].reverse();
    return this.data.sales.filter(s => s.agency_id === agencyId).reverse();
  }

  // --- STATS ---
  getStats(agencyId: string, role: UserRole) {
    const isSuper = role === UserRole.SUPER_ADMIN;
    
    const sales = isSuper ? this.data.sales : this.data.sales.filter(s => s.agency_id === agencyId);
    const tickets = isSuper ? this.data.tickets : this.data.tickets.filter(t => t.agency_id === agencyId);
    const agency = this.data.agencies.find(a => a.id === agencyId);
    const users = isSuper 
      ? this.data.users 
      : this.data.users.filter(u => u.agency_id === agencyId && u.role !== UserRole.SUPER_ADMIN);

    return {
      revenue: sales.reduce((sum, s) => sum + s.amount, 0),
      soldCount: sales.length,
      stockCount: tickets.filter(t => t.status === TicketStatus.UNSOLD).length,
      agencyCount: this.data.agencies.length,
      userCount: users.length,
      currency: agency?.settings?.currency || 'GNF'
    };
  }

  // --- AGENCES ---

  async getAgencies(): Promise<Agency[]> {
    return this.data.agencies;
  }

  async getAgency(id: string): Promise<Agency | null> {
    return this.data.agencies.find(a => a.id === id) || null;
  }

  async addAgency(name: string): Promise<Agency> {
    const newAgency: Agency = {
      id: 'agency_' + Math.random().toString(36).substr(2, 9),
      name,
      status: 'active',
      created_at: new Date().toISOString(),
      settings: {
        currency: 'GNF',
        whatsapp_receipt_header: `*REÇU WIFI ${name.toUpperCase()}*`,
        contact_phone: '',
        modules: { ...DEFAULT_MODULES }
      }
    };
    this.data.agencies.push(newAgency);
    
    this.data.logs.unshift({
        id: Math.random().toString(36).substr(2, 9),
        user_id: 'super_admin',
        user_name: 'Super Admin',
        agency_id: newAgency.id,
        action: 'AGENCY_CREATE',
        details: `Création agence: ${name}`,
        created_at: new Date().toISOString()
    });

    this.save();
    return newAgency;
  }

  async deleteAgency(id: string): Promise<void> {
    const agency = this.data.agencies.find(a => a.id === id);
    if (agency) {
         this.data.logs.unshift({
            id: Math.random().toString(36).substr(2, 9),
            user_id: 'super_admin',
            user_name: 'Super Admin',
            agency_id: id, 
            action: 'AGENCY_DELETE',
            details: `Suppression agence: ${agency.name}`,
            created_at: new Date().toISOString()
        });
    }
    this.data.agencies = this.data.agencies.filter(a => a.id !== id);
    this.save();
  }

  async updateAgency(id: string, name: string, settings: Partial<AgencySettings>, status?: AgencyStatus): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const agency = this.data.agencies.find(a => a.id === id);
        if (agency) {
          agency.name = name;
          if (settings) agency.settings = { ...agency.settings, ...settings };
          if (status) agency.status = status;
          
          this.data.logs.unshift({
                id: Math.random().toString(36).substr(2, 9),
                user_id: 'super_admin',
                user_name: 'Super Admin',
                agency_id: id,
                action: 'AGENCY_UPDATE',
                details: `Modif agence: ${name} (Statut: ${status || agency.status})`,
                created_at: new Date().toISOString()
            });

          this.save();
        }
        resolve();
      }, 300);
    });
  }

  // --- UTILISATEURS ---

  async getUsers(agencyId: string, role: UserRole): Promise<UserProfile[]> {
    if (role === UserRole.SUPER_ADMIN) return this.data.users.map(({password, pin, ...u}) => u);
    return this.data.users
        .filter(u => u.agency_id === agencyId && u.role !== UserRole.SUPER_ADMIN)
        .map(({password, pin, ...u}) => u);
  }

  async addUser(user: Partial<DBUser>): Promise<UserProfile> {
    const newUser: DBUser = {
      id: Math.random().toString(36).substr(2, 9),
      email: user.email || '',
      password: user.password || '123456',
      pin: user.pin || '0000',
      role: user.role || UserRole.SELLER,
      agency_id: user.agency_id || 'agency_1',
      display_name: user.display_name || user.email?.split('@')[0] || 'User',
      created_at: new Date().toISOString()
    };
    this.data.users.push(newUser);
    
    this.data.logs.unshift({
        id: Math.random().toString(36).substr(2, 9),
        user_id: 'admin',
        user_name: 'Admin',
        agency_id: user.agency_id || 'agency_1',
        action: 'USER_CREATE',
        details: `Création collaborateur: ${newUser.display_name} (${newUser.role})`,
        created_at: new Date().toISOString()
    });

    this.save();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, pin, ...safeUser } = newUser;
    return safeUser;
  }

  async updateUserRole(userId: string, newRole: UserRole): Promise<boolean> {
    const user = this.data.users.find(u => u.id === userId);
    if (user) {
      user.role = newRole;
      
      this.data.logs.unshift({
        id: Math.random().toString(36).substr(2, 9),
        user_id: 'admin', 
        user_name: 'Admin',
        agency_id: user.agency_id,
        action: 'USER_UPDATE',
        details: `Modif rôle ${user.display_name} -> ${newRole}`,
        created_at: new Date().toISOString()
     });

      this.save();
      return true;
    }
    return false;
  }
}

export const supabase = new MockSupabase();
