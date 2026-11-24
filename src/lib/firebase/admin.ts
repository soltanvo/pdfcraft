import { getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import defaultFirebaseConfig from '../../../firebase-applet-config.json';

function sanitizeEnv(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

function resolveServerProjectId(): { projectId: string; databaseId?: string } {
  const customProjectId =
    sanitizeEnv(process.env.FIREBASE_PROJECT_ID) ||
    sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  if (customProjectId) {
    return { projectId: customProjectId };
  }

  if (sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)) {
    return { projectId: 'as-pdf-78355' };
  }

  const fallbackDbId = defaultFirebaseConfig.firestoreDatabaseId?.trim();
  return {
    projectId: defaultFirebaseConfig.projectId,
    databaseId: fallbackDbId && fallbackDbId !== '(default)' ? fallbackDbId : undefined,
  };
}

let cachedAdminApp: App | null = null;
let cachedAdminDb: Firestore | null = null;

export function getAdminFirestore(): Firestore {
  if (cachedAdminDb) return cachedAdminDb;

  const { projectId, databaseId } = resolveServerProjectId();
  cachedAdminApp =
    cachedAdminApp ||
    (getApps().length > 0 ? getApp() : initializeApp({ projectId }));

  cachedAdminDb = databaseId
    ? getFirestore(cachedAdminApp, databaseId)
    : getFirestore(cachedAdminApp);

  return cachedAdminDb;
}
