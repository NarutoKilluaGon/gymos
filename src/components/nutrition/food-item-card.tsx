import { Check, Trash2 } from "lucide-react-native";
import { memo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { N, NRadius } from "@/constants/nourish-theme";
import { Q } from "@/constants/quiet";
import { tap } from "@/components/nutrition/nourish-ui";
import { hapticLight, hapticSuccess } from "@/utils/haptics";
import type { DraftItem } from "@/types/nourish";

export type FoodItemCardStatus = "matched" | "estimated" | "needs-input" | "loading";

export type FoodItemCardProps = {
  item: DraftItem;
  status?: FoodItemCardStatus;
  approved?: boolean;
  onApproveToggle?: (approved: boolean) => void;
  onChange?: (updated: DraftItem) => void;
  onRemove?: () => void;
  /** Whether fields are directly editable inline */
  editable?: boolean;
  showStepper?: boolean;
};

const STEP = 0.25;
const MAX_MULTIPLIER = 20;

export const FoodItemCard = memo(function FoodItemCard({
  item,
  status: statusProp,
  approved = true,
  onApproveToggle,
  onChange,
  onRemove,
  editable = true,
  showStepper = true,
}: FoodItemCardProps) {
  // Infer status if not explicitly given
  const status: FoodItemCardStatus =
    statusProp ??
    (item.calories === 0 && item.protein === 0 && item.carbs === 0 && item.fat === 0
      ? "needs-input"
      : item.source === "saved" || item.source === "catalog"
        ? "matched"
        : "estimated");

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(item.name);
  const [draftQty, setDraftQty] = useState(item.qty);
  const [draftKcal, setDraftKcal] = useState(String(Math.round(item.calories)));
  const [draftP, setDraftP] = useState(String(Math.round(item.protein)));
  const [draftC, setDraftC] = useState(String(Math.round(item.carbs)));
  const [draftF, setDraftF] = useState(String(Math.round(item.fat)));

  function commitEdit() {
    setIsEditing(false);
    if (!onChange) return;

    const p = Math.max(0, Number(draftP) || 0);
    const c = Math.max(0, Number(draftC) || 0);
    const f = Math.max(0, Number(draftF) || 0);
    const autoKcal = Math.round(4 * p + 4 * c + 9 * f);
    const cal = draftKcal.trim() !== "" ? Math.max(0, Number(draftKcal) || 0) : autoKcal;

    onChange({
      ...item,
      name: draftName.trim() || item.name,
      qty: draftQty.trim() || item.qty,
      calories: cal,
      protein: p,
      carbs: c,
      fat: f,
    });
  }

  function handleCheckPress() {
    if (onApproveToggle) {
      if (!approved) void hapticSuccess();
      else void hapticLight();
      onApproveToggle(!approved);
    }
  }

  const k = item.multiplier ?? 1;
  const isNeedsInput = status === "needs-input";
  const isMatched = status === "matched";
  const isEstimated = status === "estimated";
  const isLoading = status === "loading";
  const isLowConfidence = isEstimated && item.confidence > 0 && item.confidence < 0.6;

  return (
    <View style={[styles.card, !approved && styles.cardUnapproved]}>
      {/* Header: Name, Qty, Status Chip, Delete */}
      <View style={styles.headerRow}>
        <View style={styles.titleArea}>
          {isEditing ? (
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Food name"
              placeholderTextColor={N.dim}
              returnKeyType="next"
            />
          ) : (
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
          )}

          {isEditing ? (
            <TextInput
              style={styles.qtyInput}
              value={draftQty}
              onChangeText={setDraftQty}
              placeholder="e.g. 1 bowl"
              placeholderTextColor={N.dim}
              returnKeyType="next"
            />
          ) : (
            <Text style={styles.qty}>
              {k !== 1 ? `${k}× ` : ""}
              {item.qty}
            </Text>
          )}
        </View>

        <View style={styles.actionsGroup}>
          <View
            style={[
              styles.chip,
              isMatched && styles.chipMatched,
              isEstimated && (isLowConfidence ? styles.chipCheckThis : styles.chipEstimated),
              isNeedsInput && styles.chipNeedsInput,
              isLoading && styles.chipLoading,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                isMatched && styles.chipTextMatched,
                isEstimated && (isLowConfidence ? styles.chipTextCheckThis : styles.chipTextEstimated),
                isNeedsInput && styles.chipTextNeedsInput,
                isLoading && styles.chipTextLoading,
              ]}
            >
              {isLoading
                ? "Estimating…"
                : isMatched
                  ? "Matched"
                  : isEstimated
                    ? (isLowConfidence ? "Check this" : "Estimated")
                    : "Needs numbers"}
            </Text>
          </View>

          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
              hitSlop={8}
              onPress={() => {
                tap();
                onRemove();
              }}
              style={styles.iconBtn}
            >
              <Trash2 size={16} color={N.mute} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {item.assumption ? (
        <View style={styles.assumptionRow}>
          <Text style={styles.assumptionText} numberOfLines={2}>
            {item.assumption}
          </Text>
        </View>
      ) : null}

      {/* Macros Section or Edit Inputs */}
      {isEditing ? (
        <View style={styles.editGrid}>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Calories</Text>
            <TextInput
              style={styles.fieldInput}
              value={draftKcal}
              onChangeText={setDraftKcal}
              keyboardType="numeric"
              placeholder="kcal"
              placeholderTextColor={N.dim}
            />
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Protein</Text>
            <TextInput
              style={styles.fieldInput}
              value={draftP}
              onChangeText={setDraftP}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor={N.dim}
            />
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Carbs</Text>
            <TextInput
              style={styles.fieldInput}
              value={draftC}
              onChangeText={setDraftC}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor={N.dim}
            />
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Fat</Text>
            <TextInput
              style={styles.fieldInput}
              value={draftF}
              onChangeText={setDraftF}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor={N.dim}
            />
          </View>
        </View>
      ) : (
        <Pressable
          disabled={!editable}
          onPress={() => {
            if (editable) {
              setDraftName(item.name);
              setDraftQty(item.qty);
              setDraftKcal(String(Math.round(item.calories)));
              setDraftP(String(Math.round(item.protein)));
              setDraftC(String(Math.round(item.carbs)));
              setDraftF(String(Math.round(item.fat)));
              setIsEditing(true);
            }
          }}
          style={styles.macrosRow}
        >
          <Text style={styles.caloriesText}>
            {Math.round(item.calories * k)}{" "}
            <Text style={styles.caloriesUnit}>kcal</Text>
          </Text>
          <Text style={styles.macroPill}>
            P <Text style={styles.macroVal}>{Math.round(item.protein * k)}g</Text>
          </Text>
          <Text style={styles.macroPill}>
            C <Text style={styles.macroVal}>{Math.round(item.carbs * k)}g</Text>
          </Text>
          <Text style={styles.macroPill}>
            F <Text style={styles.macroVal}>{Math.round(item.fat * k)}g</Text>
          </Text>

          {editable ? <Text style={styles.editHint}>Edit</Text> : null}
        </Pressable>
      )}

      {/* Done button when editing */}
      {isEditing ? (
        <View style={styles.commitRow}>
          <Pressable
            accessibilityRole="button"
            onPress={commitEdit}
            style={styles.doneBtn}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Footer: Multiplier Stepper + Approval Checkbox */}
      <View style={styles.footerRow}>
        {showStepper && onChange ? (
          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel="Smaller portion"
              hitSlop={8}
              onPress={() => {
                tap();
                onChange({ ...item, multiplier: Math.max(STEP, k - STEP) });
              }}
              style={styles.stepBtn}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>×{k}</Text>
            <Pressable
              accessibilityLabel="Bigger portion"
              hitSlop={8}
              onPress={() => {
                tap();
                onChange({
                  ...item,
                  multiplier: Math.min(MAX_MULTIPLIER, k + STEP),
                });
              }}
              style={styles.stepBtn}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        ) : <View />}

        {onApproveToggle ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: approved }}
            accessibilityLabel={`Approve ${item.name}`}
            onPress={handleCheckPress}
            style={[styles.checkBtn, approved && styles.checkBtnActive]}
          >
            <Check size={14} color={approved ? N.accInk : N.mute} />
            <Text style={[styles.checkText, approved && styles.checkTextActive]}>
              {approved ? "Approved" : "Tap to approve"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: N.card,
    borderRadius: NRadius.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: N.line,
    padding: 14,
    marginBottom: 10,
  },
  cardUnapproved: {
    opacity: 0.7,
    borderColor: Q.color.line,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  titleArea: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: N.ink,
    lineHeight: 22,
  },
  nameInput: {
    fontSize: 15,
    fontWeight: "600",
    color: N.ink,
    backgroundColor: N.card2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  qty: {
    fontSize: 13,
    color: N.mute,
    marginTop: 2,
  },
  qtyInput: {
    fontSize: 13,
    color: N.ink,
    backgroundColor: N.card2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: NRadius.pill,
    backgroundColor: N.card2,
  },
  chipMatched: {
    backgroundColor: Q.color.surface2,
  },
  chipEstimated: {
    backgroundColor: Q.color.surface2,
  },
  chipCheckThis: {
    backgroundColor: Q.color.surface2,
  },
  chipNeedsInput: {
    backgroundColor: Q.color.surface2,
  },
  chipLoading: {
    backgroundColor: Q.color.surface2,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: N.dim,
  },
  chipTextMatched: {
    color: N.ok,
  },
  chipTextEstimated: {
    color: N.warn,
  },
  chipTextCheckThis: {
    color: N.warn,
  },
  chipTextNeedsInput: {
    color: N.bad,
  },
  chipTextLoading: {
    color: N.acc,
  },
  assumptionRow: {
    marginTop: 4,
  },
  assumptionText: {
    fontSize: 12,
    color: N.mute,
    fontStyle: "italic",
    lineHeight: 16,
  },
  iconBtn: {
    padding: 4,
  },
  macrosRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: N.line,
  },
  caloriesText: {
    fontSize: 15,
    fontWeight: "700",
    color: N.ink,
  },
  caloriesUnit: {
    fontSize: 12,
    fontWeight: "400",
    color: N.mute,
  },
  macroPill: {
    fontSize: 12,
    color: N.mute,
  },
  macroVal: {
    color: N.ink,
    fontWeight: "500",
  },
  editHint: {
    fontSize: 12,
    color: N.acc,
    marginLeft: "auto",
    fontWeight: "500",
  },
  editGrid: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: N.line,
  },
  fieldCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    color: N.dim,
    marginBottom: 2,
  },
  fieldInput: {
    backgroundColor: N.card2,
    borderRadius: 8,
    color: N.ink,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  commitRow: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  doneBtn: {
    backgroundColor: N.acc,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  doneBtnText: {
    color: N.accInk,
    fontSize: 12,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Q.color.line,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: N.card2,
    borderRadius: NRadius.pill,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    fontSize: 14,
    color: N.ink,
    fontWeight: "700",
    lineHeight: 16,
  },
  stepValue: {
    fontSize: 12,
    fontWeight: "600",
    color: N.ink,
    paddingHorizontal: 6,
  },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: NRadius.pill,
    backgroundColor: N.card2,
  },
  checkBtnActive: {
    backgroundColor: N.acc,
  },
  checkText: {
    fontSize: 12,
    fontWeight: "500",
    color: N.mute,
  },
  checkTextActive: {
    color: N.accInk,
    fontWeight: "600",
  },
});
