import { Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { HomePage } from './pages/HomePage';
import { IntakePage } from './pages/IntakePage';
import { LoginPage } from './pages/LoginPage';
import { ReportStep1Page } from './pages/ReportStep1Page';
import { ReportStep2Page } from './pages/ReportStep2Page';
import { ReportStep3Page } from './pages/ReportStep3Page';
import { SignupPage } from './pages/SignupPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="report-missing">
        <Route index element={<ReportStep1Page />} />
        <Route path="location" element={<ReportStep2Page />} />
        <Route path="contact" element={<ReportStep3Page />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="intake" element={<IntakePage />} />
      </Route>
      <Route path="login" element={<LoginPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route path="verify-email" element={<EmailVerificationPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
