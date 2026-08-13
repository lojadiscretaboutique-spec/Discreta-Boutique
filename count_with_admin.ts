import { getAdminDb } from './src/server/lib/firebaseAdmin.ts';

async function main() {
  try {
    const db = getAdminDb();
    if (!db) {
      console.log("Failed to load db");
      return;
    }
    const collections = ['products', 'categories', 'orders', 'stockMovements', 'purchases', 'users'];
    for (const col of collections) {
      const snapshot = await db.collection(col).count().get();
      console.log(`[DATACOUNT] ${col}: ${snapshot.data().count}`);
    }
  } catch (error: any) {
    console.error("Error executing query:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

main();
