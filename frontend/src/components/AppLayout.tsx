import { NavLink, Outlet } from 'react-router-dom';
import type { ChangeEvent } from 'react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { signInDemoUser, signOut } from '../features/auth/authSlice';
import { setLanguage, type SupportedLanguage } from '../features/language/languageSlice';
import { NotificationList } from './NotificationList';

export function AppLayout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const language = useAppSelector((state) => state.language.current);

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    dispatch(setLanguage(event.target.value as SupportedLanguage));
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <div>
          <p className="eyebrow">CatSOS</p>
          <h1>Rescue operations</h1>
        </div>
        <nav aria-label="Primary navigation" className="nav-links">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Dashboard
          </NavLink>
          <NavLink to="/intake" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Intake
          </NavLink>
        </nav>
        <div className="toolbar" aria-label="Session controls">
          <label htmlFor="language-select" className="sr-only">
            Language
          </label>
          <select id="language-select" value={language} onChange={handleLanguageChange}>
            <option value="en">EN</option>
            <option value="pl">PL</option>
          </select>
          {user ? (
            <button type="button" onClick={() => dispatch(signOut())}>
              Sign out
            </button>
          ) : (
            <button type="button" onClick={() => dispatch(signInDemoUser())}>
              Sign in
            </button>
          )}
        </div>
      </header>
      <NotificationList />
      <main id="main-content" className="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
