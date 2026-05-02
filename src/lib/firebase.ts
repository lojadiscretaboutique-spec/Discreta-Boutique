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

// Initialize Firebase
const app = initializeApp(typedConfig);

// Initialize Firestore with settings for better stability in sandboxed environments
// If we use firebaseConfig.firestoreDatabaseId it might point to a named database 
// where rules are not being deployed by the system. Defaulting to (default).
export const db = initializeFirestore(app, {
  databaseId: typedConfig.firestoreDatabaseId || '(default)',
  experimentalForceLongPolling: true,
});

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
