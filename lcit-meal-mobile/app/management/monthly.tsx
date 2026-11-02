import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import { useManagementMeals } from '../../src/hooks/useManagementMeals';
import { useUsersList } from '../../src/hooks/useManagementUsers';
import { useManagementPayments, useMarkPaid } from '../../src/hooks/useManagementPayments';
import { useSystemSettings } from '../../src/hooks/useManagementSettings';
import { useFacilities } from '../../src/hooks/useFacilities';
import { useCancellationDeadline } from '../../src/hooks/useCancellationDeadline';
import { FacilityFilter, facilityLabel, getFacility, matchesFacility } from '../../src/utils/facilities';
import { buildMonthlyMeals, countsAsMeal, monthRange, monthlyPaymentState, shiftMonth } from '../../src/utils/monthlyMeals';
import { formatDisplayDate, formatCurrency } from '../../src/utils/formatters';
import { extractUserRole } from '../../src/types/auth';
import type { MealRegistration, Payment, User } from '../../src/types';
import { mealService } from '../../src/services/mealService';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';

const STANDARD_COL_WIDTH = 74;
const COMPACT_COL_WIDTH = 62;
const DATE_WIDTH = 96;
const HEIGHT = 44;
const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

type ViewMode = 'grid' | 'staff' | 'day';
type PersonFilterType = 'all' | 'has_meals' | 'unpaid' | 'paid';

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isMockMode } = useAuth();
  const { today, now } = useCancellationDeadline();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [facility, setFacility] = useState<FacilityFilter>(1);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [personFilter, setPersonFilter] = useState<PersonFilterType>('all');
  const [compactSummary, setCompactSummary] = useState(true);
  const [columnWidthMode, setColumnWidthMode] = useState<'standard' | 'compact'>('standard');
  const [expandedStaffIds, setExpandedStaffIds] = useState<Set<number>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>(today.slice(0, 7) === month ? today : `${month}-01`);
  const [daySubFilter, setDaySubFilter] = useState<'all' | 'eating' | 'not_eating'>('all');

  const [monthOpen, setMonthOpen] = useState(false);
  const [draftMonth, setDraftMonth] = useState(month);
  const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [action, setAction] = useState<{ person: User; date: string; record?: MealRegistration; eating: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [paymentPerson, setPaymentPerson] = useState<User | null>(null);
  const [invoice, setInvoice] = useState<Payment | null>(null);
  const headerScroll = useRef<ScrollView>(null);
  const bodyScroll = useRef<ScrollView>(null);

  const range = useMemo(() => monthRange(month), [month]);
  const registrations = useManagementRegistrations({ from: range.from, to: range.to });
  const meals = useManagementMeals({ from: range.from, to: range.to });
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

  const table = buildMonthlyMeals(month, registrations.data || [], meals.data || [], people.map(p => p.id), pricesReady ? price : 0, pricesReady ? guestPrice : 0);
  const loading = registrations.isLoading || meals.isLoading || users.isLoading || facilities.isLoading;
  const error = registrations.error || meals.error || users.error;
  const completionTime = settingValue('meal_completion_time') || '12:00';

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

  const colWidth = columnWidthMode === 'compact' ? COMPACT_COL_WIDTH : STANDARD_COL_WIDTH;

  const refresh = async () => {
    await Promise.all([registrations.refetch(), meals.refetch(), users.refetch(), payments.refetch(), settings.refetch()]);
  };

  const changeMonth = (next: string) => {
    setMonth(next);
    setNotice(null);
    setSelectedDate(today.slice(0, 7) === next ? today : `${next}-01`);
    bodyScroll.current?.scrollTo({ x: 0, animated: false });
    headerScroll.current?.scrollTo({ x: 0, animated: false });
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
        queryClient.invalidateQueries({ queryKey: ['meals'] }),
      ]);
      busy.current = false;
      setSaving(false);
    }
  };

  const cell = (person: User, date: string) => {
    const record = table.cells.get(`${date}:${person.id}`);
    const meal = table.mealsByDate.get(date);
    const closed = !meal || Boolean(meal.isCancelled) || meal.status !== 'active';
    const eating = !closed && countsAsMeal(record);
    const pending = !closed && record?.status === 'pending';
    const completed = record?.status === 'completed' || date < today || now >= Date.parse(`${date}T${completionTime}:00+07:00`);
    const editable = !closed && !completed && !saving;

    return (
      <TouchableOpacity
        key={person.id}
        accessibilityRole="checkbox"
        accessibilityLabel={`${person.fullName}, ${formatDisplayDate(date)}${closed ? ', chưa phục vụ' : ''}`}
        accessibilityState={{ checked: eating, disabled: !editable }}
        disabled={!editable}
        onPress={() => setAction({ person, date, record, eating: eating || pending })}
        style={[
          styles.cell,
          { width: colWidth },
          styles.mealCell,
          closed && styles.closed,
          eating && styles.eating,
          pending && styles.pending,
        ]}
      >
        {closed ? (
          <Text style={styles.dash}>—</Text>
        ) : pending ? (
          <Ionicons name="time" size={17} color="#AD6800" />
        ) : (
          <Ionicons
            name={eating ? 'checkmark-circle' : record?.status === 'cancelled' ? 'close-circle' : 'ellipse-outline'}
            size={eating || record?.status === 'cancelled' ? 19 : 15}
            color={eating ? '#16834D' : record?.status === 'cancelled' ? '#DC2626' : '#C3D0CA'}
          />
        )}
        {eating && Number(record?.guestCount) > 0 && (
          <Text style={styles.guestBadge}>+{record?.guestCount}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const invoiceState = paymentPerson ? monthlyPaymentState(payments.data || [], paymentPerson.id, month) : null;

  // Day View helpers
  const selectedMeal = table.mealsByDate.get(selectedDate);
  const selectedDayStats = table.days.get(selectedDate) || { staff: 0, guests: 0, total: 0 };
  const dayPeople = visiblePeople.filter(person => {
    if (daySubFilter === 'all') return true;
    const record = table.cells.get(`${selectedDate}:${person.id}`);
    const isEating = countsAsMeal(record);
    if (daySubFilter === 'eating') return isEating;
    if (daySubFilter === 'not_eating') return !isEating;
    return true;
  });

  return (
    <ScreenContainer scrollable={false}>
      <Header
        title="Bảng suất ăn tháng"
        subtitle="Theo dõi ăn và thanh toán theo từng cán bộ"
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
        <View style={styles.monthNav}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Tháng trước"
            style={styles.monthNavArrow}
            onPress={() => changeMonth(shiftMonth(month, -1))}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Chọn tháng theo dõi"
            style={styles.monthButton}
            onPress={() => { setDraftMonth(month); setMonthOpen(true); }}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.monthText}>Tháng {month.slice(5)}/{month.slice(0, 4)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Tháng sau"
            style={styles.monthNavArrow}
            onPress={() => changeMonth(shiftMonth(month, 1))}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <FacilitySelector
          value={facility}
          onChange={setFacility}
          style={styles.facilitySelector}
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
            {loading || error ? '—' : table.total}
            <Text style={styles.unit}> suất</Text>
          </Text>
        </View>

        <View style={[styles.metric, styles.metricGold]}>
          <View style={styles.metricHeaderRow}>
            <Ionicons name="wallet-outline" size={13} color="#B45309" />
            <Text style={[styles.metricLabel, { color: '#B45309' }]} numberOfLines={1}>DỰ KIẾN</Text>
          </View>
          <Text style={[styles.metricValue, styles.money]} numberOfLines={1} adjustsFontSizeToFit>
            {loading || error || !pricesReady ? '—' : formatCurrency(table.amount)}
          </Text>
        </View>

        <View style={[styles.metric, styles.metricBlue]}>
          <View style={styles.metricHeaderRow}>
            <Ionicons name="checkmark-done-circle-outline" size={13} color="#1D4ED8" />
            <Text style={[styles.metricLabel, { color: '#1D4ED8' }]} numberOfLines={1}>HOÀN THÀNH</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#1E3A8A' }]} numberOfLines={1}>
            {loading || error ? '—' : table.completed}
            <Text style={styles.unit}> suất</Text>
          </Text>
        </View>
      </View>

      {/* View Mode Switcher: Lưới | Theo cán bộ | Theo ngày */}
      <View style={styles.viewModeTabsContainer}>
        <View style={styles.viewModeTabs}>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'grid' }}
            style={[styles.viewModeTab, viewMode === 'grid' && styles.viewModeTabActive]}
            onPress={() => setViewMode('grid')}
          >
            <Ionicons name="grid-outline" size={14} color={viewMode === 'grid' ? colors.primaryDark : colors.textMuted} />
            <Text style={[styles.viewModeTabText, viewMode === 'grid' && styles.viewModeTabTextActive]}>
              Bảng lưới
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'staff' }}
            style={[styles.viewModeTab, viewMode === 'staff' && styles.viewModeTabActive]}
            onPress={() => setViewMode('staff')}
          >
            <Ionicons name="people-outline" size={14} color={viewMode === 'staff' ? colors.primaryDark : colors.textMuted} />
            <Text style={[styles.viewModeTabText, viewMode === 'staff' && styles.viewModeTabTextActive]}>
              Theo cán bộ
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'day' }}
            style={[styles.viewModeTab, viewMode === 'day' && styles.viewModeTabActive]}
            onPress={() => setViewMode('day')}
          >
            <Ionicons name="calendar-outline" size={14} color={viewMode === 'day' ? colors.primaryDark : colors.textMuted} />
            <Text style={[styles.viewModeTabText, viewMode === 'day' && styles.viewModeTabTextActive]}>
              Theo ngày
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'grid' && (
          <View style={styles.gridQuickActions}>
            <TouchableOpacity
              style={[styles.gridActionChip, !compactSummary && styles.gridActionChipActive]}
              onPress={() => setCompactSummary(prev => !prev)}
              accessibilityRole="button"
              accessibilityLabel={compactSummary ? "Hiện tổng kết đầu cột" : "Thu gọn tổng kết đầu cột"}
            >
              <Ionicons
                name={compactSummary ? "chevron-down-circle-outline" : "chevron-up-circle-outline"}
                size={13}
                color={!compactSummary ? colors.primaryDark : colors.textSecondary}
              />
              <Text style={[styles.gridActionText, !compactSummary && styles.gridActionTextActive]}>
                {compactSummary ? 'Hiện tổng' : 'Gọn đầu'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.gridActionChip, columnWidthMode === 'compact' && styles.gridActionChipActive]}
              onPress={() => setColumnWidthMode(prev => prev === 'standard' ? 'compact' : 'standard')}
              accessibilityRole="button"
              accessibilityLabel={`Độ rộng cột: ${columnWidthMode === 'standard' ? 'vừa' : 'nhỏ'}`}
            >
              <Ionicons
                name="resize-outline"
                size={13}
                color={columnWidthMode === 'compact' ? colors.primaryDark : colors.textSecondary}
              />
              <Text style={[styles.gridActionText, columnWidthMode === 'compact' && styles.gridActionTextActive]}>
                {columnWidthMode === 'standard' ? 'Cột vừa' : 'Cột gọn'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
      ) : visiblePeople.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>Không tìm thấy cán bộ phù hợp.</Text>
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.resetFilterBtn}>
              <Text style={styles.resetFilterText}>Xóa từ khóa tìm kiếm</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : viewMode === 'grid' ? (
        /* ==================== VIEW 1: MATRIX GRID ==================== */
        <ScrollView style={styles.table} stickyHeaderIndices={[0]} nestedScrollEnabled>
          <View style={styles.tableHeader}>
            <View style={styles.dateHeader}>
              <View style={[styles.nameHeader, compactSummary ? styles.nameHeaderCompact : styles.nameHeaderFull]}>
                <Text style={styles.headerText}>NGÀY ĂN</Text>
                <Text style={styles.headerSmall}>Cuộn ngang →</Text>
              </View>
              {!compactSummary && (
                <>
                  <View style={styles.summaryLabel}>
                    <Text style={styles.headerSmall}>Suất / người</Text>
                  </View>
                  <View style={styles.summaryLabel}>
                    <Text style={styles.headerSmall}>Dự kiến (đ)</Text>
                  </View>
                  <View style={styles.summaryLabel}>
                    <Text style={styles.headerSmall}>Thanh toán</Text>
                  </View>
                </>
              )}
            </View>

            <ScrollView
              horizontal
              ref={headerScroll}
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              style={styles.rightPane}
            >
              <View>
                {/* Staff Name Columns */}
                <View style={styles.row}>
                  {visiblePeople.map(person => {
                    const personStats = table.people.get(person.id);
                    const paymentState = monthlyPaymentState(payments.data || [], person.id, month);
                    return (
                      <TouchableOpacity
                        key={person.id}
                        activeOpacity={0.8}
                        onPress={() => setPaymentPerson(person)}
                        style={[
                          styles.nameHeader,
                          styles.personHeader,
                          { width: colWidth },
                          compactSummary ? styles.nameHeaderCompact : styles.nameHeaderFull,
                        ]}
                      >
                        <Text style={styles.personName} numberOfLines={compactSummary ? 1 : 2}>
                          {person.fullName}
                        </Text>
                        {!compactSummary ? (
                          <Text style={styles.username} numberOfLines={1}>
                            @{person.username}
                          </Text>
                        ) : (
                          <View style={styles.compactHeaderStats}>
                            <Text style={styles.compactBadgeCount}>{personStats?.staff || 0}s</Text>
                            <View
                              style={[
                                styles.paymentDot,
                                { backgroundColor: paymentState.paid ? '#22C55E' : '#F59E0B' },
                              ]}
                            />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <View
                    style={[
                      styles.nameHeader,
                      styles.totalHeader,
                      { width: colWidth },
                      compactSummary ? styles.nameHeaderCompact : styles.nameHeaderFull,
                    ]}
                  >
                    <Text style={styles.headerText}>KHÁCH</Text>
                  </View>
                  <View
                    style={[
                      styles.nameHeader,
                      styles.totalHeader,
                      { width: colWidth },
                      compactSummary ? styles.nameHeaderCompact : styles.nameHeaderFull,
                    ]}
                  >
                    <Text style={styles.headerText}>TỔNG</Text>
                  </View>
                </View>

                {/* Optional Summary Rows */}
                {!compactSummary && (
                  <>
                    <View style={styles.row}>
                      {visiblePeople.map(person => (
                        <View key={person.id} style={[styles.summaryCell, { width: colWidth }]}>
                          <Text style={styles.summaryValue}>{table.people.get(person.id)?.staff || 0}</Text>
                        </View>
                      ))}
                      <View style={[styles.summaryCell, { width: colWidth }]}>
                        <Text style={styles.summaryValue}>
                          {[...table.days.values()].reduce((n, d) => n + d.guests, 0)}
                        </Text>
                      </View>
                      <View style={[styles.summaryCell, { width: colWidth }]}>
                        <Text style={styles.summaryValue}>{table.total}</Text>
                      </View>
                    </View>

                    <View style={styles.row}>
                      {visiblePeople.map(person => (
                        <View key={person.id} style={[styles.summaryCell, { width: colWidth }]}>
                          <Text style={styles.smallMoney} numberOfLines={1}>
                            {pricesReady ? (table.people.get(person.id)?.amount || 0).toLocaleString('vi-VN') : '—'}
                          </Text>
                        </View>
                      ))}
                      <View style={[styles.summaryCell, { width: colWidth }]}>
                        <Text style={styles.smallMoney}>—</Text>
                      </View>
                      <View style={[styles.summaryCell, { width: colWidth }]}>
                        <Text style={styles.smallMoney} numberOfLines={1}>
                          {pricesReady ? table.amount.toLocaleString('vi-VN') : '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.row}>
                      {visiblePeople.map(person => {
                        const state = monthlyPaymentState(payments.data || [], person.id, month);
                        return (
                          <TouchableOpacity
                            key={person.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Thanh toán ${person.fullName}: ${state.label}`}
                            style={[styles.summaryCell, styles.paymentCell, { width: colWidth }]}
                            onPress={() => setPaymentPerson(person)}
                          >
                            <Text
                              style={[styles.paymentText, state.paid && { color: '#15803D' }]}
                              numberOfLines={1}
                            >
                              {payments.isLoading || payments.isError ? '—' : state.paid ? '✓ Đã thu' : state.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      <View style={[styles.summaryCell, { width: colWidth }]} />
                      <View style={[styles.summaryCell, { width: colWidth }]} />
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </View>

          {/* Table Body */}
          <View style={styles.body}>
            <View style={styles.dateColumn}>
              {range.dates.map(date => {
                const day = table.days.get(date)!;
                const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
                const meal = table.mealsByDate.get(date);
                const closed = !meal || Boolean(meal.isCancelled) || meal.status !== 'active';
                const isToday = date === today;
                return (
                  <View
                    key={date}
                    style={[
                      styles.dateCell,
                      (weekday === 0 || weekday === 6) && styles.weekend,
                      isToday && styles.todayDate,
                    ]}
                  >
                    <Text style={[styles.dateText, isToday && styles.todayDateText]} numberOfLines={1}>
                      {weekdays[weekday]} · {date.slice(8)}/{date.slice(5, 7)}
                    </Text>
                    <Text style={[styles.dayTotal, isToday && styles.todayDayTotal]} numberOfLines={1}>
                      {!meal ? 'Chưa có lịch' : closed ? 'Bếp nghỉ' : `${day.total} suất`}
                    </Text>
                  </View>
                );
              })}
            </View>

            <ScrollView
              horizontal
              ref={bodyScroll}
              style={styles.rightPane}
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              onScroll={event => headerScroll.current?.scrollTo({ x: event.nativeEvent.contentOffset.x, animated: false })}
              scrollEventThrottle={16}
            >
              <View>
                {range.dates.map(date => (
                  <View key={date} style={[styles.row, date === today && styles.todayRow]}>
                    {visiblePeople.map(person => cell(person, date))}
                    <View style={[styles.cell, styles.totalCell, { width: colWidth }]}>
                      <Text style={styles.number}>{table.days.get(date)?.guests || 0}</Text>
                    </View>
                    <View style={[styles.cell, styles.totalCell, { width: colWidth }]}>
                      <Text style={styles.number}>{table.days.get(date)?.total || 0}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      ) : viewMode === 'staff' ? (
        /* ==================== VIEW 2: STAFF LIST CARDS ==================== */
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
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
                        const completed = record?.status === 'completed' || date < today || now >= Date.parse(`${date}T${completionTime}:00+07:00`);
                        const editable = !closed && !completed && !saving;
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
        </ScrollView>
      ) : (
        /* ==================== VIEW 3: DAY VIEW ==================== */
        <View style={styles.dayViewWrapper}>
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

            {/* Sub-filter chips for day view */}
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
          <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
            {dayPeople.map(person => {
              const record = table.cells.get(`${selectedDate}:${person.id}`);
              const meal = table.mealsByDate.get(selectedDate);
              const closed = !meal || Boolean(meal.isCancelled) || meal.status !== 'active';
              const eating = !closed && countsAsMeal(record);
              const pending = !closed && record?.status === 'pending';
              const completed = record?.status === 'completed' || selectedDate < today || now >= Date.parse(`${selectedDate}T${completionTime}:00+07:00`);
              const editable = !closed && !completed && !saving;

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
          </ScrollView>
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
          Đơn giá: {pricesReady ? `${formatCurrency(price)}/cán bộ · ${formatCurrency(guestPrice)}/khách` : 'Đang tải đơn giá...'}
        </Text>
      </View>

      {/* Confirm Registration / Cancellation Dialog */}
      <ConfirmDialog
        visible={Boolean(action)}
        loading={saving}
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
  gridQuickActions: {
    flexDirection: 'row',
    gap: 5,
  },
  gridActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  gridActionChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  gridActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  gridActionTextActive: {
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

  // Matrix Table
  table: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0B4939',
  },
  dateHeader: {
    width: DATE_WIDTH,
    backgroundColor: '#0B4939',
    borderRightWidth: 1,
    borderColor: '#407565',
  },
  rightPane: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  nameHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  nameHeaderCompact: {
    height: 48,
  },
  nameHeaderFull: {
    height: 72,
  },
  personHeader: {
    borderRightWidth: 1,
    borderColor: '#407565',
  },
  personName: {
    color: '#FFFFFF',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '700',
  },
  username: {
    color: '#B8DACD',
    fontSize: 9,
    marginTop: 2,
  },
  compactHeaderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  compactBadgeCount: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D5F5DF',
  },
  paymentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  headerSmall: {
    color: '#D5E9E1',
    fontSize: 10,
  },
  summaryLabel: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#407565',
  },
  summaryCell: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderColor: '#407565',
  },
  summaryValue: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  smallMoney: {
    color: '#F8DB91',
    fontSize: 9,
    fontWeight: '700',
  },
  paymentCell: {
    backgroundColor: '#E8F1EC',
  },
  paymentText: {
    fontSize: 9,
    color: '#76613B',
    fontWeight: '700',
  },
  totalHeader: {
    backgroundColor: '#8A671B',
  },
  body: {
    flexDirection: 'row',
  },
  dateColumn: {
    width: DATE_WIDTH,
  },
  dateCell: {
    height: HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F3F7F5',
  },
  dateText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  dayTotal: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1,
  },
  weekend: {
    backgroundColor: '#FFF5F2',
  },
  todayDate: {
    backgroundColor: '#0D5C46',
  },
  todayDateText: {
    color: '#FFFFFF',
  },
  todayDayTotal: {
    color: '#D5F5DF',
  },
  todayRow: {
    backgroundColor: '#EDF8F0',
  },
  cell: {
    height: HEIGHT,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealCell: {
    flexDirection: 'row',
    gap: 2,
  },
  eating: {
    backgroundColor: '#E9F7ED',
  },
  closed: {
    backgroundColor: '#F5F5F5',
  },
  pending: {
    backgroundColor: '#FFF5D8',
  },
  dash: {
    color: '#ACB8B2',
    fontSize: 13,
  },
  guestBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#956608',
  },
  totalCell: {
    backgroundColor: '#FFF6DC',
  },
  number: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },

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
