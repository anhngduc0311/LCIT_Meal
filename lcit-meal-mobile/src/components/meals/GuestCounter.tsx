/**
 * Meal Component - GuestCounter
 * Bộ đếm số lượng khách ăn kèm (0..10)
 * Nút tăng/giảm đạt chuẩn vùng chạm tối thiểu 48px, khóa nút khi chạm biên 0 hoặc 10.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { MAX_GUEST_COUNT, MIN_GUEST_COUNT } from '../../config/constants';

export interface GuestCounterProps {
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  style?: ViewStyle;
  label?: string;
  helperText?: string;
  valueDescription?: string;
}

export const GuestCounter: React.FC<GuestCounterProps> = ({
  value,
  onChange,
  min = MIN_GUEST_COUNT,
  max = MAX_GUEST_COUNT,
  disabled = false,
  style,
  label = 'Số lượng khách ăn kèm',
  helperText = 'Tối đa 10 khách/suất. Khách ăn cùng ngày đã chọn.',
  valueDescription,
}) => {
  const isMin = value <= min;
  const isMax = value >= max;

  const handleDecrement = () => {
    if (!disabled && !isMin) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (!disabled && !isMax) {
      onChange(value + 1);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{value} khách</Text>
          </View>
        </View>
      )}

      <View style={styles.controlsRow}>
        {/* Nút giảm (-) */}
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled || isMin}
          onPress={handleDecrement}
          style={[
            styles.counterButton,
            (disabled || isMin) && styles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Giảm số lượng khách"
        >
          <Ionicons
            name="remove"
            size={22}
            color={disabled || isMin ? colors.textMuted : colors.primary}
          />
        </TouchableOpacity>

        {/* Số hiển thị */}
        <View style={styles.valueDisplay}>
          <Text style={styles.valueText}>{value}</Text>
          <Text style={styles.valueSubtext}>
            {valueDescription ?? (value === 0 ? 'Chỉ mình bạn' : `Bạn + ${value} khách`)}
          </Text>
        </View>

        {/* Nút tăng (+) */}
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={disabled || isMax}
          onPress={handleIncrement}
          style={[
            styles.counterButton,
            (disabled || isMax) && styles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Tăng số lượng khách"
        >
          <Ionicons
            name="add"
            size={22}
            color={disabled || isMax ? colors.textMuted : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {Boolean(helperText) && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  counterButton: {
    width: spacing.minTouchTarget,
    height: spacing.minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: colors.surfaceSubtle,
    opacity: 0.5,
  },
  valueDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  valueText: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  valueSubtext: {
    fontSize: typography.sizes['2xs'],
    color: colors.textSecondary,
    marginTop: 2,
  },
  helperText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
