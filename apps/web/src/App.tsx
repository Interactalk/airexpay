import { Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardShell.tsx';
import { ApiKeysPage } from './pages/dashboard/ApiKeysPage.tsx';
import { InvoicesPage } from './pages/dashboard/InvoicesPage.tsx';
import { OverviewPage } from './pages/dashboard/OverviewPage.tsx';
import { PaymentLinksPage } from './pages/dashboard/PaymentLinksPage.tsx';
import { SettingsPage } from './pages/dashboard/SettingsPage.tsx';
import { WebhooksPage } from './pages/dashboard/WebhooksPage.tsx';
import { CheckoutRoutes } from './pages/CheckoutPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { PricingPage } from './pages/PricingPage.tsx';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/pay" element={<CheckoutRoutes />} />
      <Route path="/pay/demo/:state" element={<CheckoutRoutes />} />
      <Route path="/pay/:publicId" element={<CheckoutRoutes />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:invoiceId" element={<InvoicesPage />} />
        <Route path="payment-links" element={<PaymentLinksPage />} />
        <Route path="payment-links/new" element={<PaymentLinksPage creating />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="api-keys/:reviewState" element={<ApiKeysPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
