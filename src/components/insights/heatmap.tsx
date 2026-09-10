import { StyleSheet, Text, View } from "react-native";

import {
  GymColors,
  Spacing,
  Typography,
} from "@/constants/theme";
import type { HeatmapWeek } from "@/types/insights";
import { getTodayKey } from "@/utils/date";

const WEEK_INITIALS = [
  "M",
  "T",
  "W",
  "T",
  "F",
  "S",
  "S",
];

const CELL = 12;
const GAP = 4;
const LABEL_AREA = 16;

const LEVEL_COLORS = [
  GymColors.background.surface,
  "rgba(139, 158, 255, 0.32)",
  "rgba(139, 158, 255, 0.62)",
  GymColors.semantic.accent,
];

function levelOf(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

type HeatmapProps = {
  weeks: HeatmapWeek[];
};

export function Heatmap({ weeks }: HeatmapProps) {
  const today = getTodayKey();

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.gutter}>
          {WEEK_INITIALS.map((initial, index) => (
            <View
              key={`${initial}-${index}`}
              style={styles.gutterCell}
            >
              <Text style={styles.gutterText}>
                {initial}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {weeks.map((week) => (
            <View
              key={week.cells[0].date}
              style={styles.column}
            >
              <View style={styles.labelArea}>
                {week.label ? (
                  <Text style={styles.monthLabel}>
                    {week.label}
                  </Text>
                ) : null}
              </View>

              {week.cells.map((cell) => {
                const isToday =
                  cell.date === today;

                return (
                  <View
                    key={cell.date}
                    style={[
                      styles.cell,
                      {
                        backgroundColor:
                          LEVEL_COLORS[levelOf(cell.count)],
                      },
                      isToday && styles.cellToday,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>

        {LEVEL_COLORS.map((color) => (
          <View
            key={color}
            style={[
              styles.swatch,
              { backgroundColor: color },
            ]}
          />
        ))}

        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  gutter: {
    marginTop: LABEL_AREA,
    marginRight: GAP,
    gap: GAP,
  },

  gutterCell: {
    height: CELL,
    justifyContent: "center",
  },

  gutterText: {
    color: GymColors.text.tertiary,
    fontSize: 10,
  },

  grid: {
    flexDirection: "row",
    gap: GAP,
  },

  column: {
    gap: GAP,
  },

  labelArea: {
    height: LABEL_AREA,
    justifyContent: "flex-end",
  },

  monthLabel: {
    color: GymColors.text.tertiary,
    fontSize: 10,
  },

  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },

  cellToday: {
    borderWidth: 1,
    borderColor: GymColors.text.secondary,
  },

  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: Spacing.three,
  },

  legendText: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});