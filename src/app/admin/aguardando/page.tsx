"use client";

import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";

export default function AguardandoPage() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-12">
          <Logo variant="escura" width={150} height={50} />
        </div>

        <div className="bg-white border border-dark/10 rounded-md p-8 lg:p-10">
          <h1 className="font-display text-3xl text-navy mb-3 leading-tight">Acesso em análise</h1>
          <p className="font-body text-base text-dark/70 mb-8 leading-relaxed">
            Sua solicitação de acesso está em análise. Você poderá entrar assim que for aprovado.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="font-body text-sm text-dark/60 hover:text-gold transition-colors duration-short underline"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
