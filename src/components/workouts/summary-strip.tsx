import * as Haptics from "expo-haptics";
import { Clock } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Font } from "@/constants/design";
import { F } from "@/constants/forge-theme";

type SummaryStripProps = {
  clock: string;
  paused: boolean;
  backdated?: boolean;
  disabled?: boolean;
  isIdle?: boolean;
  idleDuration?: string;
  setsDone: number;
  setsTotal: number;
  volumeLabel: string;
  onToggleClock: () => void;
  onResumeIdle?: () => void;
  onFinishIdle?: () => void;
};

export function SummaryStrip({
  clock,
  paused,
  backdated = false,
  disabled = false,
  isIdle = false,
  idleDuration,
  setsDone,
  setsTotal,
  volumeLabel,
  onToggleClock,
  onResumeIdle,
  onFinishIdle,
}: SummaryStripProps) {
  const clockText = backdated
    ? "Logged"
    : isIdle && idleDuration
      ? `Idle · ${idleDuration}`
      : paused
        ? `${clock} · paused`
        : clock;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Clock item */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? "Resume clock" : "Pause clock"}
          disabled={disabled || backdated}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggleClock();
          }}
          style={styles.item}
        >
          <Clock size={15} color={paused ? F.warm : F.mute} />
          <Text
            style={[
              styles.clockText,
              paused && { color: F.warm },
              isIdle && { color: F.dim },
            ]}
          >
            {clockText}
          </Text>
        </Pressable>

        {/* Sets item */}
        <View style={styles.item}>
          <Text style={styles.label}>Sets</Text>
          <Text style={styles.value}>
            {setsDone}/{setsTotal}
          </Text>
        </View>

        {/* Volume item */}
        <View style={styles.item}>
          <Text style={styles.label}>Vol</Text>
          <Text style={styles.value}>{volumeLabel}</Text>
        </View>
      </View>

      {/* Gentle idle warning prompt if stale */}
      {isIdle && onResumeIdle && onFinishIdle ? (
        <View style={styles.idlePrompt}>
          <Text style={styles.idlePromptText}>
            Still training? Resume or finish session.
          </Text>
          <View style={styles.idleActions}>
            <Pressable
              style={styles.idleBtn}
              onPress={onResumeIdle}
              accessibilityRole="button"
              accessibilityLabel="Resume training"
            >
              <Text style={styles.idleBtnText}>Resume</Text>
            </Pressable>
            <Pressable
              style={[styles.idleBtn, styles.idleBtnFinish]}
              onPress={onFinishIdle}
              accessibilityRole="button"
              accessibilityLabel="Finish now"
            >
              <Text style={styles.idleBtnFinishText}>Finish</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: F.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: F.line,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clockText: {
    fontFamily: Font.sans,
    fontSize: 15,
    fontWeight: "500",
    color: F.ink,
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontFamily: Font.sans,
    fontSize: 12,
    color: F.mute,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  value: {
    fontFamily: Font.sans,
    fontSize: 15,
    fontWeight: "600",
    color: F.ink,
    fontVariant: ["tabular-nums"],
  },
  idlePrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: F.line,
  },
  idlePromptText: {
    fontFamily: Font.sans,
    fontSize: 12,
    color: F.dim,
    flex: 1,
  },
  idleActions: {
    flexDirection: "row",
    gap: 8,
  },
  idleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: F.card2,
  },
  idleBtnText: {
    fontSize: 12,
    color: F.ink,
    fontWeight: "500",
  },
  idleBtnFinish: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
  },
  idleBtnFinishText: {
    fontSize: 12,
    color: F.acc,
    fontWeight: "600",
  },
});
