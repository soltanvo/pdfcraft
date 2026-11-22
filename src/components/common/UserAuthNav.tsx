'use client';

import React from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { Button } from '@/components/ui/Button';
import { Coins, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import Link from 'next/link';

export const UserAuthNav: React.FC<{ locale: string }> = ({ locale }) => {
  const { user, userProfile, signInWithGoogle, signOutUser } = useAuth();

  return (
    <div className="flex items-center gap-3">
      {user ? (
        <div className="flex items-center gap-3">
          <Link 
            href={`/${locale}/credits`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-all"
            title="رصيد النقاط (اضغط للشحن)"
          >
            <Coins className="h-4 w-4 text-amber-500 animate-pulse" />
            <span>{userProfile?.credits ?? 5} نقاط</span>
          </Link>

          <div className="flex items-center gap-2 bg-[hsl(var(--color-muted)/0.5)] px-3 py-1.5 rounded-xl border border-[hsl(var(--color-border))]">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="h-6 w-6 rounded-full" />
            ) : (
              <UserIcon className="h-4 w-4 text-[hsl(var(--color-muted-foreground))]" />
            )}
            <span className="text-xs font-medium text-[hsl(var(--color-foreground))] hidden sm:inline">
              {user.displayName || user.email}
            </span>
            <button 
              onClick={signOutUser}
              className="text-[hsl(var(--color-muted-foreground))] hover:text-red-500 transition-colors p-1"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={signInWithGoogle}
          className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-md hover:shadow-lg transition-all"
        >
          <LogIn className="h-4 w-4" />
          <span>تسجيل الدخول (5 نقاط مجانية)</span>
        </Button>
      )}
    </div>
  );
};
