import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { signOut } from '../features/auth/authSlice';
import { LanguageSelector } from './LanguageSelector';
import { NotificationList } from './NotificationList';

export function AppLayout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

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
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Dashboard
          </NavLink>
          <NavLink to="/intake" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Intake
          </NavLink>
        </nav>
        <div className="toolbar" aria-label="Session controls">
          <LanguageSelector id="language-select" variant="toolbar" ariaLabel="Language" />
          {user ? (
            <button type="button" onClick={() => dispatch(signOut())}>
              Sign out ({user.firstName || user.email})
            </button>
          ) : (
            <Link to="/login">Sign in</Link>
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
