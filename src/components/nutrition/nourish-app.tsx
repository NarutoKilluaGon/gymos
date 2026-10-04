import { useEffect, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { InsightsView } from "@/components/nutrition/insights-view";
import { KitchenView } from "@/components/nutrition/kitchen-view";
import { MeView } from "@/components/nutrition/me-view";
import { GuardSheet } from "@/components/nutrition/more-sheets";
import { Pill } from "@/components/nutrition/nourish-ui";
import { TodayView } from "@/components/nutrition/today-view";
import { N, NSerif } from "@/constants/nourish-theme";
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
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.header}>
        {view === "today" ? (
          <>
            <Text style={s.title}>Nourish</Text>
            <View style={s.nav}>
              <Pill label="Insights" onPress={() => setView("insights")} />
              <Pill label="Kitchen" onPress={() => setView("kitchen")} />
              <Pill label="Me" onPress={() => setView("me")} />
            </View>
          </>
        ) : (
          <>
            <Pill label="‹ Today" onPress={() => setView("today")} />
            <Text style={s.title}>{TITLES[view]}</Text>
          </>
        )}
      </View>

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
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 4,
  },
  title: {
    fontFamily: NSerif,
    fontWeight: "300",
    fontSize: 26,
    color: N.ink,
  },
  nav: { flexDirection: "row", gap: 6 },
});
