import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ManualSheet, ReviewSheet } from "@/components/nutrition/log-sheets";
import { Button, Field, Pill, Sheet } from "@/components/nutrition/nourish-ui";
import { N } from "@/constants/nourish-theme";
import { useFoodLogger } from "@/hooks/use-food-logger";
import { saveDraft } from "@/services/nourish/diary";
import {
  getSavedFoods,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import type { MealSlot } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

const NO_SLOTS: ReadonlySet<MealSlot> = new Set();

/**
 * Quick "log food" from anywhere in the app. Same resolve → review → save
 * flow as the Nutrition tab, always for today. The input sheet steps aside
 * while the review is open and comes back (text intact) if it is cancelled.
 */
export function LogFoodSheet({
  visible,
  onClose,
  onLogged,
}: {
  visible: boolean;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState<SavedFood[]>([]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    getSavedFoods()
      .then((foods) => {
        if (!cancelled) setSaved(foods);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const logger = useFoodLogger({
    dayKey: getTodayKey(),
    saved,
    filled: NO_SLOTS,
    save: async (args) => {
      try {
        await saveDraft(args);

        return true;
      } catch {
        showToast("Couldn't save");

        return false;
      }
    },
    onCardioText: () =>
      showToast("That looks like exercise. Log cardio from the Nutrition tab."),
    onLogged: () => {
      setText("");
      onClose();
      onLogged?.();
    },
  });

  const stepAside = logger.review !== null || logger.manual !== null;

  return (
    <>
      <Sheet
        visible={visible && !stepAside}
        onClose={onClose}
        title="Log food"
        footer={
          <>
            <Button
              label="Check it"
              busy={logger.busy}
              disabled={text.trim() === ""}
              onPress={() => void logger.submit(text)}
            />
            <Button label="Add manually" kind="ghost" onPress={() => logger.openManual(text)} />
          </>
        }
      >
        <Field
          value={text}
          onChangeText={setText}
          placeholder="2 rotis, dal, paneer bhurji"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void logger.submit(text)}
        />
        <View style={s.row}>
          <Pill
            label="Eating out"
            active={logger.eatingOut}
            onPress={() => logger.setEatingOut(!logger.eatingOut)}
          />
        </View>
        <Text style={s.hint}>
          Name the meal to file it (“for dinner”), or it goes by time of day.
        </Text>
      </Sheet>
      <ReviewSheet logger={logger} />
      <ManualSheet logger={logger} />
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: 12 },
  hint: { color: N.mute, fontSize: 13, lineHeight: 18 },
});
