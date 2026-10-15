import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { RotateCcw, X } from "lucide-react-native";

import { Button, Field, Label, Pill, Sheet } from "@/components/nutrition/nourish-ui";
import { N, NRadius } from "@/constants/nourish-theme";
import { clock, parseClock, type FoodLogger } from "@/hooks/use-food-logger";
import { FoodItemCard } from "@/components/nutrition/food-item-card";
import { slotForTime } from "@/services/nourish/slots";
import { MEAL_SLOTS, type Meal, type MealSlot } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";
import { useReducedMotion } from "@/utils/motion";

function SlotPicker({
  value,
  onChange,
}: {
  value: MealSlot;
  onChange: (slot: MealSlot) => void;
}) {
  return (
    <View style={s.wrap}>
      {MEAL_SLOTS.map((slot) => (
        <Pill
          key={slot}
          label={slot}
          active={slot === value}
          onPress={() => onChange(slot)}
        />
      ))}
    </View>
  );
}

function EstimatingRow({
  segment,
  reducedMotion,
}: {
  segment: string;
  reducedMotion: boolean;
}) {
  return (
    <View style={s.estimatingCard}>
      <View style={s.itemMain}>
        <Text style={s.itemName} numberOfLines={1}>
          {segment}
        </Text>
        <Text style={s.estimatingHint}>Estimating…</Text>
      </View>
      {reducedMotion ? (
        <View style={s.staticSpinner} />
      ) : (
        <ActivityIndicator size="small" color={N.acc} />
      )}
    </View>
  );
}

