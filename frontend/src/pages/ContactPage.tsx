import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Please enter a valid email address'),
  subject: z.string().min(3, 'Please enter a subject'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
});
type ContactFormData = z.infer<typeof contactSchema>;

const CONTACT_ITEMS = [
  {
    icon: 'mail',
    label: 'Email',
    value: 'hello@catsos.app',
    href: 'mailto:hello@catsos.app',
  },
  {
    icon: 'location_on',
    label: 'Based in',
    value: 'Antwerp, Belgium',
    href: null,
  },
  {
    icon: 'schedule',
    label: 'Response time',
    value: 'Within 48 hours',
    href: null,
  },
];

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({ resolver: zodResolver(contactSchema) });

  async function onSubmit() {
    await new Promise((r) => setTimeout(r, 800));
    setSubmitted(true);
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-28 pb-xl px-margin-mobile md:px-xl">
        <div className="max-w-container-max mx-auto">

          <div className="mb-xl">
            <p className="font-label-md text-label-md text-primary uppercase tracking-widest mb-sm">Get in touch</p>
            <h1 className="font-display-lg text-display-lg text-on-surface mb-sm">Contact Us</h1>
            <p className="font-body-lg text-body-lg text-secondary max-w-2xl">
              Have a question, found a bug, or want to suggest a feature? We'd love to hear from you.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl items-start">

            {/* Left — contact info */}
            <div className="lg:col-span-4 space-y-md">
              <div className="bg-on-background rounded-2xl p-lg space-y-lg">
                <div>
                  <div className="flex items-center gap-sm mb-xs">
                    <span className="material-symbols-outlined text-primary-container text-headline-md">pets</span>
                    <span className="font-headline-md text-headline-md font-bold text-on-primary">CatSOS</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-primary/60 mt-sm">
                    A community-powered safety net for our feline friends.
                  </p>
                </div>

                <div className="space-y-md pt-md border-t border-on-primary/10">
                  {CONTACT_ITEMS.map((item) => (
                    <div key={item.label} className="flex items-start gap-md">
                      <div className="w-9 h-9 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-primary-container">
                          {item.icon}
                        </span>
                      </div>
                      <div>
                        <p className="font-label-sm text-label-sm text-on-primary/50 uppercase tracking-wide">
                          {item.label}
                        </p>
                        {item.href ? (
                          <a
                            href={item.href}
                            className="font-body-md text-body-md text-on-primary hover:text-primary-container transition-colors"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="font-body-md text-body-md text-on-primary">{item.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-lg border border-surface-container-highest">
                <div className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-[2px]">info</span>
                  <div>
                    <p className="font-label-md text-label-md text-on-surface mb-xs">Reporting a missing cat?</p>
                    <p className="font-body-md text-body-md text-secondary">
                      For missing cat reports, please use the{' '}
                      <a href="/report-missing" className="text-primary hover:underline">
                        Report Missing Cat
                      </a>{' '}
                      page — it's faster and your report will reach the community immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — form */}
            <div className="lg:col-span-8">
              {submitted ? (
                <div className="bg-white rounded-2xl border border-surface-container-highest shadow-sm p-xl flex flex-col items-center text-center gap-md">
                  <div className="w-20 h-20 rounded-full bg-[#2D8C3C]/10 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-[40px] text-[#2D8C3C]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  </div>
                  <div>
                    <h2 className="font-headline-md text-headline-md text-on-surface mb-sm">
                      Message sent!
                    </h2>
                    <p className="font-body-lg text-body-lg text-secondary max-w-md">
                      Thanks for reaching out. We'll get back to you within 48 hours.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-sm px-xl py-md rounded-xl border-2 border-outline-variant text-on-surface font-label-md hover:bg-surface-container transition-colors"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-surface-container-highest shadow-sm p-md md:p-lg">
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-lg">
                    Send us a message
                  </h2>

                  <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                      <div className="flex flex-col gap-xs">
                        <label htmlFor="name" className="font-label-md text-label-md text-on-surface">
                          Your name
                        </label>
                        <input
                          id="name"
                          type="text"
                          placeholder="Jane Doe"
                          aria-invalid={Boolean(errors.name)}
                          className="bg-surface-container-low border-2 border-transparent rounded-xl px-md py-sm font-body-md text-body-md transition-all focus:outline-none focus:border-on-background focus:bg-white"
                          {...register('name')}
                        />
                        {errors.name && (
                          <p role="alert" className="text-error font-label-sm text-label-sm">
                            {errors.name.message}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-xs">
                        <label htmlFor="email" className="font-label-md text-label-md text-on-surface">
                          Email address
                        </label>
                        <input
                          id="email"
                          type="email"
                          placeholder="jane@example.com"
                          aria-invalid={Boolean(errors.email)}
                          className="bg-surface-container-low border-2 border-transparent rounded-xl px-md py-sm font-body-md text-body-md transition-all focus:outline-none focus:border-on-background focus:bg-white"
                          {...register('email')}
                        />
                        {errors.email && (
                          <p role="alert" className="text-error font-label-sm text-label-sm">
                            {errors.email.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-xs">
                      <label htmlFor="subject" className="font-label-md text-label-md text-on-surface">
                        Subject
                      </label>
                      <input
                        id="subject"
                        type="text"
                        placeholder="How can we help?"
                        aria-invalid={Boolean(errors.subject)}
                        className="bg-surface-container-low border-2 border-transparent rounded-xl px-md py-sm font-body-md text-body-md transition-all focus:outline-none focus:border-on-background focus:bg-white"
                        {...register('subject')}
                      />
                      {errors.subject && (
                        <p role="alert" className="text-error font-label-sm text-label-sm">
                          {errors.subject.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-xs">
                      <label htmlFor="message" className="font-label-md text-label-md text-on-surface">
                        Message
                      </label>
                      <textarea
                        id="message"
                        rows={6}
                        placeholder="Tell us more..."
                        aria-invalid={Boolean(errors.message)}
                        className="bg-surface-container-low border-2 border-transparent rounded-xl px-md py-sm font-body-md text-body-md transition-all focus:outline-none focus:border-on-background focus:bg-white resize-none"
                        {...register('message')}
                      />
                      {errors.message && (
                        <p role="alert" className="text-error font-label-sm text-label-sm">
                          {errors.message.message}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-xs">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-sm px-xl py-md rounded-xl bg-on-background text-on-primary font-label-md text-label-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {isSubmitting ? (
                          <span className="material-symbols-outlined text-[20px] animate-spin">
                            progress_activity
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[20px]">send</span>
                        )}
                        {isSubmitting ? 'Sending…' : 'Send message'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
