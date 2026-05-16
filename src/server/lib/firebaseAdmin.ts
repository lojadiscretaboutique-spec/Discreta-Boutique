import admin from 'firebase-admin';
import firebaseConfig from '../../../firebase-applet-config.json';

let adminDb: admin.firestore.Firestore | null = null;

export function getAdminDb() {
  if (!adminDb) {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    
    let adminApp: admin.app.App;
    
    // Check if any apps are already initialized
    if (admin.apps.length > 0) {
      // Find one that matches our project
      const existingApp = admin.apps.find(app => app?.options.projectId === projectId);
      if (existingApp) {
        adminApp = existingApp;
      } else {
        adminApp = admin.apps[0]!;
      }
    } else {
      // Initialize if none exist
      try {
        adminApp = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: projectId,
        });
      } catch (e) {
        console.error("[FirebaseAdmin] Failed to init with ADC, trying simple:", e);
        adminApp = admin.initializeApp({
          projectId: projectId,
        });
      }
    }
    
    try {
      // Very important: pass databaseId if not default
      adminDb = databaseId && databaseId !== '(default)' 
        ? adminApp.firestore(databaseId) 
        : adminApp.firestore();
      
      console.log(`[FirebaseAdmin] Firestore ready for project: ${adminApp.options.projectId} (DB: ${databaseId})`);
    } catch (e) {
      console.error("[FirebaseAdmin] Firestore instance error:", e);
      adminDb = admin.firestore();
    }
  }
  return adminDb;
}
