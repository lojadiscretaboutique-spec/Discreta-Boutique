import Dexie, { EntityTable } from 'dexie';

export interface Order {
  id: string;
  [key: string]: any; // Relaxed type for now to store full order document
}

export interface PendingSync {
  id?: number;
  type: 'update_status' | 'update_location' | 'add_payment' | 'delivery_proof';
  data: any;
  timestamp: number;
}

interface OfflineDb extends Dexie {
  orders: EntityTable<Order, 'id'>;
  pendingSync: EntityTable<PendingSync, 'id'>;
  userConfig: EntityTable<{ id: string; [key: string]: any }, 'id'>;
}

export const offlineDb = new Dexie('DiscretaMotoboyDB') as OfflineDb;

offlineDb.version(1).stores({
  orders: 'id',
  pendingSync: '++id, type, timestamp',
  userConfig: 'id'
});
