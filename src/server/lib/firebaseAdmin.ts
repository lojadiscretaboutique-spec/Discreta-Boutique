import admin from 'firebase-admin';
import firebaseConfig from '../../../firebase-applet-config.json';

let adminDb: admin.firestore.Firestore | null = null;

export function getAdminDb() {
  const EXPECTED_PROJECT_ID = "gen-lang-client-0000764233";

  if (!adminDb) {
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    
    let adminApp: admin.app.App;
    try {
      // Try to get the existing named app first
      adminApp = admin.app('discreta-boutique-admin');
    } catch (e) {
      // If doesn't exist, initialize (this should happen in server.ts check)
      if (admin.apps.length === 0) {
          adminApp = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: EXPECTED_PROJECT_ID,
          }, 'discreta-boutique-admin');
      } else {
          adminApp = admin.app(); // fallback to default if present
      }
    }
    
    try {
      adminDb = adminApp.firestore();
      console.log(`[FirebaseAdmin] Firestore ready for project: ${adminApp.options.projectId}`);
    } catch (e) {
      console.error("[FirebaseAdmin] Firestore instance error:", e);
      adminDb = admin.firestore();
    }
  }
  return adminDb;
}
