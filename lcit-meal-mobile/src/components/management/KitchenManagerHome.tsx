import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { ScreenContainer } from '../common/ScreenContainer';
import { Header } from '../common/Header';
import { Card } from '../common/Card';
import { DatePickerModal } from '../common/DatePickerModal';
import { ErrorState, LoadingState } from '../states';
import { useAuth } from '../../providers/AuthProvider';
import { useDashboardHome } from '../../hooks/useDashboardData';
import { useManagementRegistrations } from '../../hooks/useManagementRegistrations';
import { useUsersList } from '../../hooks/useManagementUsers';
import { useFacilities } from '../../hooks/useFacilities';
import { useCancellationDeadline } from '../../hooks/useCancellationDeadline';
import { FacilityFilter, facilityLabel, summarizeFacilityMeals } from '../../utils/facilities';
import { formatDisplayDate, getFullDayOfWeek } from '../../utils/formatters';
import { colors } from '../../theme/colors';

const actions = [
  { title: 'Bảng suất ăn tháng', detail: 'Theo dõi ăn và thanh toán từng cán bộ', icon: 'grid-outline', path: '/management/monthly' },
  { title: 'Danh sách suất ăn', detail: 'Cán bộ và khách theo từng ngày', icon: 'people-outline', path: '/management/registrations' },
  { title: 'Lịch bếp ăn', detail: 'Sắp xếp ngày phục vụ, ngày nghỉ', icon: 'calendar-outline', path: '/management/meals' },
  { title: 'Quản lý thanh toán', detail: 'Theo dõi và đối soát tiền ăn', icon: 'wallet-outline', path: '/management/payments' },
  { title: 'Báo cáo tổng quan', detail: 'Thống kê suất ăn và công nợ', icon: 'bar-chart-outline', path: '/management' },
] as const;

