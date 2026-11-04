/**
 * Tab Screen - Lịch ăn (Meal Schedule)
 * Xem lịch ăn các ngày trong tháng, trạng thái suất ăn cá nhân,
 * đăng ký ăn, cắt suất hoặc cắt theo khoảng ngày.
 * Kết nối thực tế TanStack React Query (T22, T25)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { MealCard } from '../../src/components/meals/MealCard';
import { DatePickerModal } from '../../src/components/meals/DatePickerModal';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { ResultBanner } from '../../src/components/common/ResultBanner';
import { EmptyState } from '../../src/components/states/EmptyState';
import { LoadingState } from '../../src/components/states/LoadingState';
import {
  useMeals,
  useMyRegistrations,
  useRegisterMealMutation,
  useCancelRegistrationMutation,
  useCreateMealOptionMutation,
  useMyMealOptions,
} from '../../src/hooks/useMealsData';
import {
  formatDisplayDate,
  formatBusinessDate,
} from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { useCancellationDeadline } from '../../src/hooks/useCancellationDeadline';
import { isCancellationClosed } from '../../src/utils/cancellationDeadline';
import { useAuth } from '../../src/providers/AuthProvider';
import ManagementMealsScreen from '../management/meals';

export default function ScheduleScreen() {
  const { role } = useAuth();
  return role === 'manager' ? <ManagementMealsScreen /> : <PersonalScheduleScreen />;
}

function PersonalScheduleScreen() {
  const router = useRouter();
  const { today, now } = useCancellationDeadline();
  const [selectedDate, setSelectedDate] = useState(today);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const previousToday = useRef(today);
  useEffect(() => {
    const oldToday = previousToday.current;
    setSelectedDate(date => date === oldToday ? today : date);
    previousToday.current = today;
  }, [today]);
  const [filterMode, setFilterMode] = useState<'all' | 'registered' | 'cancelled'>('all');
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerVariant, setBannerVariant] = useState<'success' | 'error'>('success');

  // Dialogs
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedRegId, setSelectedRegId] = useState<number | null>(null);
  const [rangePickerVisible, setRangePickerVisible] = useState(false);

  // Queries
  const { data: meals = [], isLoading: loadingMeals, isRefetching: refreshingMeals, isError: mealsError, refetch: refetchMeals } = useMeals();
  const { data: registrations = [], isLoading: loadingRegs, isRefetching: refreshingRegs, isError: regsError, refetch: refetchRegs } = useMyRegistrations();

  // Mutations
  const registerMutation = useRegisterMealMutation();
  const cancelMutation = useCancelRegistrationMutation();
  const createMealOptionMutation = useCreateMealOptionMutation();
  const mealOptions = useMyMealOptions();
  const hasPendingRequest = mealOptions.data?.some(option => option.status === 'pending') || false;

  const isLoading = loadingMeals || loadingRegs;
  const isRefreshing = refreshingMeals || refreshingRegs;

  const handleRefresh = async () => {
    await Promise.all([refetchMeals(), refetchRegs(), mealOptions.refetch()]);
  };

  const selectDate = (date: string) => { setSelectedDate(date); setFilterMode('all'); };
  const changeDay = (offset: number) => selectDate(new Date(Date.parse(`${selectedDate}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10));

  const handleRegister = async (mealId: number) => {
    try {
      await registerMutation.mutateAsync({ mealId, guestCount: 0 });
      setBannerVariant('success');
      setBannerMessage('Đăng ký suất ăn thành công!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng ký suất ăn thất bại.';
      setBannerVariant('error');
      setBannerMessage(msg);
      Alert.alert('Thông báo', msg);
    }
  };

  const handleOpenCancel = (regId: number) => {
    setSelectedRegId(regId);
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedRegId) return;
    try {
      const res = await cancelMutation.mutateAsync({ registrationId: selectedRegId });
      setCancelModalVisible(false);
      setSelectedRegId(null);
      setBannerVariant('success');

      if (res && res.status === 'pending') {
        setBannerMessage('Yêu cầu cắt suất của bạn đã được gửi cho Quản lý xét duyệt.');
      } else {
        setBannerMessage('Đã cắt suất ăn thành công.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cắt suất ăn thất bại.';
      setBannerVariant('error');
      setBannerMessage(msg);
      Alert.alert('Lỗi thao tác', msg);
    }
  };

  const handleSelectDateRange = async (fromDate: string, toDate: string) => {
    if (createMealOptionMutation.isPending || mealOptions.isLoading || mealOptions.isError || hasPendingRequest) return;
    try {
      await createMealOptionMutation.mutateAsync({
        type: 'cancel_schedule',
        fromDate,
        toDate,
        note: 'Cắt suất theo khoảng ngày',
      });
      setBannerVariant('success');
      setBannerMessage(`Đã tạo yêu cầu cắt suất từ ${formatDisplayDate(fromDate)} đến ${formatDisplayDate(toDate)} (Đang chờ Quản lý duyệt).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tạo yêu cầu cắt suất thất bại.';
      setBannerVariant('error');
      setBannerMessage(msg);
      Alert.alert('Lỗi thao tác', msg);
    }
  };

  const dayMeals = meals.filter(meal => formatBusinessDate(meal.mealDate) === selectedDate);
  const matchesFilter = (meal: typeof meals[number], mode: typeof filterMode) => {
    const reg = registrations.find((r) => r.mealId === meal.id || r.mealDate === meal.mealDate);
    if (mode === 'registered') {
      return reg && (reg.status === 'confirmed' || reg.status === 'completed' || reg.status === 'pending');
    }
    if (mode === 'cancelled') {
      return reg && reg.status === 'cancelled';
    }
    return true;
  };
  const filters = [
    { key: 'all', label: 'Tất cả' },
    { key: 'registered', label: 'Đã đăng ký' },
    { key: 'cancelled', label: 'Đã cắt suất' },
  ] as const;
  const filteredMeals = dayMeals.filter(meal => matchesFilter(meal, filterMode));
  const selectedCancelReg = registrations.find((reg) => reg.id === selectedRegId);
  const cancelDate = meals.find((meal) => meal.id === selectedCancelReg?.mealId)?.mealDate
    || selectedCancelReg?.mealDate;

  return (
    <ScreenContainer
      scrollable
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      backgroundColor={colors.background}
    >
      <Header
        title="Lịch ăn cơ quan"
        subtitle="Xem thực đơn và quản lý suất ăn của bạn"
      />
      <View style={styles.toolsRow}>
        <View style={styles.dateControl}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Xem ngày ăn trước" onPress={() => changeDay(-1)} style={styles.dateArrow}>
            <Ionicons name="chevron-back" size={21} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Chọn ngày xem lịch ăn" onPress={() => setDatePickerVisible(true)} style={styles.dateSelection}>
            <Text style={styles.listHint}>{selectedDate === today ? 'Hôm nay' : 'Ngày đang xem'}</Text>
            <View style={styles.dateLabel}><Ionicons name="calendar-outline" size={17} color={colors.primary} /><Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text></View>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Xem ngày ăn tiếp theo" onPress={() => changeDay(1)} style={styles.dateArrow}>
            <Ionicons name="chevron-forward" size={21} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {selectedDate !== today && <TouchableOpacity accessibilityRole="button" onPress={() => selectDate(today)} style={styles.todayButton}><Text style={styles.rangeBtnText}>Về hôm nay</Text></TouchableOpacity>}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setRangePickerVisible(true)}
            style={styles.rangeBtn}
            accessibilityRole="button"
            accessibilityLabel="Cắt suất nhiều ngày"
            disabled={createMealOptionMutation.isPending || mealOptions.isLoading || mealOptions.isError || hasPendingRequest}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.rangeBtnText}>{createMealOptionMutation.isPending ? 'Đang gửi…' : 'Cắt suất nhiều ngày'}</Text>
          </TouchableOpacity>
      </View>

      {hasPendingRequest && <ResultBanner variant="error"
        message="Bạn đang có yêu cầu cắt suất chờ duyệt. Vui lòng chờ quản lý xử lý trước khi gửi yêu cầu tiếp." />}

      {bannerMessage && (
        <ResultBanner
          variant={bannerVariant}
          message={bannerMessage}
          onDismiss={() => setBannerMessage(null)}
        />
      )}

      <View style={styles.filterRow}>
        {filters.map((filter) => (
          <TouchableOpacity key={filter.key} activeOpacity={0.7}
            accessibilityRole="button" accessibilityState={{ selected: filterMode === filter.key }}
            onPress={() => setFilterMode(filter.key)}
            style={[styles.filterChip, filterMode === filter.key && styles.filterChipActive]}>
            <Text style={[styles.filterText, filterMode === filter.key && styles.filterTextActive]}>
              {filter.label} ({dayMeals.filter((meal) => matchesFilter(meal, filter.key)).length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.listHeading}>
        <Text style={styles.listTitle}>Lịch ăn ngày {formatDisplayDate(selectedDate)}</Text>
      </View>
      <Text style={styles.listDescription}>
        Chọn ngày để xem thực đơn và suất ăn của bạn.
      </Text>

      {/* Danh sách ngày ăn */}
      <View style={styles.listContainer}>
        {isLoading ? (
          <LoadingState message="Đang tải lịch ăn…" />
        ) : mealsError || regsError ? (
          <EmptyState iconName="cloud-offline-outline" title="Chưa tải được lịch ăn"
            description="Vui lòng kiểm tra kết nối và thử lại."
            actionText="Thử lại" onAction={handleRefresh} />
        ) : filteredMeals.length > 0 ? (
          filteredMeals.map((meal) => {
            const reg = registrations.find((r) => r.mealId === meal.id || r.mealDate === meal.mealDate);
            return (
              <MealCard
                key={meal.id}
                dateStr={meal.mealDate}
                meal={meal}
                registration={reg}
                onPress={() => router.push(`/meal/${meal.id}` as any)}
                registering={registerMutation.isPending && registerMutation.variables?.mealId === meal.id}
                actionsDisabled={registerMutation.isPending}
                onRegister={handleRegister}
                onCancel={handleOpenCancel}
              />
            );
          })
        ) : (
          <EmptyState
            iconName="calendar-outline"
            title="Không tìm thấy ngày ăn phù hợp"
            description={filterMode !== 'all' ? 'Thử xem tất cả trạng thái trong ngày này.' : `Chưa có lịch ăn ngày ${formatDisplayDate(selectedDate)}. Vui lòng chọn ngày khác.`}
            actionText={filterMode !== 'all' ? 'Xóa bộ lọc' : 'Chọn ngày khác'}
            onAction={() => filterMode !== 'all' ? setFilterMode('all') : setDatePickerVisible(true)}
          />
        )}
      </View>

      {/* Modal Cắt suất */}
      <ConfirmDialog
        visible={cancelModalVisible}
        title="Xác nhận cắt suất ăn"
        message={`Bạn có chắc chắn muốn cắt suất ăn${cancelDate ? ` ngày ${formatDisplayDate(cancelDate)}` : ''}? Yêu cầu sẽ được xử lý theo quy định của nhà bếp.`}
        confirmText={isCancellationClosed(cancelDate, now) ? 'Quá hạn cắt suất' : 'Xác nhận cắt'}
        confirmDisabled={isCancellationClosed(cancelDate, now)}
        cancelText="Giữ lại"
        isDestructive
        iconName="trash-outline"
        loading={cancelMutation.isPending}
        onConfirm={handleConfirmCancel}
        onCancel={() => {
          setCancelModalVisible(false);
          setSelectedRegId(null);
        }}
      />

      {/* Modal chọn khoảng ngày để cắt suất */}
      {datePickerVisible && <DatePickerModal visible mode="single" initialDate={selectedDate} title="Chọn ngày xem lịch ăn"
        onSelectSingle={selectDate} onClose={() => setDatePickerVisible(false)} />}
      <DatePickerModal
        visible={rangePickerVisible}
        mode="range"
        minDate={today}
        title="Chọn khoảng ngày cắt suất"
        onSelectRange={handleSelectDateRange}
        onClose={() => setRangePickerVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  toolsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  dateControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, flexGrow: 1 },
  dateArrow: { minWidth: 44, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  dateSelection: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  dateLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { color: colors.primaryDark, fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
  todayButton: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primaryLight },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  listTitle: { fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.text },
  listHint: { fontSize: typography.sizes.xs, color: colors.textSecondary },
  listDescription: { fontSize: typography.sizes.xs, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
  rangeBtn: {
    minHeight: 48,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary300,
  },
  rangeBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  filterText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textInverse,
  },
  listContainer: {
    paddingBottom: spacing['3xl'],
  },
});
