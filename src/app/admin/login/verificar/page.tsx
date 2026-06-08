"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";

export default function VerificarPage() {
  const router = useRouter();

  useEffect(() => {
    auth.verifySession().then((user) => {
      if (user) {
        router.replace("/admin");
      } else {
        router.replace("/admin/login");
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <p className="font-display text-2xl text-navy mb-2">Verificando acesso...</p>
        <p className="font-body text-sm text-dark/60">Você será redirecionado em instantes.</p>
      </div>
    </div>
  );
}
