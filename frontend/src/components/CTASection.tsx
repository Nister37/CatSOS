export function CTASection() {
  return (
    <section className="py-xl">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-xl">
        <div className="bg-on-background rounded-3xl p-xl flex flex-col md:flex-row items-center justify-between gap-lg relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="relative z-10 text-center md:text-left max-w-2xl">
            <h2 className="font-display-lg text-display-lg text-on-primary mb-md">Ready to help?</h2>
            <p className="font-body-lg text-body-lg text-on-primary opacity-80 mb-0">
              Join our community alerts. We'll only notify you if a cat goes missing within 5 miles
              of your location.
            </p>
          </div>
          <div className="relative z-10">
            <button className="bg-primary text-on-primary px-xl py-md rounded-xl font-headline-md text-headline-md font-bold hover:scale-105 transition-all shadow-xl">
              Join the Network
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