export function KitchenManagerHome() {
  const router = useRouter();
  const { compact } = useResponsiveLayout();
  const { user, role } = useAuth();
  const { today } = useCancellationDeadline();
  const [date, setDate] = useState(today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [facility, setFacility] = useState<Exclude<FacilityFilter, 'all'>>(1);
  const [refreshing, setRefreshing] = useState(false);
  const dashboard = useDashboardHome(date);
  const registrations = useManagementRegistrations({ from: date, to: date });
  const pending = useManagementRegistrations({ status: 'pending' });
  const users = useUsersList();
  const facilities = useFacilities();
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([dashboard.refetch(), registrations.refetch(), pending.refetch(), users.refetch()]);
    } finally { setRefreshing(false); }
  };
  const changeDay = (offset: number) => {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + offset);
    setDate(next.toISOString().slice(0, 10));
  };
  const data = dashboard.data;
  const meal = data?.todayMeal;
  const staff = data?.todayStaff;
  const cancelled = Boolean(meal?.isCancelled ?? meal?.is_cancelled);
  const summary = summarizeFacilityMeals(registrations.data || [], users.data || [], facilities.overrides);
  const group = summary[facility];
  const loading = dashboard.isLoading || (group && (registrations.isLoading || users.isLoading || facilities.isLoading));
  const error = dashboard.error || (group && (registrations.error || users.error));
  const staffCount = cancelled || !meal ? 0 : group?.staff ?? Number(staff?.registeredStaffCount ?? staff?.registered_staff_count ?? 0);
  const guests = cancelled || !meal ? 0 : group?.guests ?? Number(staff?.totalGuestCount ?? staff?.total_guest_count ?? 0);
  const total = cancelled || !meal ? 0 : group?.total ?? Number(staff?.totalMealSlots ?? staff?.total_meal_slots ?? meal.totalMealSlots ?? meal.total_meal_slots ?? staffCount + guests);
  const dayLabel = date === today ? 'Hôm nay' : getFullDayOfWeek(date);

  return (
    <ScreenContainer scrollable refreshing={refreshing} onRefresh={() => { void refresh(); }}>
      <View style={styles.brandRow}>
        <View style={styles.brand}><View style={styles.brandIcon}><Ionicons name="restaurant" size={21} color="white" /></View><Text style={styles.brandText}>LCIT <Text style={styles.brandLight}>MEAL</Text></Text></View>
        <View style={styles.mode}><Text style={styles.modeText}>ĐIỀU HÀNH BẾP</Text></View>
      </View>
      <Header title={`Xin chào, ${user?.fullName?.trim().split(/\s+/).pop() || 'Quản lý'}`} subtitle="Chủ động từng suất ăn, chu toàn mỗi bữa trưa." userRole={role || 'manager'}
        rightAction={<TouchableOpacity accessibilityRole="button" accessibilityLabel="Làm mới dữ liệu bếp" disabled={refreshing} onPress={() => { void refresh(); }} style={styles.refresh}><Ionicons name="refresh-outline" size={22} color={colors.primary} /></TouchableOpacity>} />

      <View style={styles.dateRow}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ngày trước" onPress={() => changeDay(-1)} style={styles.arrow}><Ionicons name="chevron-back" size={22} color={colors.primary} /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Chọn ngày điều hành bếp" onPress={() => setPickerOpen(true)} style={styles.dateSelect}><Text style={styles.dateTitle}>{dayLabel} · {formatDisplayDate(date)}</Text><Ionicons name="calendar-outline" size={18} color={colors.primary} /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ngày tiếp theo" onPress={() => changeDay(1)} style={styles.arrow}><Ionicons name="chevron-forward" size={22} color={colors.primary} /></TouchableOpacity>
      </View>
      {date !== today && <TouchableOpacity accessibilityRole="button" onPress={() => setDate(today)} style={styles.today}><Text style={styles.link}>Về hôm nay</Text></TouchableOpacity>}

      <View style={styles.filters}>{([1, 2, 'unassigned'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: facility === value }} onPress={() => setFacility(value)} style={[styles.filter, facility === value && styles.filterActive]}><Text style={[styles.filterText, facility === value && styles.filterTextActive]}>{facilityLabel(value)}</Text></TouchableOpacity>)}</View>

      {loading ? <LoadingState message="Đang tổng hợp suất ăn..." /> : error ? <ErrorState message={error.message} onRetry={() => { void refresh(); }} /> : <View style={styles.hero}>
        <View style={styles.heroTop}><Text style={styles.eyebrow}>KẾ HOẠCH BỮA TRƯA</Text><Ionicons name="restaurant-outline" size={28} color="#9FD5B7" /></View>
        <Text style={styles.heroLabel}>Suất cần chuẩn bị</Text>
        <Text style={styles.total}>{total.toLocaleString('vi-VN')}<Text style={styles.unit}> suất</Text></Text>
        <Text style={styles.heroDetail}>{facilityLabel(facility)} · {formatDisplayDate(date)}</Text>
        <View style={[styles.breakdown, compact && { flexDirection: 'column', gap: 16 }]}><View style={styles.metric}><Ionicons name="people-outline" size={20} color="#D8EBAF" /><View><Text style={styles.metricLabel}>Cán bộ</Text><Text style={styles.metricValue}>{staffCount}</Text></View></View><View style={[styles.metric, styles.guestMetric, compact && { borderLeftWidth: 0, paddingLeft: 0 }]}><Ionicons name="person-add-outline" size={20} color="#F7D88A" /><View><Text style={styles.metricLabel}>Khách mời</Text><Text style={styles.metricValue}>{guests}</Text></View></View></View>
        <Text style={styles.status}>{cancelled ? 'Bếp nghỉ phục vụ ngày này' : !meal ? 'Chưa có lịch phục vụ ngày này' : 'Số suất theo đăng ký hiện tại'}</Text>
      </View>}

      <Card padding="lg" style={styles.pending} onPress={() => router.push({ pathname: '/management/registrations', params: { status: 'pending', date: 'all', facility: 'all' } })}>
        <View style={styles.pendingIcon}><Ionicons name="time-outline" size={24} color="#A66A16" /></View>
        <View style={styles.pendingCopy}><Text style={styles.pendingTitle}>Yêu cầu chờ duyệt</Text><Text style={styles.detail}>{pending.isError ? 'Chưa tải được · Nhấn để xem danh sách' : pending.isLoading ? 'Đang kiểm tra yêu cầu...' : `${pending.data?.length ?? 0} yêu cầu cắt suất cần xử lý · Tất cả cơ sở`}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>

      <Text style={styles.sectionTitle}>Quản lý bếp ăn</Text>
      <View style={styles.grid}>{actions.map(action => <Card key={action.path} padding="lg" style={[styles.action, compact && { flexBasis: '100%', minWidth: 0 }]} onPress={() => router.push(action.path === '/management/registrations' ? { pathname: action.path, params: { date, facility: String(facility) } } : action.path as Href)}><View style={styles.actionIcon}><Ionicons name={action.icon} size={23} color={colors.primary} /></View><Text style={styles.actionTitle}>{action.title}</Text><Text style={styles.detail}>{action.detail}</Text><Ionicons name="arrow-forward" size={19} color={colors.primary} style={styles.actionArrow} /></Card>)}</View>
      <Text style={styles.footnote}>Kéo xuống để cập nhật dữ liệu bếp ăn.</Text>
      {pickerOpen && <DatePickerModal visible mode="single" initialDate={date} title="Chọn ngày điều hành bếp" onSelectSingle={setDate} onClose={() => setPickerOpen(false)} />}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexWrap: 'wrap', gap: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandIcon: { padding: 7, borderRadius: 10, backgroundColor: colors.primary },
  brandText: { fontSize: 16, fontWeight: '800', color: colors.primaryDark, letterSpacing: 1 }, brandLight: { fontWeight: '400' },
  mode: { backgroundColor: colors.primaryLight, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 }, modeText: { fontSize: 9, fontWeight: '800', color: colors.primary },
  refresh: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface },
  arrow: { padding: 12 }, dateSelect: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48 }, dateTitle: { color: colors.primaryDark, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  today: { alignSelf: 'center', padding: 12 }, link: { color: colors.primary, fontWeight: '600' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 16 }, filter: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, filterActive: { backgroundColor: colors.primary, borderColor: colors.primary }, filterText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' }, filterTextActive: { color: 'white' },
  hero: { backgroundColor: colors.primaryDark, borderRadius: 24, padding: 24 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, eyebrow: { color: '#D8EBAF', letterSpacing: 1.6, fontSize: 10, fontWeight: '800' },
  heroLabel: { color: '#E1F2E8', fontSize: 16, fontWeight: '600' }, total: { color: 'white', fontSize: 60, lineHeight: 76, fontWeight: '800', letterSpacing: -2 }, unit: { fontSize: 18, fontWeight: '500', letterSpacing: 0 }, heroDetail: { color: '#B6D3C5', fontSize: 12 },
  breakdown: { flexDirection: 'row', marginTop: 22, padding: 14, backgroundColor: '#073326', borderRadius: 14 }, metric: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, guestMetric: { borderLeftWidth: 1, borderLeftColor: '#315448', paddingLeft: 16 }, metricLabel: { color: '#BED8CB', fontSize: 11 }, metricValue: { fontSize: 23, fontWeight: '800', color: 'white', marginTop: 3 }, status: { color: '#BED8CB', fontSize: 11, marginTop: 14 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 26, borderColor: '#EADDBF', backgroundColor: '#FFFCF5' }, pendingIcon: { padding: 10, borderRadius: 13, backgroundColor: '#F8ECCE' }, pendingCopy: { flex: 1 }, pendingTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 14 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, action: { flexGrow: 1, flexBasis: '46%', minWidth: 135 }, actionIcon: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, padding: 10, borderRadius: 12, marginBottom: 14 }, actionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 5 }, detail: { fontSize: 12, lineHeight: 18, color: colors.textSecondary }, actionArrow: { marginTop: 16 }, footnote: { textAlign: 'center', color: colors.textMuted, fontSize: 11, marginTop: 22, marginBottom: 10 },
});
