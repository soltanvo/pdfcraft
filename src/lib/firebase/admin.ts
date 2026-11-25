import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import defaultFirebaseConfig from '../../../firebase-applet-config.json';

function sanitizeEnv(value: string | undefined): string {
  if (!value) return '';
  let trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

interface RawServiceAccountJson {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key?: string;
  client_email?: string;
  client_id?: string;
  projectId?: string;
  privateKey?: string;
  clientEmail?: string;
}

function parseServiceAccountFromEnv(): ServiceAccount | null {
  const raw = sanitizeEnv(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  if (!raw) return null;

  let jsonText = raw;
  if (!jsonText.startsWith('{')) {
    try {
      const decoded = Buffer.from(jsonText, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) {
        jsonText = decoded;
      }
    } catch {
      // Keep original string for JSON.parse error reporting
    }
  }

  let parsed: RawServiceAccountJson;
  try {
    parsed = JSON.parse(jsonText) as RawServiceAccountJson;
  } catch (err) {
    throw new Error(
      `Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON: ${
        err instanceof Error ? err.message : 'parse error'
      }`
    );
  }

  const projectId = (parsed.project_id || parsed.projectId || '').trim();
  const clientEmail = (parsed.client_email || parsed.clientEmail || '').trim();
  const rawPrivateKey = parsed.private_key || parsed.privateKey || '';
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is missing required fields (project_id, client_email, private_key).'
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function resolveServerTarget(serviceAccount: ServiceAccount | null): {
  projectId: string;
  databaseId?: string;
} {
  const explicitDatabaseId = sanitizeEnv(process.env.FIREBASE_DATABASE_ID);
  const customProjectId =
    sanitizeEnv(process.env.FIREBASE_PROJECT_ID) ||
    sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  if (serviceAccount?.projectId) {
    return {
      projectId: customProjectId || serviceAccount.projectId,
      databaseId:
        explicitDatabaseId && explicitDatabaseId !== '(default)'
          ? explicitDatabaseId
          : undefined,
    };
  }

  if (customProjectId) {
    return {
      projectId: customProjectId,
      databaseId:
        explicitDatabaseId && explicitDatabaseId !== '(default)'
          ? explicitDatabaseId
          : undefined,
    };
  }

  if (sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)) {
    return {
      projectId: 'as-pdf-78355',
      databaseId:
        explicitDatabaseId && explicitDatabaseId !== '(default)'
          ? explicitDatabaseId
          : undefined,
    };
  }

  const fallbackDbId = defaultFirebaseConfig.firestoreDatabaseId?.trim();
  return {
    projectId: defaultFirebaseConfig.projectId,
    databaseId:
      explicitDatabaseId && explicitDatabaseId !== '(default)'
        ? explicitDatabaseId
        : fallbackDbId && fallbackDbId !== '(default)'
        ? fallbackDbId
        : undefined,
  };
}

let cachedAdminApp: App | null = null;
let cachedAdminDb: Firestore | null = null;

export function getAdminFirestore(): Firestore {
  if (cachedAdminDb) return cachedAdminDb;

  const serviceAccount = parseServiceAccountFromEnv();
  const { projectId, databaseId } = resolveServerTarget(serviceAccount);

  if (getApps().length > 0) {
    cachedAdminApp = getApp();
  } else if (serviceAccount) {
    cachedAdminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } else {
    cachedAdminApp = initializeApp({ projectId });
  }

  cachedAdminDb = databaseId
    ? getFirestore(cachedAdminApp, databaseId)
    : getFirestore(cachedAdminApp);

  return cachedAdminDb;
}
