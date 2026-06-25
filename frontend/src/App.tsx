import { Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { IntakePage } from './pages/IntakePage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="intake" element={<IntakePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
