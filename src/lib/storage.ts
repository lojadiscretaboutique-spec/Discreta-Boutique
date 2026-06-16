import { getStorage } from 'firebase/storage';
import { app } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

interface FirebaseAppConfig {
  storageBucket?: string;
}

const typedConfig = firebaseConfig as FirebaseAppConfig;
export const storage = getStorage(app, typedConfig.storageBucket);
