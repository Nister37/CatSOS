import { CTASection } from '../components/CTASection';
import { FeatureCards } from '../components/FeatureCards';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { Navbar } from '../components/Navbar';
import { RecentlyReported } from '../components/RecentlyReported';

export function HomePage() {
  return (
    <div className="bg-background text-on-background font-body-md scroll-smooth">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="pt-20">
        <Hero />
        <FeatureCards />
        <RecentlyReported />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
