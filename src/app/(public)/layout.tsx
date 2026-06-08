import Header from "@/components/ui/Header";
import Footer from "@/components/ui/Footer";
import BackToTop from "@/components/ui/BackToTop";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <BackToTop />
    </>
  );
}
