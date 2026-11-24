'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '@/lib/firebase/config';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  credits: number;
  isPaid: boolean;
  plan?: 'free' | 'starter' | 'pro';
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'paused';
  paddleCustomerId?: string;
  paddleSubscriptionId?: string;
  lastOrderId?: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  credits: number;
  isPaid: boolean;
  loading: boolean;
  authBusy: boolean;
  error: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
  deductCredit: () => Promise<void>;
  addPaidCredits: (planId: 'starter' | 'pro', orderId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    const activeAuth = auth;
    const activeDb = db;

    void testFirestoreConnection();
    void getRedirectResult(activeAuth).catch((err: unknown) => {
      const code = (err as { code?: string })?.code;
      if (code && code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(err instanceof Error ? err.message : 'Google redirect sign-in failed');
      }
    });

    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(activeAuth, async (firebaseUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      setUser(firebaseUser);
      setError(null);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const userPath = `users/${firebaseUser.uid}`;
      const userRef = doc(activeDb, 'users', firebaseUser.uid);

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const initialDoc = {
            uid: firebaseUser.uid,
            email: (firebaseUser.email || '').slice(0, 320),
            displayName: (firebaseUser.displayName || 'SA AI User').slice(0, 120),
            photoURL: (firebaseUser.photoURL || '').slice(0, 1000),
            credits: 5,
            isPaid: false,
            plan: 'free',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, initialDoc);
        }
      } catch (err) {
        console.error('Failed to ensure user document:', err);
        try {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        } catch (wrapped) {
          setError(wrapped instanceof Error ? wrapped.message : 'Firestore setup failed');
        }
      }

      unsubscribeDoc = onSnapshot(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const plan =
              data.plan === 'starter' || data.plan === 'pro' || data.plan === 'free'
                ? data.plan
                : 'free';
            const subscriptionStatus =
              data.subscriptionStatus === 'active' ||
              data.subscriptionStatus === 'canceled' ||
              data.subscriptionStatus === 'past_due' ||
              data.subscriptionStatus === 'paused'
                ? data.subscriptionStatus
                : undefined;
            setProfile({
              uid: String(data.uid || firebaseUser.uid),
              email: String(data.email || firebaseUser.email || ''),
              displayName: String(data.displayName || firebaseUser.displayName || 'SA AI User'),
              photoURL: String(data.photoURL || firebaseUser.photoURL || ''),
              credits: typeof data.credits === 'number' ? data.credits : 0,
              isPaid: Boolean(
                data.isPaid ||
                  subscriptionStatus === 'active' ||
                  plan === 'starter' ||
                  plan === 'pro'
              ),
              plan,
              subscriptionStatus,
              paddleCustomerId:
                typeof data.paddleCustomerId === 'string' ? data.paddleCustomerId : undefined,
              paddleSubscriptionId:
                typeof data.paddleSubscriptionId === 'string'
                  ? data.paddleSubscriptionId
                  : undefined,
              lastOrderId: typeof data.lastOrderId === 'string' ? data.lastOrderId : undefined,
            });
          }
          setLoading(false);
        },
        (snapErr) => {
          setLoading(false);
          try {
            handleFirestoreError(snapErr, OperationType.GET, userPath);
          } catch (wrapped) {
            setError(wrapped instanceof Error ? wrapped.message : 'Firestore listener error');
          }
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    if (!auth) {
      setError('Firebase environment variables (NEXT_PUBLIC_FIREBASE_*) are not configured.');
      return null;
    }
    setAuthBusy(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const cred = await signInWithPopup(auth, provider);
      return cred.user;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : '';
      const isPopupBlocked =
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-browser' ||
        /popup/i.test(message) && /block/i.test(message);

      if (isPopupBlocked) {
        try {
          await signInWithRedirect(auth, provider);
          return null;
        } catch (redirectErr: unknown) {
          setError(
            redirectErr instanceof Error
              ? redirectErr.message
              : 'Google redirect sign-in failed'
          );
          return null;
        }
      }

      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(message || 'Google sign-in failed');
      }
      return null;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!auth) return;
    setAuthBusy(true);
    try {
      await signOut(auth);
      setProfile(null);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const deductCredit = useCallback(async () => {
    if (!auth || !db) {
      throw new Error('Firebase is not configured');
    }
    const activeUser = auth.currentUser;
    if (!activeUser) {
      throw new Error('Authentication required');
    }
    const userPath = `users/${activeUser.uid}`;
    const userRef = doc(db, 'users', activeUser.uid);
    try {
      await updateDoc(userRef, {
        credits: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  }, []);

  const addPaidCredits = useCallback(async (planId: 'starter' | 'pro', orderId: string) => {
    if (!auth || !db) {
      throw new Error('Firebase is not configured');
    }
    const activeUser = auth.currentUser;
    if (!activeUser) {
      throw new Error('Please sign in first to apply credits.');
    }
    const creditsToAdd = planId === 'pro' ? 100 : 30;
    const amountUsd = planId === 'pro' ? 5 : 2;
    const cleanOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || `ord_${Date.now()}`;
    const userPath = `users/${activeUser.uid}`;
    const userRef = doc(db, 'users', activeUser.uid);
    const txRef = doc(db, 'users', activeUser.uid, 'transactions', cleanOrderId);

    try {
      const batch = writeBatch(db);
      batch.update(userRef, {
        credits: increment(creditsToAdd),
        isPaid: true,
        lastOrderId: cleanOrderId,
        updatedAt: serverTimestamp(),
      });
      batch.set(txRef, {
        userId: activeUser.uid,
        orderId: cleanOrderId,
        planId,
        creditsAdded: creditsToAdd,
        amountUsd,
        status: 'COMPLETED',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      credits: profile?.credits ?? 0,
      isPaid: Boolean(profile?.isPaid),
      loading,
      authBusy,
      error,
      clearError,
      signInWithGoogle,
      logout,
      deductCredit,
      addPaidCredits,
    }),
    [user, profile, loading, authBusy, error, clearError, signInWithGoogle, logout, deductCredit, addPaidCredits]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
