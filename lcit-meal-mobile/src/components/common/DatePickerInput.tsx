/**
 * Common Component - DatePickerInput
 * Ô nhập ngày tích hợp Modal chọn ngày/khoảng ngày thân thiện
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DatePickerModal } from './DatePickerModal';
import { formatDisplayDate } from '../../utils/formatters';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';

export interface DatePickerInputProps {
  label?: string;
  value?: string; // YYYY-MM-DD
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  onChangeDate: (date: string) => void;
  error?: string;
  disabled?: boolean;
  style?: ViewStyle;
  title?: string;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  placeholder = 'Chọn ngày...',
  minDate,
  maxDate,
  onChangeDate,
  error,
  disabled = false,
  style,
  title,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const displayValue = value ? formatDisplayDate(value) : '';

  return (
    <View style={[styles.container, style]}>
      {Boolean(label) && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={[label || placeholder, displayValue].filter(Boolean).join(', ')}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setModalVisible(true)}
        style={[
          styles.inputBox,
          error ? styles.inputBoxError : null,
          disabled ? styles.inputBoxDisabled : null,
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={value ? colors.primary : colors.textMuted}
          style={styles.icon}
        />

        <Text
          style={[
            styles.inputText,
            !value ? styles.placeholderText : null,
            disabled ? styles.disabledText : null,
          ]}
        >
          {displayValue || placeholder}
        </Text>

        <Ionicons
          name="chevron-down"
          size={16}
          color={colors.textSecondary}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}

      {modalVisible && <DatePickerModal
        visible
        mode="single"
        initialDate={value}
        minDate={minDate}
        maxDate={maxDate}
        title={title || label || 'Chọn ngày'}
        onSelectSingle={(selected) => {
          onChangeDate(selected);
          setModalVisible(false);
        }}
        onClose={() => setModalVisible(false)}
      />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inputBox: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  inputBoxError: {
    borderColor: colors.danger,
  },
  inputBoxDisabled: {
    backgroundColor: colors.backgroundDark,
    opacity: 0.6,
  },
  icon: {
    marginRight: spacing.sm,
  },
  inputText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textMuted,
  },
  disabledText: {
    color: colors.textMuted,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  errorText: {
    fontSize: typography.sizes['2xs'],
    color: colors.danger,
    marginTop: 4,
  },
});
