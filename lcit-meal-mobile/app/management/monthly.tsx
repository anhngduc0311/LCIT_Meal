import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Button } from '../../src/components/common/Button';
import { Input } from '../../src/components/common/Input';
import { FacilitySelector } from '../../src/components/common/FacilitySelector';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { ResultBanner } from '../../src/components/common/ResultBanner';
import { ModalBackdrop } from '../../src/components/common/ModalBackdrop';
import { ModalCard } from '../../src/components/common/ModalCard';
import { ForbiddenState } from '../../src/components/states/ForbiddenState';
import { ErrorState } from '../../src/components/states/ErrorState';
import { LoadingState } from '../../src/components/states/LoadingState';
import { useAuth } from '../../src/providers/AuthProvider';
import { useManagementRegistrations } from '../../src/hooks/useManagementRegistrations';
import { useManagementMeals, useMealGuestCounts } from '../../src/hooks/useManagementMeals';
import { useUsersList } from '../../src/hooks/useManagementUsers';
import { useManagementPayments, useMarkPaid } from '../../src/hooks/useManagementPayments';
import { useSystemSettings } from '../../src/hooks/useManagementSettings';
import { useFacilities } from '../../src/hooks/useFacilities';
import { useCancellationDeadline } from '../../src/hooks/useCancellationDeadline';
import { isCancellationClosed } from '../../src/utils/cancellationDeadline';
import { FacilityFilter, getFacility, matchesFacility } from '../../src/utils/facilities';
import { buildMonthlyMeals, countsAsMeal, monthRange, monthlyPaymentState, shiftMonth } from '../../src/utils/monthlyMeals';
import { formatDisplayDate, formatCurrency } from '../../src/utils/formatters';
import { extractUserRole } from '../../src/types/auth';
import type { MealRegistration, Payment, User } from '../../src/types';
import { mealService } from '../../src/services/mealService';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { GuestCounter } from '../../src/components/meals/GuestCounter';

const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

type ViewMode = 'day' | 'staff';
type PersonFilterType = 'all' | 'has_meals' | 'unpaid' | 'paid';

