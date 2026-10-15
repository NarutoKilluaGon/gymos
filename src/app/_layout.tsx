import { DarkTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';

import AppTabs from '@/components/app-tabs';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { ToastHost } from '@/components/ui/toast-host';
import { ModulesProvider } from '@/contexts/modules-context';
import { getOnboardingComplete } from '@/storage/repositories/onboarding';
import { startStepTracking, stopStepTracking } from '@/services/steps';
import { applyReminders, setupNotifications } from '@/services/notifications';
import { getReminderPrefs } from '@/storage/repositories/reminders';
import { Q } from '@/constants/quiet';

SplashScreen.preventAutoHideAsync();

const QuietNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Q.color.bg,
    card: Q.color.bg,
    text: Q.color.ink,
    border: Q.color.line,
    primary: Q.accent.brass,
  },
};

export default function TabLayout() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | undefined>(undefined);

  const [fontsLoaded, fontError] = useFonts({
    'FunnelDisplay-Regular': require('../../assets/fonts/FunnelDisplay-Regular.ttf'),
    'FunnelDisplay-Medium': require('../../assets/fonts/FunnelDisplay-Medium.ttf'),
    'FunnelDisplay-SemiBold': require('../../assets/fonts/FunnelDisplay-SemiBold.ttf'),
    'FunnelSans-Regular': require('../../assets/fonts/FunnelSans-Regular.ttf'),
    'FunnelSans-Medium': require('../../assets/fonts/FunnelSans-Medium.ttf'),
    'FunnelSans-SemiBold': require('../../assets/fonts/FunnelSans-SemiBold.ttf'),
  });

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
    });
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && onboardingComplete !== undefined) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, onboardingComplete]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={QuietNavTheme}>
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
