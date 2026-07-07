import { Navigate, useLocation } from 'react-router-dom';

import { useAppSelector } from '../app/hooks';

export function RequireAuth({ children }: { children: React.ReactElement }) {
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
