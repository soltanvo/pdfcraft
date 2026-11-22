'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from './config';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  credits: number;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  deductCredits: (amount: number) => Promise<boolean>;
  addCredits: (amount: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
  deductCredits: async () => false,
  addCredits: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // Initialize new user with 5 free credits
          const initialProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || 'مستخدم SA AI',
            photoURL: firebaseUser.photoURL,
            credits: 5,
          };
          await setDoc(userRef, initialProfile);
          setUserProfile(initialProfile);
        } else {
          setUserProfile(userSnap.data() as UserProfile);
          // Listen for realtime updates to credits
          const unsubDoc = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as UserProfile);
            }
          });
          return () => unsubDoc();
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const deductCredits = async (amount: number): Promise<boolean> => {
    if (!user || !userProfile) return false;
    if (userProfile.credits < amount) {
      alert("رصيد النقاط غير كافٍ! يرجى شحن النقاط.");
      return false;
    }
    const newCredits = userProfile.credits - amount;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { credits: newCredits });
    setUserProfile({ ...userProfile, credits: newCredits });
    return true;
  };

  const addCredits = async (amount: number) => {
    if (!user || !userProfile) return;
    const newCredits = userProfile.credits + amount;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { credits: newCredits });
    setUserProfile({ ...userProfile, credits: newCredits });
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, signOutUser, deductCredits, addCredits }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
