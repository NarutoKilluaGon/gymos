import { StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GymColors, Radius, Spacing, Typography } from '@/constants/theme';
import { TimingConfig } from '@/utils/motion';

type ProgressBarProps = {
  current: number;
  target: number;
  unit: string;
  compact?: boolean;
  /**
   * Hide the value/status header and render only the track. Used where
   * the parent already presents "current / target" text, so the numbers
   * are not shown twice.
   */
  hideHeader?: boolean;
};

export function ProgressBar({
  current,
  target,
  unit,
  compact = false,
  hideHeader = false,
}: ProgressBarProps) {
  const progress = Math.min(current / target, 1);

  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(
      progress,
      TimingConfig.medium,
    );
  }, [progress, scale]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scale.value }],
  }));

  const status =
    current >= target
      ? 'Completed'
      : current > 0
        ? 'In progress'
        : 'Pending';

  if (compact) {
    return (
      <View style={styles.containerCompact}>
        {!hideHeader && (
          <View style={styles.headerCompact}>
            <Text style={styles.valueCompact}>
              {current.toFixed(current >= 10 ? 0 : 1)} / {target.toFixed(target >= 10 ? 0 : 1)} {unit}
            </Text>

            <Text
              style={[
                styles.statusCompact,
                current >= target && styles.completedCompact,
              ]}>
              {current >= target ? '✓' : ''}
            </Text>
          </View>
        )}

        <View style={styles.trackCompact}>
          <Animated.View
            style={[
              styles.fillCompact,
              fillStyle,
              current >= target && styles.completedFillCompact,
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!hideHeader && (
        <View style={styles.header}>
          <Text style={styles.value}>
            {current.toFixed(1)} / {target.toFixed(1)} {unit}
          </Text>

          <Text
            style={[
              styles.status,
              current >= target && styles.completed,
            ]}>
            {current >= target ? '✓ ' : ''}
            {status}
          </Text>
        </View>
      )}

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            fillStyle,
            current >= target && styles.completedFill,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  value: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
  },

  status: {
    color: GymColors.text.secondary,
    fontSize: Typography.caption,
  },

  completed: {
    color: GymColors.semantic.success,
  },

  track: {
    height: 6,
    borderRadius: Radius.medium,
    backgroundColor: GymColors.background.surface,
    overflow: 'hidden',
  },

  fill: {
    width: '100%',
    height: '100%',
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.medium,
    transformOrigin: 'left',
  },

  completedFill: {
    backgroundColor: GymColors.semantic.success,
  },

  // Compact styles
  containerCompact: {
    gap: Spacing.half,
    width: "48%",
  },

  headerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  valueCompact: {
    color: GymColors.text.primary,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  statusCompact: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  completedCompact: {
    color: GymColors.semantic.success,
  },

  trackCompact: {
    height: 4,
    borderRadius: Radius.small,
    backgroundColor: GymColors.background.surface,
    overflow: 'hidden',
  },

  fillCompact: {
    width: '100%',
    height: '100%',
    backgroundColor: GymColors.semantic.accent,
    borderRadius: Radius.small,
    transformOrigin: 'left',
  },

  completedFillCompact: {
    backgroundColor: GymColors.semantic.success,
  },
});