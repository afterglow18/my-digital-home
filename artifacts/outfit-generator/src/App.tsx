import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { AppLayout } from './components/layout/AppLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';
import FavoritesPage from './pages/favorites';
import BackupPage from './pages/backup';
import WelcomePage from './pages/welcome';
import { LockedScreen } from './components/LockedScreen';
import { queryClient } from '@/lib/queryClient';
import { useState, useEffect } from 'react';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { initRevenueCat, tierFromCustomerInfo } from '@/lib/revenuecat';
import { syncFromRevenueCat, setGlobalTier } from '@/hooks/useEntitlements';
import { useBiometricLock } from '@/hooks/useBiometricLock';
import { BiometricLockContext } from '@/contexts/BiometricLockContext';
import { AnimatePresence } from 'framer-motion';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
      <h1 className="text-6xl font-display font-bold text-primary drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">404</h1>
      <p className="text-xl font-bold uppercase">As if! This page is totally lost.</p>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={WardrobePage} />
        <Route path="/generate" component={GeneratePage} />
        <Route path="/saved" component={SavedPage} />
        <Route path="/favorites" component={FavoritesPage} />
        <Route path="/backup" component={BackupPage} />
        <Redirect to="/" />
      </Switch>
    </AppLayout>
  );
}

function AppShell() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
  const [entered, setEntered] = useState<boolean>(() => isPreview);
  const { enabled, isLocked, authenticate, enableLock, disableLock } = useBiometricLock();

  useEffect(() => {
    let listenerId: string | null = null;

    // 1. Init SDK then immediately sync entitlement from RevenueCat.
    //    This ensures the cached tier is validated against a live server
    //    check on every cold launch.
    (async () => {
      try {
        await initRevenueCat();
        await syncFromRevenueCat();
      } catch (e) {
        console.error('[RevenueCat] Launch init/sync failed:', e);
      }

      // 2. Real-time listener — fires whenever RevenueCat detects a change
      //    (purchase, refund, subscription expiry, billing retry, etc.).
      //    Tier is derived from live CustomerInfo, never from a local flag.
      try {
        listenerId = await Purchases.addCustomerInfoUpdateListener(
          (customerInfo) => {
            const tier = tierFromCustomerInfo(customerInfo);
            setGlobalTier(tier);
          },
        );
      } catch (e) {
        console.warn('[RevenueCat] Could not add CustomerInfo listener:', e);
      }
    })();

    // 3. Re-sync whenever the app returns to the foreground.
    //    Catches subscription lapses / refunds that happened while backgrounded.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromRevenueCat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (listenerId) {
        Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerId }).catch(() => {});
      }
    };
  }, []);

  return (
    <BiometricLockContext.Provider value={{ enabled, enableLock, disableLock }}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
        {!entered && <WelcomePage onEnter={() => setEntered(true)} />}
      </WouterRouter>

      {/* Biometric lock gate — sits above everything including the welcome splash */}
      <AnimatePresence>
        {isLocked && (
          <LockedScreen key="locked" onAuthenticate={authenticate} />
        )}
      </AnimatePresence>
    </BiometricLockContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}

export default App;
