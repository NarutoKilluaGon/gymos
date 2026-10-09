import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Field, Label, Pill, Sheet, tap } from "@/components/nutrition/nourish-ui";
import { N, NRadius } from "@/constants/nourish-theme";
import { parseClock, type FoodLogger } from "@/hooks/use-food-logger";
import { confidenceLabel } from "@/services/nourish/nutrition";
import { MEAL_SLOTS, type Meal, type MealSlot } from "@/types/gymos";
import type { DraftItem } from "@/types/nourish";

const STEP = 0.25;
const MAX_MULTIPLIER = 20;

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

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={s.stepper}>
      <Pressable
        accessibilityLabel="Smaller portion"
        hitSlop={8}
        onPress={() => {
          tap();
          onChange(Math.max(STEP, value - STEP));
        }}
        style={s.stepBtn}
      >
        <Text style={s.stepText}>−</Text>
      </Pressable>
      <Text style={s.stepValue}>×{value}</Text>
      <Pressable
        accessibilityLabel="Bigger portion"
        hitSlop={8}
        onPress={() => {
          tap();
          onChange(Math.min(MAX_MULTIPLIER, value + STEP));
        }}
        style={s.stepBtn}
      >
        <Text style={s.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  onChange: (next: DraftItem) => void;
  onRemove: () => void;
}) {
  const k = item.multiplier;
  const conf = confidenceLabel(item.confidence);

  return (
    <View style={s.item}>
      <View style={s.itemHead}>
        <View style={s.itemMain}>
          <Text style={s.itemName}>{item.name}</Text>
          <Text style={s.itemQty}>
            {k !== 1 ? `${k}× ` : ""}
            {item.qty}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Remove ${item.name}`}
          hitSlop={10}
          onPress={() => {
            tap();
            onRemove();
          }}
        >
          <Text style={s.remove}>✕</Text>
        </Pressable>
      </View>
      <Text style={s.itemMacros}>
        {Math.round(item.calories * k)} kcal · P {Math.round(item.protein * k)} · C{" "}
        {Math.round(item.carbs * k)} · F {Math.round(item.fat * k)}
      </Text>
      <View style={s.itemFoot}>
        <View style={s.conf}>
          <View style={[s.dot, { backgroundColor: conf.color }]} />
          <Text style={s.confText}>{conf.label}</Text>
          {item.note ? <Text style={s.confText}> · {item.note}</Text> : null}
        </View>
        <Stepper
          value={k}
          onChange={(multiplier) => onChange({ ...item, multiplier })}
        />
      </View>
    </View>
  );
}

/** "Check before saving": nothing is written until the user confirms. */
export function ReviewSheet({ logger }: { logger: FoodLogger }) {
  const { review, setReview, busy } = logger;
  const items = review?.items ?? [];
  const calories = items.reduce((sum, i) => sum + i.calories * i.multiplier, 0);
  const protein = items.reduce((sum, i) => sum + i.protein * i.multiplier, 0);
  const timeOk = !review?.at || parseClock(review.at) !== null;

  return (
    <Sheet
      visible={review !== null}
      onClose={() => setReview(null)}
      title="Check before saving"
      footer={
        <>
          <Button
            label={`Save ${items.length} ${items.length === 1 ? "item" : "items"}`}
            onPress={() => void logger.confirm()}
            busy={busy}
            disabled={items.length === 0 || !timeOk}
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
      {items.map((item, index) => (
        <ItemRow
          key={`${item.name}-${index}`}
          item={item}
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
      ))}
      <Text style={s.total}>
        {Math.round(calories)} kcal · {Math.round(protein)}g protein
      </Text>
      <Label>Meal</Label>
      <SlotPicker
        value={review?.slot ?? "Snacks"}
        onChange={(slot) => setReview((r) => (r ? { ...r, slot } : r))}
      />
      {review && review.at !== "" ? (
        <View style={s.timeRow}>
          <Field
            label="Eaten at (24h)"
            value={review.at}
            onChangeText={(at) => setReview((r) => (r ? { ...r, at } : r))}
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

/** Add a food by typing its numbers (also where unreadable text lands). */
export function ManualSheet({ logger }: { logger: FoodLogger }) {
  const { manual, setManual, busy } = logger;

  return (
    <Sheet
      visible={manual !== null}
      onClose={() => setManual(null)}
      title="Add manually"
    >
      {manual ? (
        <ManualForm
          key={manual.name}
          initialName={manual.name}
          busy={busy}
          onSave={(item, slot) => void logger.saveManual(item, slot)}
          onCancel={() => setManual(null)}
        />
      ) : null}
    </Sheet>
  );
}

function ManualForm({
  initialName,
  busy,
  onSave,
  onCancel,
}: {
  initialName: string;
  busy: boolean;
  onSave: (item: DraftItem, slot: MealSlot) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [qty, setQty] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [slot, setSlot] = useState<MealSlot>("Snacks");
  const [touched, setTouched] = useState(false);

  const values = [kcal, p, c, f].map(num);
  const invalid = values.some((v) => Number.isNaN(v));
  const protein = values[1] ?? 0;
  const carbs = values[2] ?? 0;
  const fat = values[3] ?? 0;
  const calories = values[0] ?? Math.round(4 * protein + 4 * carbs + 9 * fat);
  const hasNumbers = values.some((v) => v !== null);
  const ok = name.trim().length > 0 && hasNumbers && !invalid;

  return (
    <View>
      <Field label="Food" value={name} onChangeText={setName} placeholder="Paneer bhurji" />
      <Field label="Amount (optional)" value={qty} onChangeText={setQty} placeholder="1 plate" />
      <View style={s.grid}>
        <Field label="Calories" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" placeholder="auto" style={s.half} />
        <Field label="Protein g" value={p} onChangeText={setP} keyboardType="decimal-pad" style={s.half} />
      </View>
      <View style={s.grid}>
        <Field label="Carbs g" value={c} onChangeText={setC} keyboardType="decimal-pad" style={s.half} />
        <Field label="Fat g" value={f} onChangeText={setF} keyboardType="decimal-pad" style={s.half} />
      </View>
      {touched && !ok ? (
        <Text style={s.error}>
          {name.trim() === ""
            ? "Add a name."
            : invalid
              ? "Numbers only, zero or more."
              : "Add at least one number."}
        </Text>
      ) : null}
      <Label>Meal</Label>
      <SlotPicker value={slot} onChange={setSlot} />
      <View style={s.manualButtons}>
        <Button
          label="Save"
          busy={busy}
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
  onSave: (factor: number, slot: MealSlot, at: string) => void;
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
  onSave: (factor: number, slot: MealSlot, at: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [factor, setFactor] = useState(1);
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [at, setAt] = useState(initialAt);
  const timeOk = parseClock(at) !== null;

  return (
    <View>
      <Text style={s.itemName}>{meal.name}</Text>
      <Text style={s.itemQty}>
        {factor !== 1 ? `${factor}× ` : ""}
        {meal.qty ?? "1 serving"}
      </Text>
      <Text style={[s.itemMacros, s.gapBottom]}>
        {Math.round((meal.calories ?? 0) * factor)} kcal · P{" "}
        {Math.round((meal.protein ?? 0) * factor)} · C{" "}
        {Math.round((meal.carbs ?? 0) * factor)} · F{" "}
        {Math.round((meal.fat ?? 0) * factor)}
      </Text>
      <Label>Portion</Label>
      <View style={s.gapBottom}>
        <Stepper value={factor} onChange={setFactor} />
      </View>
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
          onPress={() => onSave(factor, slot, parseClock(at) ?? "")}
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
});