// Small screens use one vertical page scroll; the roster must keep its natural
// height instead of competing with the filters and footer for leftover space.
function MonthlyList({ flow, children }: React.PropsWithChildren<{ flow: boolean }>) {
  return flow ? <View>{children}</View> : <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

export default function MonthlyMealsScreen() {
  const { role } = useAuth();
  return role === 'admin' || role === 'manager' ? (
    <MonthlyBoard />
  ) : (
    <ScreenContainer>
      <ForbiddenState title="Khu vực quản lý" message="Bảng theo dõi tháng dành cho admin và quản lý." />
    </ScreenContainer>
  );
}

function MonthlyBoard() {
  const { width, height, fontScale } = useWindowDimensions();
  const narrow = width < 600;
  const flow = narrow || height < 720 || fontScale > 1.3;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isMockMode, role } = useAuth();
  const { today, now } = useCancellationDeadline(undefined, '08:20');
  const mealLocked = (date: string, at = now) => role === 'manager' && isCancellationClosed(date, at, '08:20');
  const lockedMessage = 'Đã chốt suất lúc 08:20 (giờ Việt Nam). Ngày này chỉ được xem, không thể cắt suất, đăng ký lại hoặc điều chỉnh khách.';
  const params = useLocalSearchParams<{ date?: string; facility?: string }>();
  let initialDate = today;
  try {
    if (typeof params.date === 'string' && monthRange(params.date.slice(0, 7)).dates.includes(params.date)) initialDate = params.date;
  } catch { /* Invalid links open today's board. */ }
  const [month, setMonth] = useState(initialDate.slice(0, 7));
  const [facility, setFacility] = useState<FacilityFilter>(params.facility === '2' ? 2 : 1);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [personFilter, setPersonFilter] = useState<PersonFilterType>('all');
  const [expandedStaffIds, setExpandedStaffIds] = useState<Set<number>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const previousToday = useRef(today);
  useEffect(() => {
    const previous = previousToday.current;
    if (today === previous) return;
    previousToday.current = today;
    if (selectedDate === previous) {
      setSelectedDate(today);
      if (month === previous.slice(0, 7)) setMonth(today.slice(0, 7));
    }
  }, [today, selectedDate, month]);
  const [daySubFilter, setDaySubFilter] = useState<'all' | 'eating' | 'not_eating'>('all');

  const [monthOpen, setMonthOpen] = useState(false);
  const [draftMonth, setDraftMonth] = useState(month);
  const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [action, setAction] = useState<{ person: User; date: string; record?: MealRegistration; eating: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [paymentPerson, setPaymentPerson] = useState<User | null>(null);
  const [invoice, setInvoice] = useState<Payment | null>(null);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestMode, setGuestMode] = useState<'add' | 'remove'>('add');
  const [guestDate, setGuestDate] = useState(today);
  const [guestExtra, setGuestExtra] = useState(1);

  const range = useMemo(() => monthRange(month), [month]);
  const registrations = useManagementRegistrations({ from: range.from, to: range.to });
  const meals = useManagementMeals({ from: range.from, to: range.to });
  const mealGuests = useMealGuestCounts({ from: range.from, to: range.to });
  const users = useUsersList();
  const payments = useManagementPayments({ from: range.from, to: range.to });
  const settings = useSystemSettings();
  const facilities = useFacilities();
  const markPaid = useMarkPaid();

  const registeredIds = new Set((registrations.data || []).map(r => r.userId));
  const people = (users.data || []).filter(user => {
    const userRole = extractUserRole(user);
    return (userRole === 'employee' || userRole === 'manager')
      && (['1', 'active'].includes(String(user.status)) || registeredIds.has(user.id))
      && matchesFacility(getFacility(user, facilities.overrides), facility);
  }).sort((a, b) => a.id - b.id);

  const settingValue = (key: string) => settings.data?.find(item => item.settingKey === key)?.settingValue;
  const price = Number(settingValue('meal_price'));
  const guestPrice = Number(settingValue('guest_meal_price'));
  const pricesReady = settingValue('meal_price') !== undefined && Number.isFinite(price) && price >= 0
    && settingValue('guest_meal_price') !== undefined && Number.isFinite(guestPrice) && guestPrice >= 0;

  const standaloneGuests = (mealGuests.data || []).filter(item => facility === 'all' || item.facilityId === facility);
  const table = buildMonthlyMeals(month, registrations.data || [], meals.data || [], people.map(p => p.id), pricesReady ? price : 0, pricesReady ? guestPrice : 0, standaloneGuests);
  // Header totals accrue through today; the board still shows future bookings.
  const summary = buildMonthlyMeals(month, registrations.data || [], (meals.data || []).filter(meal => meal.mealDate <= today), people.map(p => p.id), pricesReady ? price : 0, pricesReady ? guestPrice : 0, standaloneGuests);
  const loading = registrations.isLoading || meals.isLoading || users.isLoading || facilities.isLoading || mealGuests.isLoading;
  const error = registrations.error || meals.error || users.error || mealGuests.error;

  // Statistics for quick chips
  const peopleWithMealsCount = people.filter(p => (table.people.get(p.id)?.staff || 0) > 0).length;
  const unpaidCount = people.filter(p => {
    const state = monthlyPaymentState(payments.data || [], p.id, month);
    return !state.paid && (table.people.get(p.id)?.staff || 0) > 0;
  }).length;
  const paidCount = people.filter(p => {
    const state = monthlyPaymentState(payments.data || [], p.id, month);
    return state.paid;
  }).length;

  // Filtered people
  const visiblePeople = people.filter(user => {
    const matchesSearch = `${user.fullName} ${user.username}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
    if (!matchesSearch) return false;
    if (personFilter === 'has_meals') {
      return (table.people.get(user.id)?.staff || 0) > 0;
    }
    if (personFilter === 'unpaid') {
      const state = monthlyPaymentState(payments.data || [], user.id, month);
      return !state.paid && (table.people.get(user.id)?.staff || 0) > 0;
    }
    if (personFilter === 'paid') {
      const state = monthlyPaymentState(payments.data || [], user.id, month);
      return state.paid;
    }
    return true;
  });


  const refresh = async () => {
    await Promise.all([registrations.refetch(), meals.refetch(), mealGuests.refetch(), users.refetch(), payments.refetch(), settings.refetch()]);
  };

  const changeMonth = (next: string) => {
    setMonth(next);
    setNotice(null);
    setSelectedDate(today.slice(0, 7) === next ? today : `${next}-01`);
  };

  const toggleExpandStaff = (id: number) => {
    setExpandedStaffIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveCell = async () => {
    if (!action || busy.current) return;
    if (mealLocked(action.date, Date.now())) {
      setAction(null);
      setNotice({ variant: 'error', message: lockedMessage });
      return;
    }
    const meal = table.mealsByDate.get(action.date);
    if (!meal) return;
    busy.current = true;
    setSaving(true);
    try {
      if (action.eating && action.record) {
        await mealService.cancelRegistrationOnBehalf(action.record.id, isMockMode);
      } else {
        await mealService.registerMeal({ userId: action.person.id, mealId: meal.id, guestCount: action.record?.guestCount || 0 }, isMockMode);
      }
      setAction(null);
      setNotice({
        variant: 'success',
        message: `Đã ${action.eating ? 'cắt' : 'đăng ký'} suất ${action.person.fullName} ngày ${formatDisplayDate(action.date)}.`,
      });
    } catch (err) {
      setAction(null);
      setNotice({ variant: 'error', message: err instanceof Error ? err.message : 'Chưa lưu được suất ăn.' });
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['management', 'registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['meals'] }),
      ]);
      busy.current = false;
      setSaving(false);
    }
  };

  const invoiceState = paymentPerson ? monthlyPaymentState(payments.data || [], paymentPerson.id, month) : null;

  // Day View helpers
  const selectedMeal = table.mealsByDate.get(selectedDate);
  const selectedDayStats = table.days.get(selectedDate) || { staff: 0, guests: 0, total: 0 };
  const removableGuests = (date: string) => standaloneGuests.filter(item => item.mealDate === date)
    .reduce((sum, item) => sum + Number(item.guestCount), 0);
  const saveGuests = async () => {
    if (mealLocked(guestDate, Date.now())) {
      setGuestOpen(false);
      setNotice({ variant: 'error', message: lockedMessage });
      return;
    }
    const meal = table.mealsByDate.get(guestDate);
    if (busy.current || !meal || (facility !== 1 && facility !== 2)) return;
    if (guestMode === 'remove' && guestExtra > removableGuests(guestDate)) {
      setNotice({ variant: 'error', message: 'Số suất khách cần bỏ vượt quá số đã thêm.' });
      setGuestOpen(false);
      return;
    }
    busy.current = true; setSaving(true);
    try {
      const updateGuests = guestMode === 'remove' ? mealService.removeMealGuests : mealService.addMealGuests;
      await updateGuests(meal.id, facility, guestExtra, isMockMode);
      setNotice({ variant: 'success', message: `Đã ${guestMode === 'remove' ? 'bỏ' : 'thêm'} ${guestExtra} suất khách cho Cơ sở ${facility}, ngày ${formatDisplayDate(guestDate)}.` });
    } catch (error) {
      setNotice({ variant: 'error', message: error instanceof Error ? error.message : 'Chưa cập nhật được suất khách.' });
    } finally {
      setGuestOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['management', 'registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['meal-guests'] }),
        queryClient.invalidateQueries({ queryKey: ['meal-registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['meals'] }),
      ]);
      busy.current = false; setSaving(false);
    }
  };
  const dayPeople = visiblePeople.filter(person => {
    if (daySubFilter === 'all') return true;
    const record = table.cells.get(`${selectedDate}:${person.id}`);
    const isEating = countsAsMeal(record);
    if (daySubFilter === 'eating') return isEating;
    if (daySubFilter === 'not_eating') return !isEating;
    return true;
  });

  return (
    <ScreenContainer scrollable={flow} contentContainerStyle={flow ? styles.flowContent : undefined}>
      <Header
        title="Bảng suất ăn tháng"
        subtitle={narrow ? undefined : 'Theo dõi ăn và thanh toán theo từng cán bộ'}
        style={flow ? styles.flowHeader : undefined}
        showBack
        onBack={() => router.back()}
        rightAction={
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Làm mới bảng tháng"
            onPress={() => { void refresh(); }}
            style={styles.iconButton}
          >
            <Ionicons name="refresh-outline" size={21} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      {/* Controls: Month Nav + Facility */}
      <View style={styles.controlsRow}>
        <View style={[styles.monthNav, narrow && styles.narrowMonthNav]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Tháng trước"
            style={[styles.monthNavArrow, narrow && styles.narrowMonthArrow]}
            onPress={() => changeMonth(shiftMonth(month, -1))}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Chọn tháng theo dõi"
            style={[styles.monthButton, narrow && styles.narrowMonthButton]}
            onPress={() => { setDraftMonth(month); setMonthOpen(true); }}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={[styles.monthText, narrow && styles.narrowMonthText]}>{narrow ? `${month.slice(5)}/${month.slice(0, 4)}` : `Tháng ${month.slice(5)}/${month.slice(0, 4)}`}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Tháng sau"
            style={[styles.monthNavArrow, narrow && styles.narrowMonthArrow]}
            onPress={() => changeMonth(shiftMonth(month, 1))}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <FacilitySelector
          value={facility}
          onChange={setFacility}
          style={[styles.facilitySelector, narrow && styles.narrowFacility]}
        />

        {month !== today.slice(0, 7) && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Về tháng hiện tại"
            style={styles.todayJumpBtn}
            onPress={() => changeMonth(today.slice(0, 7))}
          >
            <Ionicons name="today-outline" size={15} color={colors.primary} />
            <Text style={styles.todayJumpText}>Hôm nay</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3 Metric Cards */}
      <View style={styles.metrics}>
        <View style={[styles.metric, styles.metricPrimary]}>
          <View style={styles.metricHeaderRow}>
            <Ionicons name="restaurant-outline" size={13} color={colors.primary} />
            <Text style={styles.metricLabel} numberOfLines={1}>TỔNG SUẤT</Text>
          </View>
          <Text style={styles.metricValue} numberOfLines={1}>
            {loading || error ? '—' : summary.total}
            <Text style={styles.unit}> suất</Text>
          </Text>
        </View>

        <View style={[styles.metric, styles.metricGold]}>
          <View style={styles.metricHeaderRow}>
            <Ionicons name="wallet-outline" size={13} color="#B45309" />
            <Text style={[styles.metricLabel, { color: '#B45309' }]} numberOfLines={1}>DỰ KIẾN</Text>
          </View>
          <Text style={[styles.metricValue, styles.money]} numberOfLines={1} adjustsFontSizeToFit>
            {loading || error || !pricesReady ? '—' : formatCurrency(summary.amount)}
          </Text>
        </View>

        <View style={[styles.metric, styles.metricBlue]}>
          <View style={styles.metricHeaderRow}>
            <Ionicons name="checkmark-done-circle-outline" size={13} color="#1D4ED8" />
            <Text style={[styles.metricLabel, { color: '#1D4ED8' }]} numberOfLines={1}>HOÀN THÀNH</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#1E3A8A' }]} numberOfLines={1}>
            {loading || error ? '—' : summary.completed}
            <Text style={styles.unit}> suất</Text>
          </Text>
        </View>
      </View>

      <View style={[styles.viewModeTabsContainer, narrow && styles.narrowTabsContainer]}>
        <View style={[styles.viewModeTabs, narrow && styles.narrowTabs]}>
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: viewMode === 'day' }}
            style={[styles.viewModeTab, viewMode === 'day' && styles.viewModeTabActive]} onPress={() => setViewMode('day')}>
            <Ionicons name="calendar-outline" size={14} color={viewMode === 'day' ? colors.primaryDark : colors.textMuted} />
            <Text style={[styles.viewModeTabText, viewMode === 'day' && styles.viewModeTabTextActive]}>Theo ngày</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: viewMode === 'staff' }}
            style={[styles.viewModeTab, viewMode === 'staff' && styles.viewModeTabActive]} onPress={() => setViewMode('staff')}>
            <Ionicons name="people-outline" size={14} color={viewMode === 'staff' ? colors.primaryDark : colors.textMuted} />
            <Text style={[styles.viewModeTabText, viewMode === 'staff' && styles.viewModeTabTextActive]}>Theo cán bộ</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Filter Section */}
      <View style={styles.searchSection}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm tên hoặc @tài khoản..."
          accessibilityLabel="Tìm cán bộ trong bảng tháng"
          leftIcon={<Ionicons name="search-outline" size={17} color={colors.textMuted} />}
          rightIcon={
            search ? (
              <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Xóa tìm kiếm">
                <Ionicons name="close-circle" size={17} color={colors.textMuted} />
              </TouchableOpacity>
            ) : undefined
          }
          containerStyle={styles.searchContainer}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterChipsScroll}
          contentContainerStyle={styles.filterChipsContainer}
        >
          <TouchableOpacity
            style={[styles.filterChip, personFilter === 'all' && styles.filterChipActive]}
            onPress={() => setPersonFilter('all')}
          >
            <Text style={[styles.filterChipText, personFilter === 'all' && styles.filterChipTextActive]}>
              Tất cả ({people.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, personFilter === 'has_meals' && styles.filterChipActive]}
            onPress={() => setPersonFilter('has_meals')}
          >
            <Text style={[styles.filterChipText, personFilter === 'has_meals' && styles.filterChipTextActive]}>
              Có ăn ({peopleWithMealsCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, personFilter === 'unpaid' && styles.filterChipActive]}
            onPress={() => setPersonFilter('unpaid')}
          >
            <Text style={[styles.filterChipText, personFilter === 'unpaid' && styles.filterChipTextActive]}>
              Chưa thu ({unpaidCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, personFilter === 'paid' && styles.filterChipActive]}
            onPress={() => setPersonFilter('paid')}
          >
            <Text style={[styles.filterChipText, personFilter === 'paid' && styles.filterChipTextActive]}>
              Đã thu ({paidCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {notice && <ResultBanner {...notice} onDismiss={() => setNotice(null)} />}

      {loading ? (
        <LoadingState message="Đang tổng hợp bảng tháng..." />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => { void refresh(); }} />
      ) : visiblePeople.length === 0 && viewMode === 'staff' ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>Không tìm thấy cán bộ phù hợp.</Text>
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.resetFilterBtn}>
              <Text style={styles.resetFilterText}>Xóa từ khóa tìm kiếm</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : viewMode === 'staff' ? (
        /* ==================== VIEW 2: STAFF LIST CARDS ==================== */
        <MonthlyList flow={flow}>
          {visiblePeople.map(person => {
            const stats = table.people.get(person.id) || { staff: 0, guests: 0, amount: 0 };
            const paymentState = monthlyPaymentState(payments.data || [], person.id, month);
            const isExpanded = expandedStaffIds.has(person.id);

            const personDates = range.dates.map(date => {
              const record = table.cells.get(`${date}:${person.id}`);
              const meal = table.mealsByDate.get(date);
              return { date, record, meal };
            });
            const registeredDatesCount = personDates.filter(d => countsAsMeal(d.record)).length;

            return (
              <View key={person.id} style={styles.staffCard}>
                <View style={styles.staffCardHeader}>
                  <View style={styles.staffAvatar}>
                    <Text style={styles.avatarText}>{person.fullName.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.staffInfo}>
                    <Text style={styles.staffName}>{person.fullName}</Text>
                    <Text style={styles.staffUsername}>@{person.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.staffPaymentBadge, paymentState.paid ? styles.badgePaid : styles.badgeUnpaid]}
                    onPress={() => setPaymentPerson(person)}
                    accessibilityRole="button"
                    accessibilityLabel={`Hóa đơn ${person.fullName}: ${paymentState.label}`}
                  >
                    <Ionicons
                      name={paymentState.paid ? 'checkmark-circle' : 'alert-circle'}
                      size={13}
                      color={paymentState.paid ? '#15803D' : '#B45309'}
                    />
                    <Text style={[styles.staffPaymentText, paymentState.paid ? styles.textPaid : styles.textUnpaid]}>
                      {paymentState.paid ? 'Đã thu' : paymentState.label}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Stats row */}
                <View style={styles.staffStatsRow}>
                  <View style={styles.staffStatItem}>
                    <Text style={styles.staffStatLabel}>Suất cán bộ</Text>
                    <Text style={styles.staffStatVal}>{stats.staff} <Text style={styles.staffStatUnit}>suất</Text></Text>
                  </View>
                  <View style={styles.staffStatDivider} />
                  <View style={styles.staffStatItem}>
                    <Text style={styles.staffStatLabel}>Khách đi kèm</Text>
                    <Text style={styles.staffStatVal}>{stats.guests} <Text style={styles.staffStatUnit}>khách</Text></Text>
                  </View>
                  <View style={styles.staffStatDivider} />
                  <View style={styles.staffStatItem}>
                    <Text style={styles.staffStatLabel}>Dự kiến tiền</Text>
                    <Text style={styles.staffStatValMoney}>
                      {pricesReady ? (stats.amount || 0).toLocaleString('vi-VN') : '—'} <Text style={styles.staffStatUnit}>đ</Text>
                    </Text>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.staffCardActions}>
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => toggleExpandStaff(person.id)}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'calendar-outline'}
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={styles.expandButtonText}>
                      {isExpanded ? 'Thu gọn lịch ăn' : `Xem chi tiết ngày (${registeredDatesCount} ngày)`}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionPaymentBtn}
                    onPress={() => setPaymentPerson(person)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="card-outline" size={14} color={colors.primary} />
                    <Text style={styles.actionPaymentText}>Hóa đơn</Text>
                  </TouchableOpacity>
                </View>

                {/* Accordion detail calendar */}
                {isExpanded && (
                  <View style={styles.staffCalendarSection}>
                    <Text style={styles.calendarSectionTitle}>
                      Lịch ăn tháng {month.slice(5)}/{month.slice(0, 4)}:
                    </Text>
                    <View style={styles.staffDaysGrid}>
                      {personDates.map(({ date, record, meal }) => {
                        const closed = !meal || Boolean(meal.isCancelled) || meal.status !== 'active';
                        const eating = !closed && countsAsMeal(record);
                        const pending = !closed && record?.status === 'pending';
                        const editable = !closed && !saving && !mealLocked(date);
                        const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();

                        return (
                          <TouchableOpacity
                            key={date}
                            disabled={!editable}
                            onPress={() => setAction({ person, date, record, eating: eating || pending })}
                            style={[
                              styles.staffDayChip,
                              eating && styles.staffDayChipEating,
                              record?.status === 'cancelled' && styles.staffDayChipCancelled,
                              closed && styles.staffDayChipClosed,
                              date === today && styles.staffDayChipToday,
                            ]}
                          >
                            <Text style={[styles.staffDayChipDate, date === today && styles.staffDayChipDateToday]}>
                              {date.slice(8)}/{date.slice(5, 7)} ({weekdays[weekday]})
                            </Text>
                            <View style={styles.staffDayChipStatus}>
                              {closed ? (
                                <Text style={styles.staffDayChipDash}>—</Text>
                              ) : eating ? (
                                <View style={styles.staffDayChipEatingRow}>
                                  <Ionicons name="checkmark-circle" size={13} color="#16834D" />
                                  <Text style={styles.staffDayChipEatingText}>
                                    Ăn{Number(record?.guestCount) > 0 ? ` +${record?.guestCount}` : ''}
                                  </Text>
                                </View>
                              ) : record?.status === 'cancelled' ? (
                                <Text style={styles.staffDayChipCancelledText}>Cắt</Text>
                              ) : (
                                <Text style={styles.staffDayChipNone}>—</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </MonthlyList>
      ) : (
        /* ==================== VIEW 3: DAY VIEW ==================== */
        <View style={[styles.dayViewWrapper, flow && styles.flowDayView]}>
          {/* Horizontal scroll of dates */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.daySelectorStrip}
            contentContainerStyle={styles.daySelectorContent}
          >
            {range.dates.map(date => {
              const day = table.days.get(date)!;
              const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
              const meal = table.mealsByDate.get(date);
              const closed = !meal || Boolean(meal.isCancelled) || meal.status !== 'active';
              const isSelected = date === selectedDate;
              const isToday = date === today;

              return (
                <TouchableOpacity
                  key={date}
                  onPress={() => setSelectedDate(date)}
                  style={[
                    styles.datePill,
                    (weekday === 0 || weekday === 6) && styles.datePillWeekend,
                    isSelected && styles.datePillSelected,
                  ]}
                >
                  <Text style={[styles.datePillDayOfWeek, isSelected && styles.datePillTextSelected]}>
                    {weekdays[weekday]}
                  </Text>
                  <Text style={[styles.datePillDate, isSelected && styles.datePillTextSelected]}>
                    {date.slice(8)}/{date.slice(5, 7)}
                  </Text>
                  <Text
                    style={[
                      styles.datePillCount,
                      isSelected && styles.datePillCountSelected,
                      closed && styles.datePillCountClosed,
                    ]}
                  >
                    {!meal ? '—' : closed ? 'Nghỉ' : `${day.total}s`}
                  </Text>
                  {isToday && (
                    <View style={[styles.todayDot, isSelected && { backgroundColor: '#FFFFFF' }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Selected Day Banner */}
          <View style={styles.selectedDayBanner}>
            <View style={styles.selectedDayTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedDayTitle}>
                  {formatDisplayDate(selectedDate)} ({weekdays[new Date(`${selectedDate}T12:00:00Z`).getUTCDay()]})
                </Text>
                <Text style={styles.selectedDaySub}>
                  {!selectedMeal
                    ? 'Chưa có lịch phục vụ'
                    : selectedMeal.isCancelled
                    ? 'Bếp thông báo nghỉ'
                    : 'Bếp mở phục vụ bình thường'}
                </Text>
              </View>
              <View style={styles.selectedDayBadge}>
                <Text style={styles.selectedDayTotalNum}>{selectedDayStats.total}</Text>
                <Text style={styles.selectedDayTotalLabel}>suất</Text>
              </View>
            </View>

            <View style={styles.guestDayActions}>
              <Text style={styles.selectedDaySub}>{selectedDayStats.staff} cán bộ · {selectedDayStats.guests} khách</Text>
              <Button title="Điều chỉnh khách" size="sm" variant="outline"
                disabled={saving || mealLocked(selectedDate) || !selectedMeal || Boolean(selectedMeal.isCancelled) || selectedMeal.status !== 'active' || (facility !== 1 && facility !== 2)}
                onPress={() => { setGuestMode('add'); setGuestDate(selectedDate); setGuestExtra(1); setGuestOpen(true); }} />
            </View>
            {/* Sub-filter chips for day view */}
            {mealLocked(selectedDate) && <Text style={styles.dialogHint}>{lockedMessage}</Text>}
            <View style={styles.daySubFilterRow}>
              <TouchableOpacity
                style={[styles.daySubChip, daySubFilter === 'all' && styles.daySubChipActive]}
                onPress={() => setDaySubFilter('all')}
              >
                <Text style={[styles.daySubChipText, daySubFilter === 'all' && styles.daySubChipTextActive]}>
                  Tất cả ({visiblePeople.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.daySubChip, daySubFilter === 'eating' && styles.daySubChipActive]}
                onPress={() => setDaySubFilter('eating')}
              >
                <Text style={[styles.daySubChipText, daySubFilter === 'eating' && styles.daySubChipTextActive]}>
                  Đăng ký ăn ({selectedDayStats.staff})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.daySubChip, daySubFilter === 'not_eating' && styles.daySubChipActive]}
                onPress={() => setDaySubFilter('not_eating')}
              >
                <Text style={[styles.daySubChipText, daySubFilter === 'not_eating' && styles.daySubChipTextActive]}>
                  Không ăn ({Math.max(0, visiblePeople.length - selectedDayStats.staff)})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Staff list on selected day */}
          <MonthlyList flow={flow}>
            {dayPeople.map(person => {
              const record = table.cells.get(`${selectedDate}:${person.id}`);
              const meal = table.mealsByDate.get(selectedDate);
              const closed = !meal || Boolean(meal.isCancelled) || meal.status !== 'active';
              const eating = !closed && countsAsMeal(record);
              const pending = !closed && record?.status === 'pending';
              const editable = !closed && !saving && !mealLocked(selectedDate);

              return (
                <View key={person.id} style={styles.dayStaffRow}>
                  <View style={styles.dayStaffAvatar}>
                    <Text style={styles.avatarText}>{person.fullName.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.dayStaffInfo}>
                    <Text style={styles.dayStaffName}>{person.fullName}</Text>
                    <Text style={styles.dayStaffUser}>@{person.username}</Text>
                  </View>

                  <View style={styles.dayStaffStatus}>
                    {closed ? (
                      <Text style={styles.dash}>—</Text>
                    ) : eating ? (
                      <View style={styles.eatingBadge}>
                        <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                        <Text style={styles.eatingBadgeText}>
                          Ăn{Number(record?.guestCount) > 0 ? ` +${record?.guestCount}k` : ''}
                        </Text>
                      </View>
                    ) : record?.status === 'cancelled' ? (
                      <View style={styles.cancelledBadge}>
                        <Ionicons name="close-circle" size={15} color="#DC2626" />
                        <Text style={styles.cancelledBadgeText}>Đã cắt</Text>
                      </View>
                    ) : pending ? (
                      <View style={styles.pendingBadge}>
                        <Ionicons name="time" size={15} color="#D97706" />
                        <Text style={styles.pendingBadgeText}>Chờ</Text>
                      </View>
                    ) : (
                      <Text style={styles.notRegisteredText}>—</Text>
                    )}
                  </View>

                  {editable && (
                    <TouchableOpacity
                      style={[styles.dayActionBtn, eating ? styles.dayActionCut : styles.dayActionReg]}
                      onPress={() => setAction({ person, date: selectedDate, record, eating: eating || pending })}
                    >
                      <Text style={[styles.dayActionBtnText, eating ? styles.dayActionCutText : styles.dayActionRegText]}>
                        {eating ? 'Cắt' : 'Đăng ký'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </MonthlyList>
        </View>
      )}

      {/* Legend & Footnotes */}
      <View style={styles.bottomBar}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <Ionicons name="checkmark-circle" size={14} color="#16834D" />
            <Text style={styles.legendText}>Ăn</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="close-circle" size={14} color="#DC2626" />
            <Text style={styles.legendText}>Đã cắt</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="time" size={14} color="#D97706" />
            <Text style={styles.legendText}>Chờ duyệt</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendDash}>—</Text>
            <Text style={styles.legendText}>Chưa phục vụ</Text>
          </View>
        </View>

        <Text style={styles.footnote}>
          Admin/quản lý có thể cắt và đăng ký lại không giới hạn thời gian.{'\n'}
          Đơn giá: {pricesReady ? `${formatCurrency(price)}/cán bộ · ${formatCurrency(guestPrice)}/khách` : 'Đang tải đơn giá...'}
        </Text>
      </View>

      {/* Confirm Registration / Cancellation Dialog */}
      <ConfirmDialog
        visible={Boolean(action)}
        loading={saving}
        confirmDisabled={Boolean(action && mealLocked(action.date))}
        title={action?.eating ? 'Cắt suất ăn' : 'Đăng ký suất ăn'}
        message={
          action
            ? `${action.person.fullName} · ${formatDisplayDate(action.date)}. ${
                action.eating
                  ? `Cắt 1 suất cán bộ${action.record?.guestCount ? ` và ${action.record.guestCount} suất khách đi kèm` : ''}?`
                  : `Đăng ký 1 suất cán bộ${action.record?.guestCount ? ` và ${action.record.guestCount} suất khách đi kèm` : ''}?`
              }`
            : ''
        }
        confirmText={action?.eating ? 'Cắt suất' : 'Đăng ký'}
        onConfirm={() => { void saveCell(); }}
        onCancel={() => { if (!busy.current) setAction(null); }}
      />

      <Modal visible={guestOpen} transparent animationType="fade" onRequestClose={() => { if (!saving) setGuestOpen(false); }}>
        <ModalBackdrop style={styles.backdrop}>
          <ModalCard style={[styles.dialog, { maxHeight: '92%', padding: 0 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }} nestedScrollEnabled>
              <Text style={styles.dialogTitle}>Điều chỉnh khách</Text>
              <Text style={styles.dialogHint}>Ngày ăn: {formatDisplayDate(guestDate)}</Text>
              <Text style={styles.dialogHint}>Cơ sở {facility}</Text>
              <View style={styles.actions}>
                <Button title="Thêm khách" size="sm" variant={guestMode === 'add' ? 'primary' : 'secondary'}
                  accessibilityState={{ selected: guestMode === 'add' }} disabled={saving}
                  onPress={() => { setGuestMode('add'); setGuestExtra(1); }} style={{ flex: 1 }} />
                <Button title="Bớt khách" size="sm" variant={guestMode === 'remove' ? 'primary' : 'secondary'}
                  accessibilityState={{ selected: guestMode === 'remove' }} disabled={saving || removableGuests(guestDate) === 0}
                  onPress={() => { setGuestMode('remove'); setGuestExtra(1); }} style={{ flex: 1 }} />
              </View>
              <GuestCounter value={guestExtra} onChange={setGuestExtra} min={1} max={guestMode === 'remove' ? Math.max(1, Math.min(1000, removableGuests(guestDate))) : 1000} disabled={saving}
                label={guestMode === 'remove' ? 'Số suất khách cần bớt' : 'Số suất khách cần thêm'} valueDescription={`${guestExtra} suất khách`}
                helperText={guestMode === 'remove' ? `Có thể bớt ${removableGuests(guestDate)} suất khách đã thêm riêng cho cơ sở này.` : ''} />
              <View style={styles.actions}>
                <Button title="Hủy" variant="secondary" disabled={saving} onPress={() => setGuestOpen(false)} style={{ flex: 1 }} />
                <Button title={guestMode === 'remove' ? 'Xác nhận bớt' : 'Xác nhận thêm'} loading={saving}
                  disabled={mealLocked(guestDate) || (guestMode === 'remove' && (guestExtra > removableGuests(guestDate) || removableGuests(guestDate) === 0))}
                  onPress={() => { void saveGuests(); }} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </ModalCard>
        </ModalBackdrop>
      </Modal>
      {/* Modal: Month Selection */}
      <Modal visible={monthOpen} transparent animationType="fade" onRequestClose={() => setMonthOpen(false)}>
        <ModalBackdrop style={styles.backdrop}>
          <ModalCard style={styles.dialog}>
            <Text style={styles.dialogTitle}>Chọn tháng theo dõi</Text>
            <Input
              label="Tháng (YYYY-MM)"
              value={draftMonth}
              onChangeText={setDraftMonth}
              placeholder="2026-11"
              maxLength={7}
            />
            <View style={styles.actions}>
              <Button title="Hủy" variant="secondary" onPress={() => setMonthOpen(false)} style={{ flex: 1 }} />
              <Button
                title="Xem bảng"
                style={{ flex: 1 }}
                onPress={() => {
                  try {
                    monthRange(draftMonth);
                    changeMonth(draftMonth);
                    setMonthOpen(false);
                  } catch {
                    setNotice({ variant: 'error', message: 'Nhập tháng theo dạng YYYY-MM, ví dụ 2026-11.' });
                    setMonthOpen(false);
                  }
                }}
              />
            </View>
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* Modal: Payment Details for Person */}
      <Modal visible={Boolean(paymentPerson)} transparent animationType="fade" onRequestClose={() => setPaymentPerson(null)}>
        <ModalBackdrop style={styles.backdrop}>
          <ModalCard style={styles.dialog}>
            <Text style={styles.dialogTitle}>Thanh toán tháng {month.slice(5)}/{month.slice(0, 4)}</Text>
            <Text style={styles.personDetail}>{paymentPerson?.fullName}</Text>
            {payments.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : payments.isError ? (
              <Text>Chưa tải được hóa đơn. Vui lòng làm mới bảng.</Text>
            ) : !invoiceState?.invoices.length ? (
              <Text style={styles.dialogHint}>Chưa có hóa đơn cho người này trong tháng. Lập hóa đơn tại Quản lý thu tiền.</Text>
            ) : (
              invoiceState.invoices.map(payment => (
                <View key={payment.id} style={styles.invoice}>
                  <Text style={styles.personDetail}>{formatDisplayDate(payment.paymentDate)} · {formatCurrency(payment.amount)}</Text>
                  <Text style={styles.dialogHint}>{payment.status === 'paid' || payment.isPaid ? 'Đã thu' : 'Chưa thu'}</Text>
                  {payment.status !== 'paid' && !payment.isPaid && (
                    <Button title="Xác nhận đã thu" variant="outline" onPress={() => setInvoice(payment)} />
                  )}
                </View>
              ))
            )}
            <View style={styles.actions}>
              <Button title="Đóng" variant="secondary" style={{ flex: 1 }} onPress={() => setPaymentPerson(null)} />
              <Button
                title="Quản lý thu tiền"
                style={{ flex: 1 }}
                onPress={() => {
                  setPaymentPerson(null);
                  router.push('/management/payments');
                }}
              />
            </View>
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* Confirm Invoice Paid */}
      <ConfirmDialog
        visible={Boolean(invoice)}
        loading={markPaid.isPending}
        title="Xác nhận đã thu tiền"
        message={`${paymentPerson?.fullName || ''} · Hóa đơn ${invoice ? formatDisplayDate(invoice.paymentDate) : ''} · ${formatCurrency(invoice?.amount || 0)}. Chỉ xác nhận sau khi đã nhận tiền.`}
        confirmText="Đã nhận tiền"
        onCancel={() => { if (!markPaid.isPending) setInvoice(null); }}
        onConfirm={async () => {
          if (!invoice || markPaid.isPending) return;
          try {
            await markPaid.mutateAsync({ id: invoice.id, data: { paidAmount: invoice.amount } });
            setInvoice(null);
            setPaymentPerson(null);
            setNotice({ variant: 'success', message: 'Đã xác nhận thanh toán.' });
          } catch (err) {
            setInvoice(null);
            setPaymentPerson(null);
            setNotice({ variant: 'error', message: err instanceof Error ? err.message : 'Chưa lưu được thanh toán.' });
          }
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  guestDayActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 },
  flowContent: { paddingVertical: 12 },
  flowHeader: { marginBottom: 12 },
  flowDayView: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  narrowMonthNav: { flexShrink: 0 },
  narrowMonthArrow: { width: 28 },
  narrowMonthButton: { paddingHorizontal: 2, gap: 4 },
  narrowMonthText: { fontSize: 12 },
  narrowFacility: { minWidth: 120, maxWidth: undefined },
  narrowTabsContainer: { flexDirection: 'column', alignItems: 'stretch' },
  narrowTabs: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  // Controls row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  monthNavArrow: {
    width: 38,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    height: 44,
  },
  monthText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  facilitySelector: {
    flex: 1,
    minWidth: 130,
    maxWidth: 220,
    marginVertical: 0,
  },
  todayJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: 10,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: colors.primary300,
    borderRadius: radius.lg,
  },
  todayJumpText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },

  // Metrics
  metrics: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  metricPrimary: {
    backgroundColor: colors.primary50,
    borderColor: '#C3E5D1',
  },
  metricGold: {
    backgroundColor: '#FEF9EE',
    borderColor: '#FDE68A',
  },
  metricBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 9,
    color: colors.primaryDark,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 2,
  },
  unit: {
    fontSize: 11,
    fontWeight: '500',
  },
  money: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
  },

  // View Mode Switcher
  viewModeTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  viewModeTabs: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#EFF3F0',
    borderRadius: radius.full,
    padding: 3,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: radius.full,
  },
  viewModeTabActive: {
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  viewModeTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  viewModeTabTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  // Search & Filter
  searchSection: {
    marginBottom: 8,
  },
  searchContainer: {
    marginBottom: 6,
  },
  filterChipsScroll: {
    maxHeight: 32,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  dash: { color: '#ACB8B2', fontSize: 13 },

  // Staff View Cards
  listContainer: {
    flex: 1,
  },
  staffCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  staffCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  staffAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  staffUsername: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  staffPaymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgePaid: {
    backgroundColor: '#E6F4EA',
  },
  badgeUnpaid: {
    backgroundColor: '#FEF3C7',
  },
  staffPaymentText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textPaid: {
    color: '#15803D',
  },
  textUnpaid: {
    color: '#B45309',
  },
  staffStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDark,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  staffStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  staffStatLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '600',
  },
  staffStatVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 2,
  },
  staffStatUnit: {
    fontSize: 10,
    fontWeight: '500',
  },
  staffStatValMoney: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
  },
  staffStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.borderDark,
  },
  staffCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expandButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  actionPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: colors.primary200,
    borderRadius: radius.md,
  },
  actionPaymentText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  staffCalendarSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  calendarSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  staffDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  staffDayChip: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: '#F3F7F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 5,
    alignItems: 'center',
  },
  staffDayChipEating: {
    backgroundColor: '#E9F7ED',
    borderColor: '#A6E4B9',
  },
  staffDayChipCancelled: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  staffDayChipClosed: {
    backgroundColor: '#F3F4F4',
    opacity: 0.6,
  },
  staffDayChipToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  staffDayChipDate: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  staffDayChipDateToday: {
    color: colors.primaryDark,
  },
  staffDayChipStatus: {
    marginTop: 2,
  },
  staffDayChipEatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  staffDayChipEatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16834D',
  },
  staffDayChipCancelledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  staffDayChipDash: {
    fontSize: 10,
    color: '#ACB8B2',
  },
  staffDayChipNone: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Day View
  dayViewWrapper: {
    flex: 1,
  },
  daySelectorStrip: {
    maxHeight: 62,
    marginBottom: 8,
  },
  daySelectorContent: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 8,
  },
  datePill: {
    width: 52,
    height: 56,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  datePillWeekend: {
    backgroundColor: '#FFF5F2',
  },
  datePillSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  datePillDayOfWeek: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
  },
  datePillDate: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 1,
  },
  datePillCount: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 1,
  },
  datePillCountSelected: {
    color: '#D5F5DF',
  },
  datePillCountClosed: {
    color: '#9CA3AF',
  },
  datePillTextSelected: {
    color: '#FFFFFF',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    position: 'absolute',
    top: 3,
    right: 3,
  },
  selectedDayBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 10,
    marginBottom: 8,
  },
  selectedDayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedDayTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  selectedDaySub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  selectedDayBadge: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  selectedDayTotalNum: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  selectedDayTotalLabel: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  daySubFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  daySubChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundDark,
  },
  daySubChipActive: {
    backgroundColor: colors.primary,
  },
  daySubChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  daySubChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayStaffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  dayStaffAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary50,
    borderWidth: 1,
    borderColor: colors.primary200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayStaffInfo: {
    flex: 1,
  },
  dayStaffName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  dayStaffUser: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  dayStaffStatus: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  eatingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  cancelledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  cancelledBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  notRegisteredText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  dayActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  dayActionCut: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  dayActionReg: {
    backgroundColor: colors.primary50,
    borderColor: colors.primary200,
  },
  dayActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dayActionCutText: {
    color: '#BE123C',
  },
  dayActionRegText: {
    color: colors.primaryDark,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  resetFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    marginTop: 4,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },

  // Bottom Legend & Footnote
  bottomBar: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  legendDash: {
    fontSize: 12,
    color: '#ACB8B2',
    fontWeight: '700',
  },
  footnote: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 3,
  },

  // Modals
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 12,
    width: '100%',
    maxWidth: 500,
  },
  dialogTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
  },
  personDetail: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  dialogHint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  invoice: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    gap: 6,
  },
});
