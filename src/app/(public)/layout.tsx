import Header from "@/components/ui/Header";
import Footer from "@/components/ui/Footer";
import BackToTop from "@/components/ui/BackToTop";
import { ConsentProvider, CookieBanner, GoogleAnalytics } from "@/components/consent";

/**
 * Layout público. O `ConsentProvider` envolve o chrome inteiro e é SÓ daqui:
 * root layout e admin ficam fora, então o painel não recebe banner nem tag do
 * GA4. `CookieBanner` e `GoogleAnalytics` vêm depois do `BackToTop` (z-index
 * documentado no banner). Sem `NEXT_PUBLIC_GA4_MEASUREMENT_ID` os dois
 * renderizam nada.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsentProvider>
      <Header />
      <main>{children}</main>
      <Footer />
      <BackToTop />
      <CookieBanner />
      <GoogleAnalytics />
    </ConsentProvider>
  );
}
