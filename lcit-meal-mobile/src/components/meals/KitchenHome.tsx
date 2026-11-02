import React, { useState } from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../common/ScreenContainer';
import { Header } from '../common/Header';
import { Card } from '../common/Card';
import { DatePickerModal } from '../common/DatePickerModal';
import { Button } from '../common/Button';
import { ErrorState, LoadingState } from '../states';
import { useDashboardHome } from '../../hooks/useDashboardData';
import { useAuth } from '../../providers/AuthProvider';
import { formatDisplayDate, formatBusinessDate, getFullDayOfWeek } from '../../utils/formatters';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

export function KitchenHome() {
  const { user } = useAuth();
  const today = formatBusinessDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { data, isLoading, isRefetching, error, refetch } = useDashboardHome(selectedDate);
  const changeDate = (offset: number) => {
    setSelectedDate((date) => {
      const [year, month, day] = date.split('-').map(Number);
      return formatBusinessDate(new Date(year, month - 1, day + offset));
    });
  };
  const meal = data?.todayMeal;
  const staff = data?.todayStaff;
  const cancelled = Boolean(meal?.isCancelled ?? meal?.is_cancelled);
  const total = cancelled ? 0 : Number(staff?.totalMealSlots ?? staff?.total_meal_slots ?? 0);

  return (
    <ScreenContainer scrollable refreshing={isRefetching} onRefresh={() => { void refetch(); }}>
      <Header title="Lịch bếp ăn" subtitle={user?.fullName} userRole="kitchen" />
      <View style={styles.dateNavigation}>
        <TouchableOpacity style={styles.dateArrow} accessibilityRole="button" accessibilityLabel="Xem ngày trước" onPress={() => changeDate(-1)}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateSelect} accessibilityRole="button" accessibilityLabel={`Chọn ngày xem bếp ăn, ${formatDisplayDate(selectedDate)}`} onPress={() => setDatePickerOpen(true)}>
          <Text style={styles.dateHint}>{selectedDate === today ? 'Hôm nay' : getFullDayOfWeek(selectedDate)}</Text>
          <View style={styles.dateLabel}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.dateNavTitle}>{formatDisplayDate(selectedDate)}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateArrow} accessibilityRole="button" accessibilityLabel="Xem ngày tiếp theo" onPress={() => changeDate(1)}>
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {selectedDate !== today && <Button title="Về hôm nay" variant="ghost" onPress={() => setSelectedDate(today)} style={styles.todayButton} />}
      {isLoading ? <LoadingState message="Đang tải số suất cần nấu..." /> : error ? (
        <ErrorState message={error.message} onRetry={() => { void refetch(); }} />
      ) : (
        <Card padding="2xl" style={styles.kpiCard}>
          <Text style={styles.kpiDate}>{formatDisplayDate(selectedDate)}</Text>
          <Text style={styles.total}>{total}</Text>
          <Text style={styles.kpiTitle}>Tổng suất cần chuẩn bị</Text>
          
          <View style={styles.kpiBreakdownRow}>
            <View style={styles.breakdownBox}>
              <Text style={styles.breakdownNum}>{cancelled ? 0 : Number(staff?.registeredStaffCount ?? staff?.registered_staff_count ?? 0)}</Text>
              <Text style={styles.breakdownLabel}>Cán bộ</Text>
            </View>
            <View style={[styles.breakdownBox, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
              <Text style={[styles.breakdownNum, { color: '#B45309' }]}>{cancelled ? 0 : Number(staff?.totalGuestCount ?? staff?.total_guest_count ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: '#92400E' }]}>Khách mời</Text>
            </View>
          </View>

          {(!meal || cancelled) && (
            <Text style={styles.alertDetail}>
              {cancelled ? 'Bếp nghỉ phục vụ ngày này.' : 'Ngày này chưa có lịch nấu ăn.'}
            </Text>
          )}
        </Card>
      )}
      {datePickerOpen && <DatePickerModal visible mode="single" initialDate={selectedDate}
        title="Chọn ngày xem bếp ăn" onSelectSingle={setSelectedDate} onClose={() => setDatePickerOpen(false)} />}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
  },
  dateArrow: { width: 48, minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  dateSelect: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  dateHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 2, fontWeight: '500' },
  dateLabel: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  dateNavTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  todayButton: { alignSelf: 'center', marginBottom: spacing.sm },
  kpiCard: {
    alignItems: 'center',
    borderRadius: radius['2xl'],
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  kpiDate: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 },
  kpiTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  total: { fontSize: 52, fontWeight: '800', color: colors.primaryDark, marginVertical: spacing.xs, letterSpacing: -1 },
  kpiBreakdownRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: spacing.xs },
  breakdownBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: colors.primary100,
    alignItems: 'center',
  },
  breakdownNum: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
  breakdownLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  alertDetail: { fontSize: 13, color: colors.danger, marginTop: spacing.md, fontWeight: '500' },
});
