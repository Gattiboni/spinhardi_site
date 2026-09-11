import type { Metadata } from "next";

import Section from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { CookiePreferenceButton } from "@/components/consent";

/**
 * Data da última revisão da política. HARDCODED de propósito: data dinâmica aqui
 * mentiria a cada build (mudaria sem o texto ter mudado). Quem editar a copy
 * atualiza esta constante na mesma edição. Formato DD/MM/AAAA, como o texto pede.
 */
const ULTIMA_ATUALIZACAO = "11/09/2026";

/** Parágrafo de abertura — reusado como `description` do metadata (fonte única). */
const ABERTURA =
  "A Spinhardi cuida da sua viagem e cuida também dos seus dados. Esta página explica, sem " +
  "juridiquês, o que coletamos quando você fala com a gente, para que usamos e quais são os " +
  "seus direitos.";

export const metadata: Metadata = {
  title: "Política de privacidade", // vira "Política de privacidade | Spinhardi Turismo"
  description: ABERTURA,
  alternates: { canonical: "/politica-de-privacidade" },
};

/**
 * Título de seção numerada (H2). Um degrau abaixo do H1, com respiro maior acima
 * do que abaixo — separa os blocos numa coluna de leitura contínua.
 */
function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-4 mt-12 font-display text-2xl text-navy lg:text-3xl">{children}</h2>;
}

/**
 * Página `/politica-de-privacidade`
 *
 * Institucional pública, indexável. Server Component sem estado nem fetch: a copy
 * é hardcoded como nas demais institucionais (levar para o Sanity é decisão futura).
 *
 * Layout: coluna de leitura estreita (`max-w-3xl`), o mesmo padrão editorial do
 * post do blog — é texto corrido longo, não uma página de blocos. Sem hero, sem
 * imagem, sem CTA final, de propósito: página de referência, não de conversão.
 *
 * Seção 6 (Cookies) descreve o GA4 sob consentimento e traz o botão que revoga a
 * escolha (`CookiePreferenceButton`, o único pedaço client desta página; sem a env
 * do GA4 ele não renderiza, e a copy segue verdadeira: "só com a sua autorização").
 */