function FailedRow({
  segment,
  error,
  onRetry,
  onManual,
  onRemove,
}: {
  segment: string;
  error?: string;
  onRetry: () => void;
  onManual: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={s.failedCard}>
      <View style={s.failedTop}>
        <View style={s.itemMain}>
          <Text style={s.itemName} numberOfLines={1}>
            {segment}
          </Text>
          <Text style={s.failedErrorText}>{error ?? "Couldn't estimate. Retry"}</Text>
        </View>
        <Pressable
          accessibilityLabel={`Remove ${segment}`}
          onPress={onRemove}
          hitSlop={8}
          style={s.failedRemoveBtn}
        >
          <X size={16} color={N.dim} />
        </Pressable>
      </View>
      <View style={s.failedActionsRow}>
        <Pressable
          accessibilityLabel={`Retry estimating ${segment}`}
          onPress={onRetry}
          style={s.retryBtn}
        >
          <RotateCcw size={14} color={N.acc} />
          <Text style={s.retryBtnText}>Retry</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Enter macros manually for ${segment}`}
          onPress={onManual}
          style={s.manualBtn}
        >
          <Text style={s.manualBtnText}>Enter manually</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** "Check before saving": nothing is written until the user confirms. */
export function ReviewSheet({ logger }: { logger: FoodLogger }) {
  const reducedMotion = useReducedMotion();
  const { review, setReview, busy } = logger;
  const stagedSegments = review?.stagedSegments;
  const items = review?.items ?? [];
  const calories = items.reduce((sum, i) => sum + i.calories * i.multiplier, 0);
  const protein = items.reduce((sum, i) => sum + i.protein * i.multiplier, 0);
  const timeOk = !review?.at || parseClock(review.at) !== null;

  const hasEstimating = stagedSegments
    ? stagedSegments.some((s) => s.status === "estimating")
    : (review?.estimating ?? false);

  const hasFailed = stagedSegments
    ? stagedSegments.some((s) => s.status === "failed")
    : false;

  const isSaveDisabled = hasEstimating || hasFailed || items.length === 0 || !timeOk;

  let title = "Check before saving";
  if (review?.isColdStart) {
    title = "Waking up the estimator... (first one can take up to 45s)";
  } else if (hasEstimating) {
    const current = review?.estimatingProgress?.current ?? 1;
    const total = review?.estimatingProgress?.total ?? 1;
    title = `Estimating ${current} of ${total}...`;
  }

  const saveLabel = hasEstimating
    ? "Estimating..."
    : `Save ${items.length} ${items.length === 1 ? "item" : "items"}`;

  return (
    <Sheet
      visible={review !== null}
      onClose={() => setReview(null)}
      title={title}
      footer={
        <>
          <Button
            label={saveLabel}
            onPress={() => void logger.confirm()}
            busy={busy}
            disabled={isSaveDisabled}
          />
          <Button label="Cancel" kind="ghost" onPress={() => setReview(null)} />
        </>
      }
    >
      {review?.notice ? <Text style={s.notice}>{review.notice}</Text> : null}
      {logger.eatingOut ? (
        <Text style={s.notice}>
          Eating out is on, so these are marked as rough guesses. Adjust the
          portion if you know better.
        </Text>
      ) : null}
      {stagedSegments ? (
        stagedSegments.map((seg) => {
          if (seg.status === "estimating") {
            return (
              <EstimatingRow
                key={seg.id}
                segment={seg.segment}
                reducedMotion={reducedMotion}
              />
            );
          }
          if (seg.status === "failed") {
            return (
              <FailedRow
                key={seg.id}
                segment={seg.segment}
                error={seg.error}
                onRetry={() => void logger.retrySegment(seg.id)}
                onManual={() => {
                  logger.removeStagedSegment(seg.id);
                  logger.openManual(seg.segment, review?.slot);
                }}
                onRemove={() => logger.removeStagedSegment(seg.id)}
              />
            );
          }
          if (seg.item) {
            return (
              <FoodItemCard
                key={seg.id}
                item={seg.item}
                status={seg.status}
                onChange={(next) => logger.updateStagedItem(seg.id, next)}
                onRemove={() => logger.removeStagedSegment(seg.id)}
              />
            );
          }
          return null;
        })
      ) : (
        items.map((item, index) => (
          <FoodItemCard
            key={`${item.name}-${index}`}
            item={item}
            status={
              item.calories === 0 && item.protein === 0 && item.carbs === 0 && item.fat === 0
                ? "needs-input"
                : item.source === "saved" || item.source === "catalog"
                  ? "matched"
                  : "estimated"
            }
            onChange={(next) =>
              setReview((r) =>
                r ? { ...r, items: r.items.map((x, i) => (i === index ? next : x)) } : r,
              )
            }
            onRemove={() =>
              setReview((r) =>
                r ? { ...r, items: r.items.filter((_, i) => i !== index) } : r,
              )
            }
          />
        ))
      )}
      <Text style={s.total}>
        {Math.round(calories)} kcal · {Math.round(protein)}g protein
      </Text>
      <Label>Meal</Label>
      <SlotPicker
        value={review?.slot ?? "Snacks"}
        onChange={(slot) => setReview((r) => (r ? { ...r, slot } : r))}
      />
      {review ? (
        <View style={s.timeRow}>
          <Field
            label="Eaten at (24h)"
            value={review.at}
            onChangeText={(at) => {
              const parsed = parseClock(at);
              setReview((r) =>
                r
                  ? {
                      ...r,
                      at,
                      ...(parsed ? { slot: slotForTime(parsed) } : {}),
                    }
                  : r,
              );
            }}
            placeholder="13:30"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          {!timeOk ? <Text style={s.error}>Use HH:MM, like 13:30</Text> : null}
        </View>
      ) : null}
    </Sheet>
  );
}

function num(value: string): number | null {
  if (value.trim() === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function defaultSlotForManual(manualSlot?: MealSlot, at?: string): MealSlot {
  if (manualSlot && MEAL_SLOTS.includes(manualSlot)) return manualSlot;
  if (at && parseClock(at)) return slotForTime(at);
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return slotForTime(hm);
}

/** Add a food by typing its numbers (also where unreadable text lands). */
export function ManualSheet({ logger }: { logger: FoodLogger }) {
  const { manual, setManual, busy } = logger;

  return (
    <Sheet
      visible={manual !== null}
      onClose={() => setManual(null)}
      title="Add food"
    >
      {manual ? (
        <ManualForm
          key={manual.name + (manual.slot ?? "")}
          initialName={manual.name}
          initialSlot={manual.slot}
          initialAt={manual.at}
          busy={busy}
          onSave={(item, slot, at) => void logger.saveManual(item, slot, at)}
          onCancel={() => setManual(null)}
        />
      ) : null}
    </Sheet>
  );
}

function ManualForm({
  initialName,
  initialSlot,
  initialAt,
  busy,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialSlot?: MealSlot;
  initialAt?: string;
  busy: boolean;
  onSave: (item: DraftItem, slot: MealSlot, at?: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [qty, setQty] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [at, setAt] = useState(() => initialAt || clock(new Date()));
  const [slot, setSlot] = useState<MealSlot>(() => defaultSlotForManual(initialSlot, initialAt));
  const [touched, setTouched] = useState(false);

  const timeOk = !at || parseClock(at) !== null;
  const values = [kcal, p, c, f].map(num);
  const invalid = values.some((v) => Number.isNaN(v));
  const protein = values[1] ?? 0;
  const carbs = values[2] ?? 0;
  const fat = values[3] ?? 0;
  const calories = values[0] ?? Math.round(4 * protein + 4 * carbs + 9 * fat);
  const hasNumbers = values.some((v) => v !== null);
  const ok = name.trim().length > 0 && hasNumbers && !invalid && timeOk;

  return (
    <View>
      <Field
        label="Food name"
        value={name}
        onChangeText={setName}
        onBlur={() => setTouched(true)}
        placeholder="Paneer bhurji"
      />
      <Field
        label="Amount (optional)"
        value={qty}
        onChangeText={setQty}
        onBlur={() => setTouched(true)}
        placeholder="1 plate"
      />
      <View style={s.grid}>
        <View style={s.half}>
          <Field
            label="Calories"
            value={kcal}
            onChangeText={setKcal}
            onBlur={() => setTouched(true)}
            keyboardType="decimal-pad"
            placeholder="auto"
            style={s.macroInput}
          />
        </View>
        <View style={s.half}>
          <Field
            label="Protein (g)"
            value={p}
            onChangeText={setP}
            onBlur={() => setTouched(true)}
            keyboardType="decimal-pad"
            placeholder="0"
            style={s.macroInput}
          />
        </View>
      </View>
      <View style={s.grid}>
        <View style={s.half}>
          <Field
            label="Carbs (g)"
            value={c}
            onChangeText={setC}
            onBlur={() => setTouched(true)}
            keyboardType="decimal-pad"
            placeholder="0"
            style={s.macroInput}
          />
        </View>
        <View style={s.half}>
          <Field
            label="Fat (g)"
            value={f}
            onChangeText={setF}
            onBlur={() => setTouched(true)}
            keyboardType="decimal-pad"
            placeholder="0"
            style={s.macroInput}
          />
        </View>
      </View>
      <Text style={s.helper}>
        Calories are filled in from macros if you leave them blank
      </Text>
      {touched && !ok ? (
        <Text style={s.error}>
          {name.trim() === ""
            ? "Add a food name."
            : invalid
              ? "Numbers only, zero or more."
              : !hasNumbers
                ? "Add at least one number."
                : "Use HH:MM, like 13:30"}
        </Text>
      ) : null}
      <Label>Meal</Label>
      <SlotPicker value={slot} onChange={setSlot} />
      <View style={s.timeRow}>
        <Field
          label="Eaten at (24h)"
          value={at}
          onChangeText={(newAt) => {
            setAt(newAt);
            const parsed = parseClock(newAt);
            if (parsed) {
              setSlot(slotForTime(parsed));
            }
          }}
          placeholder="13:30"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        {!timeOk ? <Text style={s.error}>Use HH:MM, like 13:30</Text> : null}
      </View>
      <View style={s.manualButtons}>
        <Button
          label="Save"
          busy={busy}
          disabled={!timeOk}
          onPress={() => {
            setTouched(true);

            if (!ok) return;

            onSave(
              {
                name: name.trim(),
                qty: qty.trim() || "1 serving",
                calories,
                protein,
                carbs,
                fat,
                confidence: 0.95,
                multiplier: 1,
                source: "manual",
              },
              slot,
              at,
            );
          }}
        />
        <Button label="Cancel" kind="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

/** Adjust, move or delete an existing diary entry. */
export function EditEntrySheet({
  meal,
  onClose,
  onSave,
  onDelete,
  initialSlot,
  initialAt,
  busy,
}: {
  meal: Meal | null;
  onClose: () => void;
  onSave: (
    factor: number,
    slot: MealSlot,
    at: string,
    macros?: { calories: number; protein: number; carbs: number; fat: number },
    name?: string,
    qty?: string,
  ) => void;
  onDelete: () => void;
  initialSlot: MealSlot;
  initialAt: string;
  busy: boolean;
}) {
  return (
    <Sheet visible={meal !== null} onClose={onClose} title="Edit entry">
      {meal ? (
        <EditForm
          key={meal.id}
          meal={meal}
          initialSlot={initialSlot}
          initialAt={initialAt}
          busy={busy}
          onSave={onSave}
          onDelete={onDelete}
          onCancel={onClose}
        />
      ) : null}
    </Sheet>
  );
}

function EditForm({
  meal,
  initialSlot,
  initialAt,
  busy,
  onSave,
  onDelete,
  onCancel,
}: {
  meal: Meal;
  initialSlot: MealSlot;
  initialAt: string;
  busy: boolean;
  onSave: (
    factor: number,
    slot: MealSlot,
    at: string,
    macros?: { calories: number; protein: number; carbs: number; fat: number },
    name?: string,
    qty?: string,
  ) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [draftItem, setDraftItem] = useState<DraftItem>(() => ({
    name: meal.name,
    qty: meal.qty ?? "1 serving",
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
    multiplier: 1,
    confidence: meal.confidence ?? 0.9,
    source: "saved",
  }));
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [at, setAt] = useState(initialAt);
  const timeOk = parseClock(at) !== null;

  return (
    <View>
      <FoodItemCard
        item={draftItem}
        status={
          draftItem.calories === 0 &&
          draftItem.protein === 0 &&
          draftItem.carbs === 0 &&
          draftItem.fat === 0
            ? "needs-input"
            : "matched"
        }
        onChange={setDraftItem}
      />
      <Label>Meal</Label>
      <SlotPicker value={slot} onChange={setSlot} />
      <Field
        label="Eaten at (24h)"
        value={at}
        onChangeText={setAt}
        placeholder="13:30"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
      {!timeOk ? <Text style={s.error}>Use HH:MM, like 13:30</Text> : null}
      <View style={s.manualButtons}>
        <Button
          label="Save"
          busy={busy}
          disabled={!timeOk}
          onPress={() =>
            onSave(
              draftItem.multiplier,
              slot,
              parseClock(at) ?? "",
              {
                calories: draftItem.calories,
                protein: draftItem.protein,
                carbs: draftItem.carbs,
                fat: draftItem.fat,
              },
              draftItem.name,
              draftItem.qty,
            )
          }
        />
        <Button label="Delete" kind="danger" onPress={onDelete} />
        <Button label="Cancel" kind="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  item: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    padding: 14,
    marginBottom: 10,
  },
  itemHead: { flexDirection: "row", justifyContent: "space-between" },
  itemMain: { flex: 1, paddingRight: 8 },
  itemName: { color: N.ink, fontSize: 16, fontWeight: "600" },
  itemQty: { color: N.mute, fontSize: 13, marginTop: 2 },
  itemMacros: { color: N.ink, fontSize: 13, marginTop: 8 },
  itemFoot: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  conf: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  confText: { color: N.mute, fontSize: 12 },
  remove: { color: N.dim, fontSize: 16, paddingHorizontal: 4 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: N.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: N.ink, fontSize: 18 },
  stepValue: { color: N.ink, fontSize: 14, minWidth: 40, textAlign: "center" },
  notice: {
    color: N.warn,
    fontSize: 13,
    marginBottom: 10,
  },
  total: { color: N.ink, fontSize: 15, fontWeight: "600", marginVertical: 8 },
  timeRow: { marginTop: 4 },
  error: { color: N.bad, fontSize: 12, marginBottom: 8 },
  grid: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  manualButtons: { gap: 8, marginTop: 8 },
  gapBottom: { marginBottom: 12 },
  helper: {
    color: N.mute,
    fontSize: 12,
    marginBottom: 10,
    marginTop: -4,
  },
  macroInput: {
    minHeight: 48,
    height: 48,
  },
  estimatingCard: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.line,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  estimatingHint: {
    color: N.mute,
    fontSize: 12,
    marginTop: 2,
  },
  staticSpinner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: N.mute,
  },
  failedCard: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: 1,
    borderColor: N.bad,
    padding: 14,
    marginBottom: 10,
  },
  failedTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  failedRemoveBtn: {
    padding: 4,
  },
  failedErrorText: {
    color: N.bad,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  failedActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: NRadius.control,
    backgroundColor: N.card2,
  },
  retryBtnText: {
    color: N.acc,
    fontSize: 13,
    fontWeight: "600",
  },
  manualBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  manualBtnText: {
    color: N.mute,
    fontSize: 13,
  },
});
