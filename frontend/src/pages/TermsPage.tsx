import { Link } from 'react-router-dom';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    content: [
      'By accessing or using CatSOS, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.',
      'We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the updated terms.',
    ],
  },
  {
    title: 'Use of the Platform',
    content: [
      'CatSOS is provided solely for the purpose of helping locate missing cats. You agree to use it only for this purpose.',
      'You must provide accurate and truthful information when creating reports or submitting sightings.',
      'You must not create false or misleading reports. Doing so undermines the community and may cause unnecessary distress.',
      'You are responsible for keeping your account credentials secure. You must not share your account with others.',
    ],
  },
  {
    title: 'User-Generated Content',
    content: [
      'You retain ownership of any content you submit, including photos and descriptions.',
      'By submitting content, you grant CatSOS a non-exclusive, royalty-free licence to display that content on the platform for the purpose of helping locate your cat.',
      'You must not submit content that is offensive, illegal, or unrelated to the purpose of finding missing cats.',
      'We reserve the right to remove any content that violates these terms without prior notice.',
    ],
  },
  {
    title: 'Prohibited Actions',
    content: [
      'Using the platform to harass, intimidate, or deceive other users.',
      'Scraping, crawling, or systematically downloading data from the platform.',
      'Attempting to gain unauthorised access to accounts or backend systems.',
      'Submitting sightings for financial gain or with intent to deceive a pet owner.',
      'Using automated tools to submit reports or sightings in bulk.',
    ],
  },
  {
    title: 'Disclaimer of Warranties',
    content: [
      'CatSOS is provided "as is" without warranties of any kind, express or implied.',
      'We do not guarantee that using CatSOS will result in locating your pet. The platform is a community tool and its effectiveness depends on community participation.',
      'We do not guarantee uninterrupted or error-free service.',
    ],
  },
  {
    title: 'Limitation of Liability',
    content: [
      'To the fullest extent permitted by law, CatSOS and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.',
      'Our total liability for any claim shall not exceed the amount you have paid us in the 12 months preceding the claim (which, for free users, is zero).',
    ],
  },
  {
    title: 'Account Termination',
    content: [
      'You may delete your account at any time from the Settings page.',
      'We reserve the right to suspend or terminate accounts that violate these terms, without prior notice.',
      'Upon termination, your reports may be retained in an anonymised form to preserve the integrity of associated sighting records.',
    ],
  },
  {
    title: 'Governing Law',
    content: [
      'These terms are governed by the laws of Belgium. Any disputes shall be subject to the exclusive jurisdiction of the courts of Belgium.',
    ],
  },
];

export function TermsPage() {
  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile md:px-xl">
        <div className="max-w-3xl mx-auto">

          <div className="mb-xl">
            <p className="font-label-md text-label-md text-primary uppercase tracking-widest mb-sm">Legal</p>
            <h1 className="font-display-lg text-display-lg text-on-surface mb-sm">Terms of Service</h1>
            <p className="font-body-lg text-body-lg text-secondary">
              Last updated: 1 January 2026
            </p>
          </div>

          <div className="bg-surface-container-low rounded-2xl border border-surface-container-highest p-md md:p-lg mb-xl">
            <p className="font-body-lg text-body-lg text-on-surface">
              These Terms of Service govern your use of CatSOS. Please read them carefully before
              using the platform. By using CatSOS, you agree to these terms.
            </p>
          </div>

          <div className="space-y-xl">
            {SECTIONS.map((section, i) => (
              <section key={section.title}>
                <div className="flex items-start gap-md mb-md">
                  <span className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0 mt-1">
                    <span className="font-label-md text-[12px] text-on-primary font-bold">{i + 1}</span>
                  </span>
                  <h2 className="font-headline-md text-headline-md text-on-surface pt-1">{section.title}</h2>
                </div>
                <ul className="space-y-sm ml-12">
                  {section.content.map((paragraph, j) => (
                    <li key={j} className="flex items-start gap-sm">
                      <span className="material-symbols-outlined text-[16px] text-primary-container mt-[3px] shrink-0">
                        arrow_right
                      </span>
                      <p className="font-body-lg text-body-lg text-secondary">{paragraph}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-xl pt-xl border-t border-surface-container-highest">
            <p className="font-body-md text-body-md text-secondary">
              Questions about these terms?{' '}
              <Link to="/contact" className="text-primary hover:underline">
                Contact us
              </Link>{' '}
              and we'll be happy to help.
            </p>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
