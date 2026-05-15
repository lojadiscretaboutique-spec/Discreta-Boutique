import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Suprime warnings internos de conexão dociata do Firestore
setLogLevel('silent');

interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

const typedConfig = firebaseConfig as FirebaseAppConfig;

// Strict Project ID Enforcement
const EXPECTED_PROJECT_ID = "gen-lang-client-0000764233";
if (typedConfig.projectId !== EXPECTED_PROJECT_ID) {
  throw new Error(`CRITICAL: Firebase Project ID Mismatch. Found: ${typedConfig.projectId}, Expected: ${EXPECTED_PROJECT_ID}`);
}

// Initialize Firebase
console.log("🔥 [Firebase Client] Initializing with Project:", typedConfig.projectId);
const app = initializeApp(typedConfig);

// Initialize Firestore with settings for better stability in sandboxed environments
export const db = initializeFirestore(app, {
  databaseId: typedConfig.firestoreDatabaseId || '(default)',
  experimentalForceLongPolling: true,
});

console.log("📍 [Firebase Client] App Project ID:", app.options.projectId);
console.log("📦 [Firestore Client] Initialized Database:", typedConfig.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);
export const storage = getStorage(app, typedConfig.storageBucket);

async function checkConnection() {
  try {
    // Attempt a server-side fetch to verify connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: unknown) {
    const firestoreError = error as { message?: string, code?: string };
    
    // Permission denied or not-found on test/connection means we reached the server
    if (firestoreError?.code === 'not-found' || firestoreError?.code === 'permission-denied') {
      return;
    }

    if (firestoreError?.message?.includes('offline')) {
      console.warn("⚠️ Firebase: Estado offline detectado.");
    } else {
      console.error("❌ Firebase: Erro de conexão:", firestoreError?.code || firestoreError?.message);
    }
  }
}

checkConnection();