export default function PoliticaDePrivacidade() {
  return (
    <Section spacing="lg" className="bg-white text-dark pt-32 lg:pt-40">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Breadcrumb
            levels={[{ label: "Home", href: "/" }, { label: "Política de privacidade" }]}
            className="mb-6"
          />

          <h1 className="mb-8 font-display text-4xl leading-tight text-navy md:text-5xl lg:text-6xl">
            Política de privacidade
          </h1>

          <p className="font-body text-lg leading-relaxed text-dark/80 lg:text-xl">{ABERTURA}</p>

          <div className="font-body text-base leading-relaxed text-dark/80 lg:text-lg">
            <SectionTitle>1. Quem somos</SectionTitle>
            <p>
              O site spinharditurismo.com.br é mantido por Spinhardi Turismo Ltda, CNPJ
              53.291.591/0001-60, agência de turismo com sede em Serra Negra, SP. Para esta
              política, somos o controlador dos seus dados: quem decide para que eles servem e
              como são tratados.
            </p>

            <SectionTitle>2. Quais dados coletamos</SectionTitle>
            <div className="space-y-6">
              <p>
                Formulário de contato: nome e WhatsApp, que são obrigatórios para a gente
                conseguir responder, e mais o que você quiser contar sobre a viagem: e-mail,
                destino de interesse, quando pretende viajar, quantas pessoas vão, o perfil da
                viagem, a faixa de orçamento e um campo livre de observações.
              </p>
              <p>
                Conversa por WhatsApp ou Instagram: o que você compartilha com a gente por esses
                canais, incluindo nome e número, fica registrado no nosso sistema de atendimento
                para que qualquer pessoa da equipe consiga continuar o atendimento.
              </p>
              <p>
                Quando a viagem vira contratação: dados necessários para emitir passagens,
                reservas e seguros, como documento de identificação, data de nascimento e dados
                dos demais viajantes. Esses dados só são pedidos nesse momento e só o que cada
                fornecedor exige.
              </p>
              <p>
                Dados técnicos de navegação: nosso provedor de hospedagem registra informações
                como endereço IP, navegador e páginas acessadas, por segurança e para manter o
                site no ar. Não usamos esses registros para identificar você.
              </p>
            </div>

            <SectionTitle>3. Para que usamos</SectionTitle>
            <p>
              Para responder seu contato e montar uma proposta. Para atender você durante a
              organização e a realização da viagem. Para cumprir obrigações legais e fiscais
              quando existe contratação. E, se você já é cliente, para enviar novidades e
              conteúdos sobre viagens que tenham a ver com o que você já viajou ou pediu, com
              opção de parar de receber em um clique.
            </p>

            <SectionTitle>4. Base legal</SectionTitle>
            <p>
              Tratamos seus dados com base na Lei Geral de Proteção de Dados (Lei 13.709/2018).
              Quando você entra em contato, a base é a preparação e a execução do contrato de
              viagem. Quando emitimos documentos e notas, a base é o cumprimento de obrigação
              legal. As comunicações para quem já é cliente se apoiam no nosso legítimo interesse
              em manter o relacionamento, sempre com o descadastro disponível. As ferramentas de
              medição de audiência (Google Analytics) só funcionam com o seu consentimento, que
              você dá ou nega no aviso de cookies.
            </p>

            <SectionTitle>5. Com quem compartilhamos</SectionTitle>
            <div className="space-y-6">
              <p>
                Não vendemos seus dados. Compartilhamos apenas com quem precisa deles para o
                serviço funcionar: os fornecedores da viagem (companhias aéreas, hotéis,
                operadoras, seguradoras), somente na contratação e só o necessário para cada um;
                as plataformas que usamos para hospedar o site e o nosso sistema, atender por
                WhatsApp, gerir a agência, enviar e-mails e medir a audiência, todas atuando sob
                nossas instruções; e autoridades públicas, quando a lei exigir.
              </p>
              <p>
                Alguns desses provedores mantêm servidores fora do Brasil. Nesses casos, a
                transferência acontece com as garantias contratuais previstas na LGPD.
              </p>
            </div>

            <SectionTitle>6. Cookies</SectionTitle>
            <p>
              Usamos cookies estritamente necessários para o site funcionar e, só com a sua
              autorização, cookies do Google Analytics para medir a audiência: quais páginas são
              vistas e de onde as visitas chegam. Você escolhe no aviso que aparece na primeira
              visita e pode mudar de ideia quando quiser, no botão abaixo. Não usamos cookies de
              publicidade.
            </p>
            <CookiePreferenceButton />

            <SectionTitle>7. Por quanto tempo guardamos</SectionTitle>
            <p>
              Contatos que não viram viagem ficam registrados enquanto houver relacionamento
              ativo ou interesse demonstrado, e você pode pedir a exclusão a qualquer momento.
              Dados de viagens contratadas ficam guardados pelo prazo que a legislação fiscal,
              contábil e de consumo exige, e depois são excluídos ou anonimizados.
            </p>

            <SectionTitle>8. Seus direitos</SectionTitle>
            <div className="space-y-6">
              <p>
                Você pode, a qualquer momento: confirmar se tratamos seus dados; acessar o que
                temos sobre você; corrigir dados incompletos ou desatualizados; pedir a exclusão
                do que não for necessário para obrigação legal; pedir a portabilidade; e se opor
                a um tratamento ou revogar um consentimento.
              </p>
              <p>
                Para exercer qualquer um desses direitos, escreva para{" "}
                <a
                  href="mailto:contato@spinharditurismo.com.br"
                  className="text-gold underline underline-offset-4 transition-colors duration-short hover:text-navy"
                >
                  contato@spinharditurismo.com.br
                </a>
                . Respondemos em até 15 dias. Se preferir, você também pode registrar uma
                reclamação junto à Autoridade Nacional de Proteção de Dados (ANPD).
              </p>
            </div>

            <SectionTitle>9. Segurança</SectionTitle>
            <p>
              Os dados ficam em sistemas com acesso restrito à equipe da Spinhardi, protegidos
              por autenticação e criptografia em trânsito. Nenhum sistema é infalível, por isso,
              se identificarmos um incidente que possa afetar você, avisaremos.
            </p>

            <SectionTitle>10. Menores de idade</SectionTitle>
            <p>
              O site e o atendimento são voltados a adultos. Viajantes menores de idade são
              cadastrados pelo responsável legal, somente para a viagem contratada.
            </p>

            <SectionTitle>11. Mudanças nesta política</SectionTitle>
            <p>
              Quando esta política mudar, a nova versão será publicada aqui, com a data
              atualizada.
            </p>

            {/* Interpolado como UMA string: `Última atualização: {CONST}` viraria
                dois text nodes e o React separaria os dois no HTML com um
                comentário `<!-- -->`, quebrando um grep/curl na linha inteira. */}
            <p className="mt-16 font-body text-sm text-dark/60">
              {`Última atualização: ${ULTIMA_ATUALIZACAO}`}
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
