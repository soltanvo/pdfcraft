import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import defaultFirebaseConfig from '../../../firebase-applet-config.json';

const envApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
const envStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
const envMessagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
const envAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();

const hasEnvApiKey = Boolean(envApiKey);

const firebaseConfig: FirebaseOptions = hasEnvApiKey
  ? {
      apiKey: envApiKey,
      authDomain: 'as-pdf-78355.firebaseapp.com',
      projectId: 'as-pdf-78355',
      storageBucket: envStorageBucket || 'as-pdf-78355.firebasestorage.app',
      ...(envMessagingSenderId ? { messagingSenderId: envMessagingSenderId } : {}),
      ...(envAppId ? { appId: envAppId } : {}),
    }
  : {
      apiKey: defaultFirebaseConfig.apiKey,
      authDomain: defaultFirebaseConfig.authDomain,
      projectId: defaultFirebaseConfig.projectId,
      storageBucket: defaultFirebaseConfig.storageBucket,
      messagingSenderId: defaultFirebaseConfig.messagingSenderId,
      appId: defaultFirebaseConfig.appId,
    };

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);

// Use default Firestore DB for as-pdf-78355 when env API key is set; use provisioned DB ID for fallback project config
export const db: Firestore = hasEnvApiKey
  ? getFirestore(firebaseApp)
  : getFirestore(firebaseApp, defaultFirebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested || typeof window === 'undefined') return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
