import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';

const SECTIONS = [
  {
    title: 'Information We Collect',
    content: [
      'When you report a missing cat, we collect the information you provide: cat details, last known location, contact information (name, phone number, email address), and any photos you upload.',
      'When you submit a sighting, we collect the sighting location, photos, notes, and optionally your account information if you are logged in.',
      'We automatically collect your approximate location when you use map-based features, but only with your explicit permission.',
      'We collect standard web analytics data such as pages visited and device type to improve the service.',
    ],
  },
  {
    title: 'How We Use Your Information',
    content: [
      'To publish your missing cat report and make it discoverable by community members in the area.',
      'To send notifications to nearby registered users when a cat goes missing close to them.',
      'To notify you when someone reports a sighting of your cat.',
      'To allow the community to submit and verify sightings on the public map.',
      'To generate printable posters and QR codes for your missing cat report.',
    ],
  },
  {
    title: 'Information Sharing',
    content: [
      'Contact information (phone number and email) on a report is shared with other users only according to the visibility setting you choose when creating the report.',
      'We do not sell, trade, or rent your personal information to third parties.',
      'We may share anonymised, aggregated data (such as total number of reunited cats) publicly to demonstrate community impact.',
      'We may disclose your information if required by law or to protect the safety of our users.',
    ],
  },
  {
    title: 'Data Retention',
    content: [
      'Active missing cat reports are retained for as long as your account exists or until you close the report.',
      'Closed reports are retained for 12 months to allow for historical reference, then permanently deleted.',
      'Sighting records associated with a report are deleted when the report is permanently deleted.',
      'Account data is deleted within 30 days of account deletion.',
    ],
  },
  {
    title: 'Your Rights',
    content: [
      'You can edit or close your missing cat reports at any time from your account dashboard.',
      'You can request a copy of all personal data we hold about you by contacting us at the address below.',
      'You can request deletion of your account and associated data at any time from your Settings page.',
      'You can withdraw consent for location access at any time through your browser or device settings.',
    ],
  },
  {
    title: 'Cookies and Local Storage',
    content: [
      'We use browser local storage to keep you signed in across sessions. No authentication cookies are used.',
      'We do not use advertising cookies or cross-site tracking.',
      'Essential local storage entries are cleared when you sign out.',
    ],
  },
  {
    title: 'Contact',
    content: [
      'If you have questions about this Privacy Policy or how we handle your data, please contact us at privacy@catsos.app or through our Contact page.',
    ],
  },
];

export function PrivacyPage() {
  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile md:px-xl">
        <div className="max-w-3xl mx-auto">

          <div className="mb-xl">
            <p className="font-label-md text-label-md text-primary uppercase tracking-widest mb-sm">Legal</p>
            <h1 className="font-display-lg text-display-lg text-on-surface mb-sm">Privacy Policy</h1>
            <p className="font-body-lg text-body-lg text-secondary">
              Last updated: 1 January 2026
            </p>
          </div>

          <div className="bg-surface-container-low rounded-2xl border border-surface-container-highest p-md md:p-lg mb-xl">
            <p className="font-body-lg text-body-lg text-on-surface">
              CatSOS is a community-powered platform dedicated to helping reunite missing cats with their owners.
              We take your privacy seriously. This policy explains what information we collect, how we use it,
              and what choices you have.
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

        </div>
      </main>

      <Footer />
    </div>
  );
}
