import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { supabaseServer } from "@/lib/supabase/server";
import RedefinirSenhaForm from "./RedefinirSenhaForm";

/**
 * Tela de nova senha.
 *
 * Só renderiza o formulário se houver sessão de recovery ativa (estabelecida na
 * rota de callback). Sem sessão — ou com `?error=link` vindo do callback — mostra
 * um estado claro de "link inválido" com o caminho pra pedir um novo.
 *
 * A rota é isenta no proxy (PUBLIC_ADMIN_ROUTES) justamente pra conseguir exibir
 * esse estado a quem chega sem sessão, em vez de ser jogado pro login.
 */
export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const linkInvalido = Boolean(error) || !user;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-12">
          <Logo variant="escura" width={150} height={50} />
        </div>

        <div className="bg-white border border-dark/10 rounded-md p-8 lg:p-10">
          {linkInvalido ? (
            <>
              <h1 className="font-display text-3xl text-navy mb-3 leading-tight">
                Link inválido ou expirado
              </h1>
              <p className="font-body text-base text-dark/70 mb-8 leading-relaxed">
                Este link de redefinição não é mais válido. Isso acontece quando ele expira ou já
                foi usado. Peça um novo para continuar.
              </p>
              <Link
                href="/admin/esqueci-senha"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-8 py-4 text-lg font-body font-medium text-dark transition-colors duration-medium hover:bg-gold/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
              >
                Solicitar novo link
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl text-navy mb-3 leading-tight">Criar nova senha</h1>
              <p className="font-body text-base text-dark/70 mb-8 leading-relaxed">
                Escolha uma nova senha para acessar o painel.
              </p>
              <RedefinirSenhaForm />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
