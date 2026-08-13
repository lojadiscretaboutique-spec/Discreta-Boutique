import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
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
export const app = initializeApp(typedConfig);

// Initialize Firestore with settings for better stability in sandboxed environments
const dbId = typedConfig.firestoreDatabaseId;
export const db = (dbId && dbId !== '(default)')
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, dbId)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

export const auth = getAuth(app);
export const storage = getStorage(app, typedConfig.storageBucket);

console.log("📍 [Firebase Client] App Project ID:", app.options.projectId);
console.log("📦 [Firestore Client] Initialized Database:", typedConfig.firestoreDatabaseId || '(default)');

