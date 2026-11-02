import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';
/**
 * Management Dashboard Screen
 * T27, T28: Bảng điều khiển quản lý tổng quan, KPI suất ăn & khách, Biểu đồ chu kỳ, Hàng chờ duyệt và Menu phân hệ
 * Có Role Guard: Chỉ Admin và Manager được truy cập (chặn cả direct deep link).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { ManagementMealChart } from '../../src/components/management/ManagementMealChart';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { ForbiddenState } from '../../src/components/states/ForbiddenState';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { useAuth } from '../../src/providers/AuthProvider';
import { useDashboardHome, useDashboardChart } from '../../src/hooks/useDashboardData';
import {
  useManagementRegistrations,
  useManagementMealOptions,
  useApproveMealOption,
  useRejectMealOption,
} from '../../src/hooks/useManagementRegistrations';
import { formatCurrency, formatBusinessDateDisplay } from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { FacilitySelector } from '../../src/components/common/FacilitySelector';
import { useFacilities } from '../../src/hooks/useFacilities';
import { useUsersList } from '../../src/hooks/useManagementUsers';
import { FacilityFilter, facilityLabel, getFacility, matchesFacility, summarizeFacilityMeals } from '../../src/utils/facilities';
import { formatBusinessDate } from '../../src/utils/formatters';
import { pendingCancellationRequests } from '../../src/utils/cancellationRequests';

export default function ManagementDashboardScreen({ isTab = false }: { isTab?: boolean } = {}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { compact } = useResponsiveLayout();
  const wide = width >= 850;
  const { user, role } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [refreshing, setRefreshing] = useState(false);
  const [facilityFilter, setFacilityFilter] = useState<FacilityFilter>(1);
  const { overrides, isLoading: loadingFacilities } = useFacilities();
  const { data: facilityUsers = [], isLoading: loadingUsers, isError: usersError, refetch: refetchUsers } = useUsersList();
  const today = formatBusinessDate(new Date());
  const { data: todayRegistrations = [], isLoading: loadingFacilityMeals, isError: facilityMealsError, refetch: refetchFacilityMeals } =
    useManagementRegistrations({ from: today, to: today });

  // Quick action state
  const [selectedRegId, setSelectedRegId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  const hasAccess = role === 'admin' || role === 'manager';

  const {
    data: homeData,
    isLoading: isLoadingHome,
    refetch: refetchHome,
  } = useDashboardHome();

  const {
    data: chartData,
    isLoading: isLoadingChart,
    refetch: refetchChart,
  } = useDashboardChart(selectedPeriod);

  const { data: pendingOptions = [], refetch: refetchRegs } = useManagementMealOptions({
    status: 'pending',
  });

  const pendingRegs = pendingCancellationRequests(pendingOptions);
  const approveMutation = useApproveMealOption();
  const rejectMutation = useRejectMealOption();

  if (!hasAccess) {
    return (
      <ScreenContainer scrollable={false}>
        <Header title="Khu vực Quản lý" showBack onBack={() => router.replace('/(tabs)')} />
        <ForbiddenState
          title="Không có quyền Quản lý"
          message={`Tài khoản hiện tại (${user?.fullName || 'Người dùng'} - vai trò ${role || 'chưa cấp'}) không có quyền truy cập vào trung tâm Quản trị.`}
          onGoBack={() => router.replace('/(tabs)')}
        />
      </ScreenContainer>
    );
  }

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([refetchHome(), refetchChart(), refetchRegs(), refetchUsers(), refetchFacilityMeals()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedRegId || !actionType) return;
    if (actionType === 'approve') {
      await approveMutation.mutateAsync(selectedRegId);
    } else {
      await rejectMutation.mutateAsync(selectedRegId);
    }
    setSelectedRegId(null);
    setActionType(null);
    refetchHome();
    refetchRegs();
  };

  const facilitySummary = summarizeFacilityMeals(todayRegistrations, facilityUsers, overrides);
  const selectedSummary = facilityFilter === 'all' ? null : facilitySummary[facilityFilter];
  const facilityReady = !loadingFacilityMeals && !loadingFacilities && !facilityMealsError && !loadingUsers && !usersError;
  const cancelled = Boolean(homeData?.todayMeal?.isCancelled ?? homeData?.todayMeal?.is_cancelled);
  const todaySlots = selectedSummary ? (facilityReady ? (cancelled ? 0 : selectedSummary.total) : '—') : homeData?.todayStaff?.total_meal_slots ?? homeData?.todayMeal?.total_meal_slots ?? 0;
  const todayStaffCount = selectedSummary ? (facilityReady ? (cancelled ? 0 : selectedSummary.staff) : '—') : homeData?.todayStaff?.registered_staff_count ?? 0;
  const todayGuestCount = selectedSummary ? (facilityReady ? (cancelled ? 0 : selectedSummary.guests) : '—') : homeData?.todayStaff?.total_guest_count ?? 0;
  const scopedPending = pendingRegs.filter(record => matchesFacility(getFacility(facilityUsers.find(user => user.id === record.userId) || { id: record.userId, fullName: record.userName || record.user?.fullName }, overrides), facilityFilter));
  const pendingCount = facilityFilter === 'all' ? pendingRegs.length : scopedPending.length;
  const outstandingAmount = homeData?.outstanding?.total_outstanding_amount ?? 0;
  const unpaidRecords = homeData?.outstanding?.unpaid_record_count ?? 0;

  // Chart data calculation
  const points = chartData?.data || homeData?.weeklyChart || [];

  return (
    <ScreenContainer scrollable={false} backgroundColor={colors.background}>
      <Header
        title="Tổng quan quản lý"
        subtitle={`Hôm nay · ${formatBusinessDateDisplay(today)}`}
        showBack={isTab ? false : router.canGoBack()}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        style={{ alignItems: 'flex-start' }}
        rightAction={
          <View style={styles.headerActions}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <TouchableOpacity
                style={styles.refreshHeaderBtn}
                onPress={handleRefresh}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Làm mới dữ liệu"
                accessibilityState={{ busy: refreshing, disabled: refreshing }}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                ) : (
                  <Ionicons name="refresh" size={20} color={colors.primaryDark} />
                )}
              </TouchableOpacity>
              {!isTab && (
                <TouchableOpacity
                  style={styles.accountHeaderBtn}
                  onPress={() => router.push('/(tabs)/account')}
                  activeOpacity={0.7}
                  accessibilityLabel="Tài khoản cá nhân"
                >
                  <Ionicons name="person-circle-outline" size={24} color={colors.primaryDark} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, isTab && { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isLoadingHome}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {/* KPI Cards Overview */}
        {facilityMealsError && <Text style={styles.sectionSubtitle}>Chưa tải được số suất từng cơ sở. Nhấn làm mới để thử lại.</Text>}
          {/* Card 1: Hôm nay */}
          <Card variant="elevated" padding="md" style={styles.kpiCardLarge}>
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel}>Suất cần nấu hôm nay</Text>
              <Badge label={facilityLabel(facilityFilter)} variant="success" size="sm" />
            </View>
            <Text style={styles.kpiBigNumber}>{todaySlots}<Text style={styles.kpiUnit}> suất</Text></Text>
            <View style={styles.kpiSubRow}>
              <Text style={styles.kpiSubText}>
                • Cán bộ: <Text style={styles.boldText}>{todayStaffCount}</Text>
              </Text>
              <Text style={styles.kpiSubText}>
                • Khách: <Text style={[styles.boldText, { color: colors.warning }]}>{todayGuestCount}</Text>
              </Text>
            </View>
          </Card>

        <View style={styles.filterBar}>
          <FacilitySelector value={facilityFilter} onChange={setFacilityFilter}
            style={{ flex: 1, maxWidth: 280, marginVertical: 0 }} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quản lý cán bộ và cơ sở" onPress={() => router.push('/management/users')} style={styles.facilityLink}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <Text style={styles.viewAllText}>Cán bộ</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.kpiContainer}>
          {/* Card 2 & 3: Pending & Outstanding - Hiển thị thành 1 dòng (2 cột) */}
          <View style={[styles.kpiRowSmall, wide && { flex: 1.2 }]}>
            <Card
              variant="elevated"
              padding="md"
              style={styles.kpiCardSmall}
              onPress={() => router.push('/management/registrations' as any)}
            >
              <View style={[styles.kpiIconSmall, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={16} color="#B45309" />
              </View>
              <Text style={[styles.kpiNumberSmall, { color: '#B45309' }]}>{pendingCount}</Text>
              <Text style={styles.kpiSmallLabel}>Chờ duyệt cắt</Text>
            </Card>

            <Card
              variant="elevated"
              padding="md"
              style={styles.kpiCardSmall}
              onPress={() => router.push('/management/payments' as any)}
            >
              <View style={[styles.kpiIconSmall, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
              </View>
              <Text style={[styles.kpiNumberSmall, { color: '#DC2626', fontSize: wide ? 26 : 18 }]} numberOfLines={1}>
                {formatCurrency(outstandingAmount)}
              </Text>
              <Text style={styles.kpiSmallLabel} numberOfLines={2}>{unpaidRecords} khoản chưa thu · Toàn cơ quan</Text>
            </Card>
          </View>
        </View>

        <Button title="Bảng theo dõi suất ăn tháng" variant="outline"
          leftIcon={<Ionicons name="grid-outline" size={20} color={colors.primary} />}
          onPress={() => router.push('/management/monthly' as any)} style={{ marginBottom: 16 }} />

        {/* Biểu đồ số lượng suất ăn & Cán bộ */}
        <ManagementMealChart
          points={points}
          isLoading={isLoadingChart}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />

        {/* Hàng chờ duyệt nhanh (Pending queue) */}
        {scopedPending.length > 0 && (
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.rowAlign}>
                <Text style={styles.sectionTitle}>Hàng chờ duyệt cắt suất</Text>
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeCountText}>{scopedPending.length}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/management/registrations' as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>

            {scopedPending.slice(0, 3).map((item) => (
              <Card key={item.id} variant="elevated" padding="md" style={styles.pendingCard}>
                <View style={styles.pendingCardHeader}>
                  <View style={styles.pendingAvatarBox}>
                    <Ionicons name="person" size={16} color={colors.primaryDark} />
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingName}>{facilityUsers.find(user => user.id === item.userId)?.fullName || item.userName || item.user?.fullName || 'Cán bộ'}</Text>
                    <Text style={styles.pendingDate}>
                      {formatBusinessDateDisplay(item.fromDate)} – {item.type === 'cancel_permanent' ? 'Dài hạn' : formatBusinessDateDisplay(item.toDate)}
                    </Text>
                  </View>
                  <Badge label="Chờ duyệt" variant="warning" size="sm" />
                </View>

                <View style={styles.pendingActions}>
                  <Button
                    title="Từ chối"
                    variant="outline"
                    size="sm"
                    style={styles.actionBtnSmall}
                    onPress={() => {
                      setSelectedRegId(item.id);
                      setActionType('reject');
                    }}
                  />
                  <Button
                    title="Duyệt cắt"
                    variant="primary"
                    size="sm"
                    style={styles.actionBtnSmall}
                    onPress={() => {
                      setSelectedRegId(item.id);
                      setActionType('approve');
                    }}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Menu Phân hệ Quản lý & Nghiệp vụ */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>Không gian quản trị</Text>
          <Text style={styles.sectionSubtitle}>Truy cập nhanh các công việc thường ngày</Text>

          <View style={styles.gridMenu}>
            {/* Phân hệ 1: Lịch bếp & Ngày nghỉ */}
            <Card
              variant="elevated"
              padding="md"
              style={[styles.menuGridItem, compact && { width: '100%' }, wide && { width: '24%' }]}
              onPress={() => router.push('/management/meals' as any)}
            >
              <View style={[styles.menuGridIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="restaurant-outline" size={24} color={colors.primaryDark} />
              </View>
              <Text style={styles.menuGridTitle}>Lịch bếp & Nghỉ lễ</Text>
              <Text style={styles.menuGridDesc}>Tạo, sửa lịch nấu, báo hủy và sự kiện nghỉ</Text>
            </Card>

            {/* Phân hệ 2: Danh sách đăng ký & Duyệt cắt */}
            <Card
              variant="elevated"
              padding="md"
              style={[styles.menuGridItem, compact && { width: '100%' }, wide && { width: '24%' }]}
              onPress={() => router.push('/management/registrations' as any)}
            >
              <View style={[styles.menuGridIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="checkbox-outline" size={24} color="#B45309" />
              </View>
              <Text style={styles.menuGridTitle}>Duyệt cắt suất</Text>
              <Text style={styles.menuGridDesc}>Duyệt hoặc từ chối yêu cầu cắt suất</Text>
            </Card>

            {/* Phân hệ 3: Thu tiền ăn */}
            <Card
              variant="elevated"
              padding="md"
              style={[styles.menuGridItem, compact && { width: '100%' }, wide && { width: '24%' }]}
              onPress={() => router.push('/management/payments' as any)}
            >
              <View style={[styles.menuGridIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="wallet-outline" size={24} color="#15803D" />
              </View>
              <Text style={styles.menuGridTitle}>Quản lý Thu tiền</Text>
              <Text style={styles.menuGridDesc}>Lập hóa đơn, xác nhận đã đóng & xuất báo cáo</Text>
            </Card>

            {/* Phân hệ 4: Người dùng (Admin / Manager) */}
            <Card
              variant="elevated"
              padding="md"
              style={[styles.menuGridItem, compact && { width: '100%' }, wide && { width: '24%' }]}
              onPress={() => router.push('/management/users' as any)}
            >
              <View style={[styles.menuGridIcon, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="people-outline" size={24} color="#7E22CE" />
              </View>
              <Text style={styles.menuGridTitle}>Người dùng & Vai trò</Text>
              <Text style={styles.menuGridDesc}>
                {role === 'admin' ? 'Tạo tài khoản, phân quyền role' : 'Danh sách cán bộ cơ quan'}
              </Text>
            </Card>

            {/* Phân hệ 5: Phát thông báo */}
            <Card
              variant="elevated"
              padding="md"
              style={[styles.menuGridItem, compact && { width: '100%' }, wide && { width: '24%' }]}
              onPress={() => router.push('/management/notifications' as any)}
            >
              <View style={[styles.menuGridIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="megaphone-outline" size={24} color="#0369A1" />
              </View>
              <Text style={styles.menuGridTitle}>Soạn & Phát thông báo</Text>
              <Text style={styles.menuGridDesc}>Gửi broadcast hoặc chọn cán bộ nhận</Text>
            </Card>

            {/* Phân hệ 6: Cấu hình hệ thống (Admin only) */}
            {role === 'admin' && (
              <Card
                variant="elevated"
                padding="md"
                style={[styles.menuGridItem, compact && { width: '100%' }, wide && { width: '24%' }]}
                onPress={() => router.push('/management/settings' as any)}
              >
                <View style={[styles.menuGridIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Ionicons name="settings-outline" size={24} color="#BE185D" />
                </View>
                <Text style={styles.menuGridTitle}>Cấu hình hệ thống</Text>
                <Text style={styles.menuGridDesc}>Lịch thứ, giờ đóng, giá tiền & QR</Text>
              </Card>
            )}

            {/* Phân hệ 7: Audit Logs (Admin only) */}
            {role === 'admin' && (
              <Card
                variant="elevated"
                padding="md"
                style={[styles.menuGridItem, compact && { width: '100%' }, wide && { width: '24%' }]}
                onPress={() => router.push('/management/audit' as any)}
              >
                <View style={[styles.menuGridIcon, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="document-text-outline" size={24} color="#475569" />
                </View>
                <Text style={styles.menuGridTitle}>Nhật ký hệ thống</Text>
                <Text style={styles.menuGridDesc}>Vết thao tác, an toàn và bảo mật</Text>
              </Card>
            )}

            {/* Phân hệ 8: Công cụ Admin (Admin/Manager) */}
            <Card
              variant="elevated"
              padding="md"
              style={[styles.menuGridItem, compact && { width: '100%' }, wide && { width: '24%' }]}
              onPress={() => router.push('/management/admin-tools' as any)}
            >
              <View style={[styles.menuGridIcon, { backgroundColor: '#FEF9C3' }]}>
                <Ionicons name="construct-outline" size={24} color="#A16207" />
              </View>
              <Text style={styles.menuGridTitle}>Công cụ quản trị</Text>
              <Text style={styles.menuGridDesc}>Chạy sinh lịch tự động & chốt hoàn thành</Text>
            </Card>
          </View>
        </View>
      </ScrollView>

      {/* Confirm Dialog for Quick Action */}
      <ConfirmDialog
        visible={selectedRegId !== null}
        title={actionType === 'approve' ? 'Xác nhận duyệt cắt suất' : 'Từ chối yêu cầu cắt suất'}
        message={
          actionType === 'approve'
            ? 'Bạn có chắc chắn muốn duyệt cắt suất trong khoảng ngày đã yêu cầu?'
            : 'Bạn có chắc chắn muốn từ chối yêu cầu và giữ lại suất ăn?'
        }
        confirmText={actionType === 'approve' ? 'Duyệt cắt' : 'Từ chối'}
        cancelText="Hủy bỏ"
        variant={actionType === 'approve' ? 'primary' : 'danger'}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setSelectedRegId(null);
          setActionType(null);
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  headingCopy: { flex: 1, minWidth: 0 },
  filterBar: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 12 },
  facilityLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 2,
    paddingBottom: spacing['3xl'],
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  refreshHeaderBtn: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  accountHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiContainer: {
    marginBottom: 16,
    gap: 12,
  },
  kpiCardLarge: {
    padding: 18,
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryDark,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  kpiUnit: { fontSize: 18, fontWeight: '500', color: '#D5E4D8' },
  kpiBigNumber: {
    fontSize: 52,
    fontWeight: typography.weights.extrabold,
    color: '#FFFFFF',
    marginTop: spacing.xs,
  },
  kpiLabel: {
    fontSize: typography.sizes.sm,
    color: '#D5E4D8',
    marginBottom: spacing.xs,
  },
  kpiSubRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#356454',
    flexWrap: 'wrap',
  },
  kpiSubText: {
    fontSize: typography.sizes.xs,
    color: '#D5E4D8',
  },
  boldText: {
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  kpiRowSmall: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kpiCardSmall: {
    flex: 1,
    minWidth: 0,
    minHeight: 110,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  kpiIconSmall: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  kpiNumberSmall: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
  },
  kpiSmallLabel: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionWrapper: {
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: 12,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeCount: {
    backgroundColor: colors.status.pending.bg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  badgeCountText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.status.pending.text,
  },
  viewAllText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  pendingCard: {
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  pendingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pendingAvatarBox: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  pendingDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pendingActions: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  actionBtnSmall: {
    minWidth: 80,
    minHeight: 44,
  },
  gridMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 16,
  },
  menuGridItem: {
    width: '47%',
    flexGrow: 1,
    minHeight: 176,
    padding: 18,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  menuGridIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  menuGridTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  menuGridDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
});
