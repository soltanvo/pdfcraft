'use client';
import { auth, googleProvider } from "@/lib/firebase/client";
import { signInWithPopup } from "firebase/auth";
import { Button } from "@/components/ui/Button";

export default function Header({ locale }: { locale: string }) {
  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (e: any) { alert(e.message); }
  };
  return (
    <header className="fixed w-full bg-white border-b h-16 flex items-center justify-between px-6 z-50">
        <div className="font-bold">SA AI</div>
        <Button onClick={handleLogin}>تسجيل الدخول</Button>
    </header>
  );
}
