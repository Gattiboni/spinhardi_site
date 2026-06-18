import Logo from "@/components/ui/Logo";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyApprovalToken, type ApprovalAction } from "@/lib/auth/approval-token";

// Mutação acontece no render (clique vindo de e-mail é GET). Nunca pré-renderiza.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

type Outcome =
  | { kind: "invalid" }
  | { kind: "error" }
  | { kind: "approved"; role: "admin" | "editor"; name: string; email: string }
  | { kind: "rejected"; name: string; email: string };

const UPDATE_BY_ACTION: Record<ApprovalAction, { status: string; role: string | null }> = {
  admin: { status: "approved", role: "admin" },
  editor: { status: "approved", role: "editor" },
  reject: { status: "rejected", role: null },
};

async function applyDecision(token: string): Promise<Outcome> {
  const payload = await verifyApprovalToken(token);
  if (!payload) return { kind: "invalid" };

  const fields = UPDATE_BY_ACTION[payload.action];
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("user_profiles")
    .update({
      status: fields.status,
      role: fields.role,
      approved_at: new Date().toISOString(),
    })
    .eq("id", payload.user_id)
    .select("name, email")
    .single();

  if (error || !data) {
    console.error("[aprovar] erro ao aplicar decisão:", error);
    return { kind: "error" };
  }

  if (payload.action === "reject") {
    return { kind: "rejected", name: data.name, email: data.email };
  }
  return {
    kind: "approved",
    role: payload.action,
    name: data.name,
    email: data.email,
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-12">
          <Logo variant="escura" width={150} height={50} />
        </div>
        <div className="bg-white border border-dark/10 rounded-md p-8 lg:p-10">{children}</div>
      </div>
    </div>
  );
}

export default async function AprovarPage({ params }: Props) {
  const { token } = await params;
  const outcome = await applyDecision(token);

  if (outcome.kind === "invalid") {
    return (
      <Shell>
        <h1 className="font-display text-3xl text-navy mb-3 leading-tight">Link inválido</h1>
        <p className="font-body text-base text-dark/70 leading-relaxed">
          Este link de aprovação é inválido ou expirou. Solicite ao usuário que faça uma nova
          solicitação, se necessário.
        </p>
      </Shell>
    );
  }

  if (outcome.kind === "error") {
    return (
      <Shell>
        <h1 className="font-display text-3xl text-navy mb-3 leading-tight">Algo deu errado</h1>
        <p className="font-body text-base text-dark/70 leading-relaxed">
          Não foi possível aplicar a decisão. Tente novamente pelo link do e-mail ou pelo painel.
        </p>
      </Shell>
    );
  }

  if (outcome.kind === "rejected") {
    return (
      <Shell>
        <h1 className="font-display text-3xl text-navy mb-3 leading-tight">Acesso rejeitado</h1>
        <p className="font-body text-base text-dark/70 leading-relaxed">
          A solicitação de <strong>{outcome.name}</strong> ({outcome.email}) foi rejeitada.
        </p>
      </Shell>
    );
  }

  const roleLabel = outcome.role === "admin" ? "Admin" : "Editor";
  return (
    <Shell>
      <h1 className="font-display text-3xl text-navy mb-3 leading-tight">Acesso aprovado</h1>
      <p className="font-body text-base text-dark/70 leading-relaxed">
        <strong>{outcome.name}</strong> ({outcome.email}) agora tem acesso como{" "}
        <strong>{roleLabel}</strong>.
      </p>
    </Shell>
  );
}
