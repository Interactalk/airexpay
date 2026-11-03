import { Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pay" element={<CheckoutPage />} />
        <Route path="/pay/demo/:state" element={<CheckoutPage />} />
        <Route path="/pay/:publicId" element={<CheckoutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Shell>
  );
}
