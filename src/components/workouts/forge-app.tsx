import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  StyleSheet,
  View,
} from "react-native";

import { createDraftRegistry, ForgeSession } from "@/components/workouts/forge-session";
import { HistoryView } from "@/components/workouts/forge-history";
import { PlanView } from "@/components/workouts/forge-plan";
import { TodayView } from "@/components/workouts/forge-today";
import { Seg } from "@/components/workouts/forge-ui";
import { F } from "@/constants/forge-theme";
import { FORGE } from "@/constants/design";
import { ThemeProvider } from "@/contexts/theme-context";
import { Screen } from "@/components/ds/screen";
import { ScreenHeader } from "@/components/ds/screen-header";
import { useForge } from "@/hooks/use-forge";
import type { WorkoutSession } from "@/types/gymos";

type Tab = "today" | "plan" | "history";

const TABS = [
  { value: "today", label: "Today" },
  { value: "plan", label: "Plan" },
  { value: "history", label: "History" },
] as const;

export function ForgeApp() {
  const forge = useForge();
  const [tab, setTab] = useState<Tab>("today");
  const [open, setOpen] = useState<WorkoutSession | null>(null);
  const { data, unit, actions, reload } = forge;
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const closing = useRef(false);
  // Number fields on the Plan tab; committed before the tab is left.
  const [planDrafts] = useState(createDraftRegistry);

  /**
   * Leave the open session. The session's save queue is drained first, so the
   * reload below always reads the latest edit instead of racing it.
   */
  const closeSession = useCallback(async () => {
    if (closing.current) return;

    closing.current = true;

    try {
      await flushRef.current?.();
      setOpen(null);
      await reload();
    } finally {
      closing.current = false;
    }
  }, [reload]);

  /** Open a workout from what is stored, not from the list held in memory. */
  const openSession = useCallback(
    async (stale: WorkoutSession) => {
      const fresh = await actions.resume(stale.id);

      if (fresh) setOpen(fresh);
      else void reload();
    },
    [actions, reload],
  );

  useEffect(() => {
    if (!open) return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      void closeSession();

      return true;
    });

    return () => subscription.remove();
  }, [open, closeSession]);

  // Leaving the foreground can end the process before any blur or unmount
  // runs, so commit every typed-but-uncommitted field now (Plan tab and open
  // session) and let the open session's save queue drain.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") return;

      planDrafts.flushAll();
      flushRef.current?.().catch(() => undefined);
    });

    return () => subscription.remove();
  }, [planDrafts]);

  if (!data) {
    return (
      <ThemeProvider theme={FORGE}>
        <Screen scroll={false}>
          <View style={s.center}>
            <ActivityIndicator color={F.acc} />
          </View>
        </Screen>
      </ThemeProvider>
    );
  }

  if (open) {
    return (
      <ThemeProvider theme={FORGE}>
        <ForgeSession
          key={open.id}
          initial={open}
          data={data}
          unit={unit}
          flushRef={flushRef}
          onClose={() => void closeSession()}
          onDelete={actions.remove}
          onCreateExercise={actions.addCustom}
          onChanged={() => void reload()}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={FORGE}>
      <Screen keyboardShouldPersistTaps="handled">
        <ScreenHeader eyebrow="FORGE" title="Workouts" />
        <View style={s.tabs}>
          <Seg
            options={TABS}
            value={tab}
            onChange={(next) => {
              planDrafts.flushAll();
              setTab(next);
            }}
          />
        </View>

        {tab === "today" ? (
          <TodayView
            data={data}
            unit={unit}
            weightKg={forge.weightKg}
            onGoPlan={() => setTab("plan")}
            onOpen={(session) => void openSession(session)}
            onStart={(input) => {
              void actions.begin(input).then((session) => {
                if (session) setOpen(session);
              });
            }}
            onAddCardio={actions.addCardio}
            onRemoveCardio={(day, id) => void actions.removeCardio(day, id)}
          />
        ) : null}
        {tab === "plan" ? (
          <PlanView
            data={data}
            unit={unit}
            onSave={actions.saveSettings}
            onCreateExercise={actions.addCustom}
            drafts={planDrafts}
          />
        ) : null}
        {tab === "history" ? <HistoryView data={data} unit={unit} onOpen={(session) => void openSession(session)} /> : null}
      </Screen>
    </ThemeProvider>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabs: { marginBottom: 16 },
});
