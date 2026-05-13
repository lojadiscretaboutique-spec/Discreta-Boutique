import admin from 'firebase-admin';
import firebaseConfig from '../../../firebase-applet-config.json';

let adminDb: admin.firestore.Firestore | null = null;

export function getAdminDb() {
  if (!adminDb) {
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    
    if (admin.apps.length === 0) {
      try {
        admin.initializeApp({
          projectId: firebaseConfig.projectId,
        });
        console.log(`[FirebaseAdmin] Initialized for project: ${firebaseConfig.projectId}`);
      } catch (e) {
        console.error("[FirebaseAdmin] Initialization error:", e);
      }
    }
    
    try {
      if (databaseId && databaseId !== '(default)') {
        // @ts-expect-error - Named databases support
        adminDb = admin.firestore(databaseId);
      } else {
        adminDb = admin.firestore();
      }
      console.log(`[FirebaseAdmin] Firestore ready: ${databaseId}`);
    } catch (e) {
      console.error("[FirebaseAdmin] Firestore instance error:", e);
      adminDb = admin.firestore();
    }
  }
  return adminDb;
}
