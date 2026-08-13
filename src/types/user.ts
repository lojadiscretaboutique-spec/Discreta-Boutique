export type UserStatus = 'ativo' | 'bloqueado' | 'inativo';

export type SystemRole = 'admin' | 'owner' | 'manager' | 'cashier' | 'employee' | 'customer' | 'motoboy' | string;

export interface UserProfile {
  id?: string;
  uid?: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  cpf?: string;
  avatarUrl?: string;
  notes?: string;
  address?: {
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    reference?: string;
  };
  addresses?: any[];

  role?: SystemRole; // Main role or legacy role
  roles?: string[]; // Array of roleIds or role names
  active?: boolean;
  status?: UserStatus;

  permissions?: Record<string, Record<string, boolean> | boolean>;
  computedPermissions?: Record<string, Record<string, boolean>>;
  individualPermissions?: Record<string, Record<string, boolean>>;

  favorites?: string[]; // Array of favorite product IDs

  storeId?: string;
  companyId?: string;

  createdAt?: any;
  updatedAt?: any;
  lastLoginAt?: any;
  lastIp?: string;

  commission?: number;

  // Authorization for PDV discounts & PIN
  canAuthorizeDiscounts?: boolean;
  useRoleDefaultLimits?: boolean;
  customMaxPercent?: number | null;
  customMaxAmount?: number | null;
  pinHash?: string | null;
  pinActive?: boolean;
  pinLocked?: boolean;
  pinUpdatedAt?: any;
  pinFailedAttempts?: number;
  pinLockoutUntil?: any;
}

export const DISCRETA_ROLES = {
  ADMIN: 'admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  EMPLOYEE: 'employee',
  CUSTOMER: 'customer',
  MOTOBOY: 'motoboy',
} as const;
