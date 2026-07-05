import { useState } from 'react';
import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'Report Missing', to: '/report-missing', active: true },
  { label: 'Sightings Map', to: '/map' },
  { label: 'Shelters & Vets', to: '/shelters' },
  { label: 'About', to: '/about' },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-on-background glass-nav bg-opacity-95 shadow-sm">
      <nav className="flex justify-between items-center w-full px-margin-mobile md:px-xl max-w-container-max mx-auto h-20">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-base no-underline" onClick={closeMenu}>
          <span className="material-symbols-outlined text-primary-container text-headline-md">pets</span>
          <span className="font-headline-md text-headline-md font-bold text-on-primary">CatSOS</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-xl">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={
                link.active
                  ? 'text-on-primary font-bold border-b-2 border-primary-container pb-1 font-label-md text-label-md'
                  : 'text-on-primary opacity-60 hover:opacity-100 hover:text-primary-container transition-opacity font-label-md text-label-md'
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA + mobile hamburger */}
        <div className="hidden md:flex items-center">
          <Link
            to="/login"
            className="text-on-primary opacity-60 hover:opacity-100 hover:text-primary-container transition-opacity font-label-md text-label-md mr-md"
          >
            Join
          </Link>
          <button className="bg-primary-container text-on-primary px-md py-sm rounded-xl font-label-md text-label-md font-bold hover:scale-95 duration-100 transition-transform">
            Report a Missing Cat
          </button>
        </div>

        {/* Hamburger — mobile only */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-[5px] bg-transparent border-0 p-0 cursor-pointer"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <span
            className={`block w-6 h-0.5 bg-on-primary rounded-full transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`}
          />
          <span
            className={`block w-6 h-0.5 bg-on-primary rounded-full transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`}
          />
          <span
            className={`block w-6 h-0.5 bg-on-primary rounded-full transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="flex flex-col px-margin-mobile pb-md border-t border-on-primary/10">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={closeMenu}
              className="text-on-primary font-label-md text-label-md py-md border-b border-on-primary/10 last:border-0 hover:text-primary-container transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/login"
            onClick={closeMenu}
            className="mt-md text-center text-on-primary opacity-60 hover:opacity-100 hover:text-primary-container transition-opacity font-label-md text-label-md py-sm"
          >
            Join
          </Link>
          <button className="mt-sm bg-primary-container text-on-primary px-md py-sm rounded-xl font-label-md text-label-md font-bold w-full">
            Report a Missing Cat
          </button>
        </div>
      </div>
    </header>
  );
}
