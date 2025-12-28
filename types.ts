
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  SELLER = 'SELLER'
}

export enum TicketStatus {
  UNSOLD = 'UNSOLD',
  SOLD = 'SOLD',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED'
}

export type AgencyStatus = 'active' | 'inactive';

export interface AgencyModules {
  dashboard: boolean;
  sales: boolean;
  history: boolean;
  tickets: boolean;
  team: boolean;
  tasks: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  agency_id: string;
  display_name: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  username: string;
  password?: string;
  profile: string;
  time_limit: string;
  price: number;
  expire_at?: string;
  status: TicketStatus;
  agency_id: string;
  created_by: string;
  sold_by?: string;
  sold_at?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  ticket_id: string;
  ticket_username?: string;
  ticket_profile?: string;
  ticket_time_limit?: string;
  seller_id: string;
  seller_name?: string;
  agency_id: string;
  agency_name?: string;
  amount: number;
  sold_at: string;
  payment_method: 'CASH' | 'AUTOMATIC';
  customer_phone?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  assigned_to?: string;
  assigned_to_name?: string;
  agency_id: string;
  due_date?: string;
  created_by: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  agency_id: string;
  action: string;
  details: string;
  created_at: string;
}

export interface AgencySettings {
  whatsapp_receipt_header?: string;
  currency?: string;
  contact_phone?: string;
  modules?: AgencyModules;
}

export interface Agency {
  id: string;
  name: string;
  status: AgencyStatus;
  owner_id?: string;
  settings?: AgencySettings;
  created_at: string;
}
