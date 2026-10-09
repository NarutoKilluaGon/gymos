import { DarkTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ReduceMotion, ReducedMotionConfig } from 'react-native-reanimated';

import AppTabs from '@/components/app-tabs';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { ToastHost } from '@/components/ui/toast-host';
import { ModulesProvider } from '@/contexts/modules-context';
import { getOnboardingComplete } from '@/storage/repositories/onboarding';
import { startStepTracking, stopStepTracking } from '@/services/steps';
import { applyReminders, setupNotifications } from '@/services/notifications';
import { getReminderPrefs } from '@/storage/repositories/reminders';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    void startStepTracking();
    return () => stopStepTracking();
  }, []);

  // Restore scheduled reminders on every launch (idempotent re-apply).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await setupNotifications();
        const prefs = await getReminderPrefs();
        if (!cancelled) {
          await applyReminders(prefs);
        }
      } catch {
        // Notifications are best-effort; never block app startup.
        console.warn("Failed to restore reminders");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getOnboardingComplete().then((complete) => {
      setOnboardingComplete(complete);
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <ReducedMotionConfig mode={ReduceMotion.System} />
      <StatusBar style="light" />
      <AnimatedSplashOverlay />
      <ToastHost />
      {onboardingComplete === false && (
        <OnboardingScreen onDone={() => setOnboardingComplete(true)} />
      )}
      {onboardingComplete === true && (
        <ModulesProvider>
          <AppTabs />
        </ModulesProvider>
      )}
    </ThemeProvider>
  );
}
