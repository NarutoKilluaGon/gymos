import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ForgeSession } from "@/components/workouts/forge-session";
import { HistoryView } from "@/components/workouts/forge-history";
import { PlanView } from "@/components/workouts/forge-plan";
import { TodayView } from "@/components/workouts/forge-today";
import { Seg } from "@/components/workouts/forge-ui";
import { F, FSerif } from "@/constants/forge-theme";
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

  useEffect(() => {
    if (!open) return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setOpen(null);
      void reload();

      return true;
    });

    return () => subscription.remove();
  }, [open, reload]);

  if (!data) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={F.acc} />
      </View>
    );
  }

  if (open) {
    return (
      <ForgeSession
        key={open.id}
        initial={open}
        data={data}
        unit={unit}
        onClose={() => {
          setOpen(null);
          void reload();
        }}
        onDelete={actions.remove}
        onCreateExercise={actions.addCustom}
        onChanged={() => void reload()}
      />
    );
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={s.eyebrow}>FORGE</Text>
        <Text style={s.title}>Workouts</Text>
        <View style={s.tabs}>
          <Seg options={TABS} value={tab} onChange={setTab} />
        </View>

        {tab === "today" ? (
          <TodayView
            data={data}
            unit={unit}
            weightKg={forge.weightKg}
            onGoPlan={() => setTab("plan")}
            onOpen={setOpen}
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
          />
        ) : null}
        {tab === "history" ? <HistoryView data={data} unit={unit} onOpen={setOpen} /> : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: F.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 96 },
  eyebrow: { color: F.acc, fontSize: 11, letterSpacing: 2 },
  title: { color: F.ink, fontFamily: FSerif, fontSize: 34, fontWeight: "300", marginBottom: 14 },
  tabs: { marginBottom: 16 },
});
