"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error");

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-paper">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-2.5 h-2.5 rounded-full bg-sapphire" />
          <span className="w-2.5 h-2.5 rounded-full bg-topaz" />
          <span className="w-2.5 h-2.5 rounded-full bg-amethyst" />
        </div>
        <h1 className="font-display font-semibold text-4xl text-ink mb-3">
          Investigation & Reconcillation System
        </h1>
        <p className="text-slate text-sm mb-10 leading-relaxed">
          Sign in with the Google account your admin registered for you to
          record today's stock count.
        </p>

        {error && (
          <div className="border border-ruby/30 bg-ruby-light text-ruby text-sm rounded px-4 py-3 mb-6">
            This account isn't registered for the reconciliation register.
            Ask your admin to add you.
          </div>
        )}

        <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })} className="btn-primary w-full">
          Continue with Google
        </button>
      </div>
    </main>
  );
}
