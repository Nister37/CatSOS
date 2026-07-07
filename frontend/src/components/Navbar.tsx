import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { signOut } from '../features/auth/authSlice';
import { fetchUnreadCount } from '../services/notificationsApi';

const NAV_LINKS = [
  { label: 'Report Missing', to: '/report-missing' },
  { label: 'Sightings Map', to: '/map' },
  { label: 'Shelters & Vets', to: '/shelters' },
  { label: 'About', to: '/about' },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, [user]);

  const { pathname } = useLocation();
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + '/');

  const closeMenu = () => setMenuOpen(false);

  const handleSignOut = () => {
    dispatch(signOut());
    setMenuOpen(false);
    setUserMenuOpen(false);
    navigate('/');
  };

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
                isActive(link.to)
                  ? 'text-on-primary font-bold border-b-2 border-primary-container pb-1 font-label-md text-label-md'
                  : 'text-on-primary opacity-60 hover:opacity-100 hover:text-primary-container transition-opacity font-label-md text-label-md'
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-md">
          {user && (
            <Link
              to="/notifications"
              aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
              className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-on-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-on-primary text-[20px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-[3px] bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}
          {user ? (
            <div ref={userMenuRef} className="relative">
              {/* Avatar button */}
              <button
                type="button"
                aria-label="User menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-container/20 hover:bg-primary-container/35 transition-colors border border-on-primary/15"
              >
                <span className="material-symbols-outlined text-on-primary text-[20px]">
                  account_circle
                </span>
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] w-48 bg-on-background rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.18)] border border-on-primary/10 overflow-hidden">
                  {/* User info header */}
                  <div className="px-md pt-md pb-sm border-b border-on-primary/10">
                    <p className="font-label-md text-label-md text-on-primary truncate">
                      {user.firstName ? `${user.firstName} ${user.lastName}`.trim() : user.email}
                    </p>
                    <p className="font-label-sm text-label-sm text-on-primary/50 truncate mt-[2px]">
                      {user.email}
                    </p>
                  </div>

                  {/* Menu items */}
                  <div className="py-xs">
                    <Link
                      to="/notifications"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-sm px-md py-sm text-on-primary/80 hover:text-on-primary hover:bg-on-primary/8 transition-colors font-label-md text-label-md"
                    >
                      <span className="material-symbols-outlined text-[18px]">notifications</span>
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] px-[4px] bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/my-reports"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-sm px-md py-sm text-on-primary/80 hover:text-on-primary hover:bg-on-primary/8 transition-colors font-label-md text-label-md"
                    >
                      <span className="material-symbols-outlined text-[18px]">pets</span>
                      My Reports
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-sm px-md py-sm text-on-primary/80 hover:text-on-primary hover:bg-on-primary/8 transition-colors font-label-md text-label-md"
                    >
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-sm px-md py-sm text-on-primary/80 hover:text-on-primary hover:bg-on-primary/8 transition-colors font-label-md text-label-md"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="text-on-primary opacity-60 hover:opacity-100 hover:text-primary-container transition-opacity font-label-md text-label-md"
            >
              Join
            </Link>
          )}
          <Link
            to="/report-missing"
            className="bg-primary text-on-primary px-md py-sm rounded-xl font-label-md text-label-md font-bold hover:scale-95 duration-100 transition-transform"
          >
            Report a Missing Cat
          </Link>
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
          {user ? (
            <>
              <Link
                to="/notifications"
                onClick={closeMenu}
                className="mt-md flex items-center gap-sm text-on-primary opacity-60 hover:opacity-100 font-label-md text-label-md py-sm"
              >
                <span className="material-symbols-outlined text-[18px]">notifications</span>
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-[4px] bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/my-reports"
                onClick={closeMenu}
                className="flex items-center gap-sm text-on-primary opacity-60 hover:opacity-100 font-label-md text-label-md py-sm"
              >
                <span className="material-symbols-outlined text-[18px]">pets</span>
                My Reports
              </Link>
              <Link
                to="/settings"
                onClick={closeMenu}
                className="flex items-center gap-sm text-on-primary opacity-60 hover:opacity-100 font-label-md text-label-md py-sm"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
                Settings
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-sm text-on-primary opacity-60 hover:opacity-100 font-label-md text-label-md py-sm"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={closeMenu}
              className="mt-md text-center text-on-primary opacity-60 hover:opacity-100 hover:text-primary-container transition-opacity font-label-md text-label-md py-sm"
            >
              Join
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
