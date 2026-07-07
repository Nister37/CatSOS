import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { HomePage } from './pages/HomePage';
import { IntakePage } from './pages/IntakePage';
import { LoginPage } from './pages/LoginPage';
import { ReportStep1Page } from './pages/ReportStep1Page';
import { ReportStep2Page } from './pages/ReportStep2Page';
import { ReportStep3Page } from './pages/ReportStep3Page';
import { SheltersPage } from './pages/SheltersPage';
import { ReportSightingPage } from './pages/ReportSightingPage';
import { SightingsMapResultsPage } from './pages/SightingsMapResultsPage';
import { SightingsMapSearchPage } from './pages/SightingsMapSearchPage';
import { SignupPage } from './pages/SignupPage';
import { AboutPage } from './pages/AboutPage';
import { MyReportPage } from './pages/MyReportPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { MissingCatsPage } from './pages/MissingCatsPage';
import { MyReportsPage } from './pages/MyReportsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { ContactPage } from './pages/ContactPage';
import { GeneratePosterPage } from './pages/GeneratePosterPage';
import { RequireAuth } from './components/RequireAuth';

export function App() {
  return (
    <>
      <ScrollToTop />
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
      <Route path="missing" element={<MissingCatsPage />} />
      <Route path="notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
      <Route path="my-reports" element={<RequireAuth><MyReportsPage /></RequireAuth>} />
      <Route path="my-reports/:id" element={<RequireAuth><MyReportPage /></RequireAuth>} />
      <Route path="map" element={<SightingsMapSearchPage />} />
      <Route path="map/results" element={<SightingsMapResultsPage />} />
      <Route path="report-sighting" element={<ReportSightingPage />} />
      <Route path="shelters" element={<SheltersPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route path="verify-email" element={<EmailVerificationPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="password-reset/confirm" element={<ResetPasswordPage />} />
      <Route path="about" element={<AboutPage />} />
      <Route path="settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="privacy" element={<PrivacyPage />} />
      <Route path="terms" element={<TermsPage />} />
      <Route path="contact" element={<ContactPage />} />
      <Route path="generate-poster" element={<RequireAuth><GeneratePosterPage /></RequireAuth>} />
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
