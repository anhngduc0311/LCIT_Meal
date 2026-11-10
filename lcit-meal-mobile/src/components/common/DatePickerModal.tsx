import { ModalBackdrop } from './ModalBackdrop';
/**
 * Common Component - DatePickerModal
 * Modal chọn ngày / khoảng ngày dạng Lịch tháng tương tác hoàn chỉnh (Interactive Calendar)
 * Hỗ trợ chuyển tháng, năm, chọn ngày đơn hoặc khoảng ngày (Từ ngày - Đến ngày)
 */

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { ModalCard } from './ModalCard';
import {
  formatBusinessDate,
  formatDisplayDate,
  parseDateParts,
} from '../../utils/formatters';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';

export interface DatePickerModalProps {
  visible: boolean;
  mode?: 'single' | 'range';
  initialDate?: string; // YYYY-MM-DD
  initialFromDate?: string;
  initialToDate?: string;
  minDate?: string;
  maxDate?: string;
  title?: string;
  onSelectSingle?: (date: string) => void;
  onSelectRange?: (fromDate: string, toDate: string) => void;
  onClose: () => void;
}

const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  mode = 'single',
  initialDate,
  initialFromDate,
  initialToDate,
  minDate,
  maxDate,
  title,
  onSelectSingle,
  onSelectRange,
  onClose,
}) => {
  const todayStr = formatBusinessDate(new Date());

  // Date selections
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || todayStr
  );
  const [fromDate, setFromDate] = useState<string>(
    initialFromDate || todayStr
  );
  const [toDate, setToDate] = useState<string>(
    initialToDate || todayStr
  );

  // Current view month & year
  const initialBaseDate = initialDate || initialFromDate || todayStr;
  const parsedBase = parseDateParts(initialBaseDate);
  const [viewYear, setViewYear] = useState<number>(
    parsedBase?.year ?? new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    parsedBase ? parsedBase.month - 1 : new Date().getMonth()
  ); // 0-indexed (0 = Jan)

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isDisabled: boolean;
    }[] = [];

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

    // Monday as 0, Sunday as 6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    // Previous month padding days
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const d = new Date(viewYear, viewMonth - 1, pDay);
      const str = formatBusinessDate(d);
      days.push({
        dateStr: str,
        dayNumber: pDay,
        isCurrentMonth: false,
        isDisabled: true,
      });
    }

    // Current month days
    const totalDays = lastDayOfMonth.getDate();
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const str = formatBusinessDate(d);

      let isDisabled = false;
      if (minDate && str < minDate) isDisabled = true;
      if (maxDate && str > maxDate) isDisabled = true;

      days.push({
        dateStr: str,
        dayNumber: day,
        isCurrentMonth: true,
        isDisabled,
      });
    }

    // Next month padding days to complete 6 weeks grid if needed
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      const str = formatBusinessDate(d);
      days.push({
        dateStr: str,
        dayNumber: i,
        isCurrentMonth: false,
        isDisabled: true,
      });
    }

    return days;
  }, [viewYear, viewMonth, minDate, maxDate]);

  const handleDayPress = (dateStr: string, isDisabled: boolean) => {
    if (isDisabled) return;

    if (mode === 'single') {
      setSelectedDate(dateStr);
    } else {
      if (!fromDate || (fromDate && toDate)) {
        setFromDate(dateStr);
        setToDate('');
      } else if (fromDate && !toDate) {
        if (dateStr < fromDate) {
          setFromDate(dateStr);
          setToDate(fromDate);
        } else {
          setToDate(dateStr);
        }
      }
    }
  };

  // Quick shortcuts
  const handleQuickShortcut = (type: 'today' | 'tomorrow' | 'next7days' | 'thisMonth') => {
    const now = new Date();
    const today = formatBusinessDate(now);

    if (type === 'today') {
      if (mode === 'single') {
        setSelectedDate(today);
      } else {
        setFromDate(today);
        setToDate(today);
      }
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (type === 'tomorrow') {
      const tm = new Date();
      tm.setDate(now.getDate() + 1);
      const tmStr = formatBusinessDate(tm);
      if (mode === 'single') {
        setSelectedDate(tmStr);
      } else {
        setFromDate(tmStr);
        setToDate(tmStr);
      }
      setViewYear(tm.getFullYear());
      setViewMonth(tm.getMonth());
    } else if (type === 'next7days') {
      const end = new Date();
      end.setDate(now.getDate() + 6);
      const endStr = formatBusinessDate(end);
      if (mode === 'single') {
        setSelectedDate(today);
      } else {
        setFromDate(today);
        setToDate(endStr);
      }
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (type === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startStr = formatBusinessDate(start);
      const endStr = formatBusinessDate(end);
      if (mode === 'single') {
        setSelectedDate(today);
      } else {
        setFromDate(startStr);
        setToDate(endStr);
      }
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
  };

  const handleConfirm = () => {
    if (mode === 'single') {
      onSelectSingle?.(selectedDate);
    } else {
      const finalToDate = toDate || fromDate;
      onSelectRange?.(fromDate, finalToDate);
    }
    onClose();
  };

  const isDaySelected = (dateStr: string) => {
    if (mode === 'single') {
      return selectedDate === dateStr;
    }
    if (fromDate === dateStr || toDate === dateStr) return true;
    if (fromDate && toDate) {
      return dateStr > fromDate && dateStr < toDate;
    }
    return false;
  };

  const isBoundary = (dateStr: string) => {
    if (mode === 'single') return selectedDate === dateStr;
    return dateStr === fromDate || dateStr === toDate;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <ModalBackdrop style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <ModalCard style={[styles.modalCard, shadows.xl]}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>
                  {title || (mode === 'single' ? 'Chọn ngày' : 'Chọn khoảng ngày')}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={onClose}
                  style={styles.closeBtn}
                  accessibilityLabel="Đóng"
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Tóm tắt lựa chọn */}
              <View style={styles.summaryBox}>
                {mode === 'single' ? (
                  <Text style={styles.summaryText}>
                    Ngày đã chọn:{' '}
                    <Text style={styles.summaryHighlight}>
                      {formatDisplayDate(selectedDate)}
                    </Text>
                  </Text>
                ) : (
                  <Text style={styles.summaryText}>
                    Từ{' '}
                    <Text style={styles.summaryHighlight}>
                      {formatDisplayDate(fromDate)}
                    </Text>{' '}
                    đến{' '}
                    <Text style={styles.summaryHighlight}>
                      {formatDisplayDate(toDate || fromDate)}
                    </Text>
                  </Text>
                )}
              </View>

              {/* Quick Shortcuts */}
              <View style={styles.shortcutsRow}>
                <TouchableOpacity
                  style={styles.shortcutChip}
                  onPress={() => handleQuickShortcut('today')}
                >
                  <Text style={styles.shortcutText}>Hôm nay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shortcutChip}
                  onPress={() => handleQuickShortcut('tomorrow')}
                >
                  <Text style={styles.shortcutText}>Ngày mai</Text>
                </TouchableOpacity>
                {mode === 'range' && (
                  <>
                    <TouchableOpacity
                      style={styles.shortcutChip}
                      onPress={() => handleQuickShortcut('next7days')}
                    >
                      <Text style={styles.shortcutText}>7 ngày tới</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.shortcutChip}
                      onPress={() => handleQuickShortcut('thisMonth')}
                    >
                      <Text style={styles.shortcutText}>Tháng này</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Month Navigation */}
              <View style={styles.monthNav}>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={handlePrevMonth}
                  accessibilityLabel="Tháng trước"
                >
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.monthYearTitle}>
                  Tháng {viewMonth + 1}, {viewYear}
                </Text>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={handleNextMonth}
                  accessibilityLabel="Tháng sau"
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Weekday Headers */}
              <View style={styles.weekDaysRow}>
                {WEEK_DAYS.map((w, idx) => (
                  <View key={w} style={styles.weekDayCell}>
                    <Text
                      style={[
                        styles.weekDayText,
                        idx === 6 && { color: colors.danger },
                      ]}
                    >
                      {w}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calendar Days Grid */}
              <View style={styles.calendarGrid}>
                {calendarDays.map((item, idx) => {
                  const isSelected = isDaySelected(item.dateStr);
                  const isBound = isBoundary(item.dateStr);
                  const isToday = item.dateStr === todayStr;

                  return (
                    <TouchableOpacity
                      key={`${item.dateStr}_${idx}`}
                      disabled={item.isDisabled}
                      onPress={() => handleDayPress(item.dateStr, item.isDisabled)}
                      style={[
                        styles.dayCell,
                        !item.isCurrentMonth && styles.dayCellOutOfMonth,
                        isSelected && !isBound && styles.dayCellRange,
                        isBound && styles.dayCellBoundary,
                        isToday && !isBound && styles.dayCellToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          !item.isCurrentMonth && styles.dayTextMuted,
                          item.isDisabled && styles.dayTextDisabled,
                          isSelected && !isBound && styles.dayTextRange,
                          isBound && styles.dayTextBoundary,
                          isToday && !isBound && styles.dayTextToday,
                        ]}
                      >
                        {item.dayNumber}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action buttons */}
              <View style={styles.buttonRow}>
                <Button
                  title="Hủy"
                  variant="secondary"
                  size="md"
                  onPress={onClose}
                  style={styles.btn}
                />
                <Button
                  title="Áp dụng"
                  variant="primary"
                  size="md"
                  onPress={handleConfirm}
                  style={styles.btn}
                />
              </View>
            </ModalCard>
          </TouchableWithoutFeedback>
        </ModalBackdrop>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  summaryBox: {
    backgroundColor: colors.primary50,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  summaryText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  summaryHighlight: {
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  shortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  shortcutChip: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutText: {
    fontSize: typography.sizes['2xs'],
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  navBtn: {
    padding: spacing.xs,
    borderRadius: radius.full,
  },
  monthYearTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  weekDayText: {
    fontSize: typography.sizes['2xs'],
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: radius.md,
  },
  dayCellOutOfMonth: {
    opacity: 0.25,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayCellRange: {
    backgroundColor: colors.primaryLight,
    borderRadius: 0,
  },
  dayCellBoundary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  dayText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  dayTextMuted: {
    color: colors.textMuted,
  },
  dayTextDisabled: {
    color: colors.borderDark,
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  dayTextRange: {
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
  },
  dayTextBoundary: {
    color: colors.textInverse,
    fontWeight: typography.weights.bold,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
  },
});
