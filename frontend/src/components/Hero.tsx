import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-xl md:py-32">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-xl grid grid-cols-1 lg:grid-cols-2 gap-lg items-center">
        <div className="z-10 text-center lg:text-left">
          <h1 className="font-display-lg text-display-lg mb-md text-on-background leading-tight">
            Lost your cat? <br />
            The community is{' '}
            <span className="text-primary">here to help.</span>
          </h1>
          <p className="font-body-lg text-body-lg text-secondary mb-lg max-w-xl mx-auto lg:mx-0">
            Join thousands of neighbors looking out for each other. Report missing cats, share
            sightings, and get instant alerts to bring your feline friend home safely.
          </p>
          <div className="flex flex-col sm:flex-row gap-md justify-center lg:justify-start">
            <Link
              to="/report-missing"
              className="bg-primary text-on-primary px-xl py-md rounded-xl font-headline-md text-headline-md font-bold hover:shadow-lg transition-all"
            >
              Report Missing Cat
            </Link>
            <button className="border-2 border-on-background text-on-background px-xl py-md rounded-xl font-headline-md text-headline-md font-bold hover:bg-on-background hover:text-on-primary transition-all">
              Report a Sighting
            </button>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl animate-pulse" />
          <div className="rounded-3xl overflow-hidden shadow-2xl cat-card-shadow rotate-2 hover:rotate-0 transition-transform duration-500">
            <img
              className="w-full h-[500px] object-cover"
              alt="A beautiful domestic shorthair cat with intelligent amber eyes looking directly into the camera against a clean minimalist studio background"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEkSiLgyKukbO5azPwdaONXjeyMWOpE7bqhrdtKrzLcBnby7860kKBaaD4sqMKkhntFxOvybZmFWmRKg-bpjk7fcsbCFkMXspL1yaMEb4gJAbGpYAHsb93xbJP6WTcyge4c1IlAHTxY5p9MtfLdA7IoL5J9XwKwfFPmlyv_mVzC8MqrMcpyyFW7sL40GoDmUia11Fobhit53_KDO1aR6LtelSqZfOWVXILmJoQl_X6lq_snP2gBSKRmg"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
