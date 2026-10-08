import { useEffect, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import { InsightsView } from "@/components/nutrition/insights-view";
import { KitchenView } from "@/components/nutrition/kitchen-view";
import { MeView } from "@/components/nutrition/me-view";
import { GuardSheet } from "@/components/nutrition/more-sheets";
import { Pill } from "@/components/nutrition/nourish-ui";
import { TodayView } from "@/components/nutrition/today-view";
import { NOURISH } from "@/constants/design";
import { ThemeProvider } from "@/contexts/theme-context";
import { Screen } from "@/components/ds/screen";
import { ScreenHeader } from "@/components/ds/screen-header";
import { useNourish } from "@/hooks/use-nourish";
import {
  daysSinceLastChange,
  shouldGuardChange,
  withChange,
} from "@/services/nourish/targets";
import type { NourishSettings } from "@/types/nourish";
import { showToast } from "@/utils/toast";

export type NourishViewId = "today" | "insights" | "kitchen" | "me";

const TITLES: Record<Exclude<NourishViewId, "today">, string> = {
  insights: "Insights",
  kitchen: "Kitchen",
  me: "Me",
};

type PendingChange = {
  patch: Partial<NourishSettings>;
  description: string;
};

export function NourishApp({ requestedView }: { requestedView?: NourishViewId }) {
  const nourish = useNourish();
  const [view, setView] = useState<NourishViewId>(requestedView ?? "today");
  // Re-apply a deep-linked view when the route param changes while the tab
  // stays mounted (adjusting state during render, not in an effect).
  const [seenRequest, setSeenRequest] = useState(requestedView);
  const [pending, setPending] = useState<PendingChange | null>(null);

  if (requestedView !== seenRequest) {
    setSeenRequest(requestedView);

    if (requestedView) setView(requestedView);
  }

  useEffect(() => {
    if (view === "today") return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setView("today");

        return true;
      },
    );

    return () => subscription.remove();
  }, [view]);

  const settings = nourish.data?.settings;

  async function apply(change: PendingChange) {
    if (!settings) return;

    const next = withChange(settings, change.patch, change.description, new Date());
    const ok = await nourish.actions.saveSettings(next);

    if (ok) showToast("Targets updated", "success");
  }

  /** Targets changed twice inside two weeks make it hard to tell what is
   *  working, so a second change asks first. */
  function requestChange(
    patch: Partial<NourishSettings>,
    description: string,
  ) {
    if (!settings) return;

    if (shouldGuardChange(settings.changeLog, new Date())) {
      setPending({ patch, description });
    } else {
      void apply({ patch, description });
    }
  }

  return (
    <ThemeProvider theme={NOURISH}>
      <Screen scroll={false}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {view === "today" ? (
            <ScreenHeader
              eyebrow="NOURISH"
              title="Nutrition"
              right={
                <View style={s.nav}>
                  <Pill label="Insights" onPress={() => setView("insights")} />
                  <Pill label="Kitchen" onPress={() => setView("kitchen")} />
                  <Pill label="Me" onPress={() => setView("me")} />
                </View>
              }
            />
          ) : (
            <ScreenHeader
              eyebrow="NOURISH"
              title={TITLES[view]}
              onBack={() => setView("today")}
            />
          )}

          {view === "today" ? <TodayView nourish={nourish} /> : null}
          {view === "insights" ? (
            <InsightsView nourish={nourish} onChangeSettings={requestChange} />
          ) : null}
          {view === "kitchen" ? <KitchenView nourish={nourish} /> : null}
          {view === "me" ? (
            <MeView nourish={nourish} onChangeSettings={requestChange} />
          ) : null}

          <GuardSheet
            visible={pending !== null}
            daysAgo={
              settings ? (daysSinceLastChange(settings.changeLog, new Date()) ?? 0) : 0
            }
            onKeep={() => setPending(null)}
            onProceed={() => {
              const change = pending;

              setPending(null);

              if (change) void apply(change);
            }}
          />
        </KeyboardAvoidingView>
      </Screen>
    </ThemeProvider>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  nav: { flexDirection: "row", gap: 6 },
});
