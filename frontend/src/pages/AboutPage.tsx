import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';

const VALUES = [
  {
    icon: 'bolt',
    title: 'Speed',
    body: 'Every second counts when a pet is missing. Our platform is built for immediate alerts and rapid response deployment.',
  },
  {
    icon: 'groups',
    title: 'Community',
    body: 'We are stronger together. Our network turns strangers into allies, ensuring more eyes are on the lookout instantly.',
  },
  {
    icon: 'shield_person',
    title: 'Safety',
    body: "Data privacy first. We protect our community's information while ensuring pet details reach the right people safely.",
  },
];

const STEPS = [
  {
    step: 1,
    title: 'Report',
    body: 'Quickly upload photos and details of the missing cat through our streamlined interface.',
  },
  {
    step: 2,
    title: 'Alert',
    body: 'An instant SOS signal is sent to every neighbor within a 2-mile radius via the app.',
  },
  {
    step: 3,
    title: 'Reunite',
    body: 'Real-time sightings lead the owner directly to their cat. Another success story logged.',
  },
];

export function AboutPage() {
  const howItWorksRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    document.querySelectorAll('[data-animate]').forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-grow">
        {/* Hero */}
        <section className="relative pt-[calc(80px+64px)] pb-24 px-margin-mobile">
          <div className="max-w-container-max mx-auto grid md:grid-cols-2 gap-xl items-center">
            <div
              data-animate
              className="z-10 opacity-0 translate-y-10 transition-all duration-700 ease-out"
            >
              <h1 className="font-display-lg text-display-lg md:text-[56px] mb-6 leading-tight text-on-background">
                Our Mission: <br />
                <span className="text-primary-container">Bringing Every Cat Home.</span>
              </h1>
              <p className="font-body-lg text-body-lg text-secondary max-w-lg mb-8">
                We believe that no cat should ever be truly lost. By harnessing the collective power of vigilant
                neighbors and real-time technology, we turn every neighborhood into a high-speed safety net for
                our feline friends.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/signup"
                  className="bg-primary text-on-primary px-8 py-4 rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm inline-block"
                >
                  Join the Network
                </Link>
                <button
                  type="button"
                  onClick={() => howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="border-2 border-on-background text-on-background px-8 py-4 rounded-xl font-label-md text-label-md font-bold hover:bg-on-background hover:text-on-primary active:scale-95 transition-all"
                >
                  Learn More
                </button>
              </div>
            </div>

            <div
              data-animate
              className="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden shadow-2xl opacity-0 translate-y-10 transition-all duration-700 ease-out delay-150"
            >
              <img
                className="w-full h-full object-cover"
                src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&h=400&fit=crop"
                alt="A majestic ginger cat sitting calmly on a clean white surface"
              />
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-surface-container-low py-xl px-margin-mobile">
          <div className="max-w-container-max mx-auto">
            <div
              data-animate
              className="text-center mb-16 opacity-0 translate-y-10 transition-all duration-700 ease-out"
            >
              <h2 className="font-headline-lg text-headline-lg mb-4 text-on-background">
                The Values We Live By
              </h2>
              <div className="w-16 h-1 bg-primary-container mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {VALUES.map((value, i) => (
                <div
                  key={value.title}
                  data-animate
                  className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/30 group hover:border-primary-container opacity-0 translate-y-10 transition-all duration-700 ease-out"
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="w-16 h-16 bg-primary-container/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-primary-container text-[32px]">
                      {value.icon}
                    </span>
                  </div>
                  <h3 className="font-headline-md text-headline-md mb-2 text-on-background">
                    {value.title}
                  </h3>
                  <p className="text-secondary font-body-md text-body-md">{value.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section ref={howItWorksRef} className="py-xl px-margin-mobile">
          <div className="max-w-container-max mx-auto flex flex-col md:flex-row items-center gap-xl">
            <div
              data-animate
              className="w-full md:w-1/2 opacity-0 translate-y-10 transition-all duration-700 ease-out"
            >
              <h2 className="font-headline-lg text-headline-lg mb-8 text-on-background">
                Simplicity in Crisis
              </h2>
              <div className="space-y-10">
                {STEPS.map(({ step, title, body }) => (
                  <div key={step} className="flex gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-on-background text-on-primary flex items-center justify-center font-bold font-label-md text-label-md">
                      {step}
                    </div>
                    <div>
                      <h4 className="font-bold font-headline-md text-[20px] mb-1 text-on-background">
                        {title}
                      </h4>
                      <p className="text-secondary font-body-md text-body-md">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              data-animate
              className="w-full md:w-1/2 relative opacity-0 translate-y-10 transition-all duration-700 ease-out delay-150"
            >
              <div className="aspect-square bg-surface-container rounded-3xl overflow-hidden shadow-xl border-8 border-white">
                <img
                  className="w-full h-full object-cover"
                  src="https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600&h=400&fit=crop"
                  alt="CatSOS app interface showing a missing cat alert"
                />
              </div>

              <div className="absolute -bottom-8 -left-8 bg-surface-container-lowest p-6 rounded-2xl shadow-xl border border-outline-variant/20 hidden md:flex flex-col items-start animate-bounce">
                <span
                  className="material-symbols-outlined text-primary-container text-[40px] mb-2"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  favorite
                </span>
                <p className="font-bold font-headline-md text-headline-md text-on-background">1.2k+</p>
                <p className="font-label-sm text-label-sm text-secondary">Lives Reunited</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-xl px-margin-mobile text-center">
          <div
            data-animate
            className="max-w-3xl mx-auto bg-surface-container-lowest p-xl rounded-[32px] shadow-2xl border border-outline-variant/10 relative overflow-hidden opacity-0 translate-y-10 transition-all duration-700 ease-out"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary-container/10 rounded-full -ml-24 -mb-24 pointer-events-none" />
            <h2 className="font-display-lg text-display-lg mb-6 text-on-background relative">
              Join the safety net today.
            </h2>
            <p className="font-body-lg text-body-lg text-secondary mb-10 relative max-w-xl mx-auto">
              Be the neighbor who makes a difference. Sign up for CatSOS and help us ensure no cat is left
              behind.
            </p>
            <Link
              to="/signup"
              className="bg-primary text-on-primary px-12 py-5 rounded-full font-headline-md font-bold hover:scale-105 active:scale-95 transition-all shadow-xl inline-block relative"
            >
              Join the Network
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
