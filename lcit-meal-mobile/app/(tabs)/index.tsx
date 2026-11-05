/**
 * Tab Screen - Trang chủ (Home)
 * Màn hình tổng quan: Suất ăn hôm nay, giờ đóng, thao tác nhanh và khoản thanh toán cá nhân.
 * Tuân thủ GAP-01: Chỉ hiển thị dữ liệu cá nhân, không hiển thị dữ liệu tài chính toàn cơ quan.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Button } from '../../src/components/common/Button';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { MealCard } from '../../src/components/meals/MealCard';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  useMeals,
  useMyRegistrations,
  useRegisterMealMutation,
  useCancelRegistrationMutation,
} from '../../src/hooks/useMealsData';
import { useMyPaymentSummary } from '../../src/hooks/usePaymentsData';
import {
  formatCurrency,
  formatDisplayDate,
} from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { KitchenHome } from '../../src/components/meals/KitchenHome';
import { KitchenManagerHome } from '../../src/components/management/KitchenManagerHome';
import ManagementDashboardScreen from '../management/index';
import { useCancellationDeadline } from '../../src/hooks/useCancellationDeadline';
import { isCancellationClosed } from '../../src/utils/cancellationDeadline';

export default function HomeScreen() {
  const { role } = useAuth();

  if (role === 'admin') {
    return <ManagementDashboardScreen isTab />;
  }

  if (role === 'manager') return <KitchenManagerHome />;

  return role === 'kitchen' ? <KitchenHome /> : <PersonalHomeScreen />;
}

function PersonalHomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const { user, role, useMockData } = useAuth();

  const [cancelModalVisible, setCancelModalVisible] = useState(false);

  const { today: todayStr, now } = useCancellationDeadline();
  const cancelClosed = isCancellationClosed(todayStr, now);

  // Queries từ TanStack React Query
  const { data: meals = [], isLoading: loadingMeals, isError: mealsError, refetch: refetchMeals } = useMeals();
  const { data: registrations = [], isLoading: loadingRegs, isError: regsError, refetch: refetchRegs } = useMyRegistrations();
  const { data: paymentSummary, isLoading: loadingPayments, isError: paymentsError, refetch: refetchPayments } = useMyPaymentSummary();

  // Mutations
  const registerMutation = useRegisterMealMutation();
  const cancelMutation = useCancelRegistrationMutation();

  const isRefreshing = loadingMeals || loadingRegs || loadingPayments;

  const todayMeal = meals.find((m) => m.mealDate === todayStr);
  const todayReg = todayMeal
    ? registrations.find((r) => r.mealId === todayMeal.id || r.mealDate === todayStr)
    : undefined;

  const handleRefresh = async () => {
    await Promise.all([refetchMeals(), refetchRegs(), refetchPayments()]);
  };

  const handleRegisterToday = async (mealId: number) => {
    try {
      await registerMutation.mutateAsync({ mealId, guestCount: 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng ký suất ăn thất bại.';
      Alert.alert('Thông báo', msg);
    }
  };

  const handleCancelToday = async () => {
    if (!todayReg) return;
    try {
      const updatedReg = await cancelMutation.mutateAsync({
        registrationId: todayReg.id,
      });
      setCancelModalVisible(false);

      if (updatedReg && updatedReg.status === 'pending') {
        Alert.alert(
          'Đã gửi yêu cầu',
          'Yêu cầu cắt suất đang chờ Quản lý xét duyệt.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cắt suất ăn thất bại.';
      Alert.alert('Lỗi thao tác', msg);
    }
  };

  const totalUnpaidAmount = paymentSummary?.totalUnpaidAmount || 0;
  const unpaidCount = paymentSummary?.unpaidCount || 0;

  return (
    <ScreenContainer
      scrollable
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      backgroundColor={colors.background}
    >
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}><Ionicons name="restaurant" size={18} color={colors.textInverse} /></View>
        <Text style={styles.brand}>LCIT <Text style={styles.brandLight}>MEAL</Text></Text>
        <View style={styles.datePill}><Ionicons name="calendar-outline" size={14} color={colors.primary} /><Text style={styles.brandCaption}>{formatDisplayDate(todayStr)}</Text></View>
      </View>
      <Header
        title={`Xin chào, ${user?.fullName?.split(' ').slice(-1)[0] || 'Bạn'}`}
        subtitle="Bữa trưa của bạn, mọi thứ trong tầm tay."
        userRole={role || 'employee'} isMockMode={useMockData}
        rightAction={<TouchableOpacity accessibilityRole="button" accessibilityLabel="Thông báo" onPress={() => router.push('/(tabs)/notifications')} style={styles.notifBtn}><Ionicons name="notifications-outline" size={22} color={colors.text} /></TouchableOpacity>}
      />
      <View style={styles.hero}>
        <Image
          source={require('../../assets/images/shared-lunch.jpg')}
          style={styles.heroImage}
          resizeMode="contain"
          accessible
          accessibilityLabel="Mâm cơm nhiều món dành cho 5 đến 6 người"
        />
      </View>
      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={styles.mainColumn}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Suất ăn hôm nay</Text><TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(tabs)/schedule')} style={styles.textLink}><Text style={styles.link}>Xem lịch ăn →</Text></TouchableOpacity></View>
          {loadingMeals || loadingRegs ? <Card padding="2xl" style={styles.empty}><ActivityIndicator color={colors.primary} /><Text style={styles.body}>Đang tải suất ăn của bạn…</Text></Card>
            : mealsError || regsError ? <Card padding="xl" style={styles.empty}><Ionicons name="cloud-offline-outline" size={30} color={colors.textSecondary} /><Text style={styles.actionTitle}>Chưa tải được suất ăn</Text><Button title="Thử lại" variant="outline" onPress={handleRefresh} /></Card>
              : todayMeal ? <MealCard dateStr={todayStr} meal={todayMeal} registration={todayReg}
                onPress={() => router.push(`/meal/${todayMeal.id}` as any)} onRegister={handleRegisterToday}
                onCancel={() => setCancelModalVisible(true)}
                registering={registerMutation.isPending}
                actionsDisabled={registerMutation.isPending || cancelMutation.isPending}
                style={styles.todayCard}
              /> : <Card padding="2xl" style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="cafe-outline" size={32} color={colors.primary} /></View><Text style={styles.actionTitle}>Hôm nay chưa có lịch ăn</Text><Text style={styles.emptyText}>Xem lịch ăn để chủ động sắp xếp những bữa trưa tiếp theo.</Text><Button title="Xem lịch ăn" variant="outline" onPress={() => router.push('/(tabs)/schedule')} /></Card>}
          <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 16 }]}>Thao tác nhanh</Text>
          <View style={styles.quickGrid}>
            <Card onPress={() => router.push('/(tabs)/schedule')} style={styles.quickCard} padding="lg">
              <View style={styles.actionIcon}>
                <Ionicons name="calendar-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.actionTitle}>Lịch ăn</Text>
              <Text style={styles.body}>Chủ động sắp xếp bữa trưa</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primary} style={{ marginTop: 12 }} />
            </Card>
            <Card onPress={() => router.push('/meal-options' as any)} style={styles.quickCard} padding="lg">
              <View style={[styles.actionIcon, { backgroundColor: '#F4EBD8' }]}>
                <Ionicons name="receipt-outline" size={22} color="#8A672C" />
              </View>
              <Text style={styles.actionTitle}>Báo cắt suất</Text>
              <Text style={styles.body}>Điều chỉnh những ngày vắng</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primary} style={{ marginTop: 12 }} />
            </Card>
          </View>
        </View>
        <View style={[styles.sideColumn, wide && { width: 320 }]}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Thanh toán</Text></View>
          <Card padding="2xl" style={styles.paymentCard}>
            <View style={styles.paymentTop}><Text style={styles.paymentLabel}>CHƯA THANH TOÁN</Text><Ionicons name="wallet-outline" size={22} color={colors.primary} /></View>
            {loadingPayments ? <View style={styles.paymentLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.body}>Đang tải thanh toán…</Text></View>
              : paymentsError ? <Text style={styles.paymentError}>Chưa tải được số dư. Mở thanh toán để kiểm tra lại.</Text>
                : <><Text style={styles.paymentAmount}>{formatCurrency(totalUnpaidAmount)}</Text>
                  <View style={[styles.paymentStatus, unpaidCount > 0 && styles.paymentStatusUnpaid]}><Ionicons name={unpaidCount > 0 ? 'time-outline' : 'checkmark-circle-outline'} size={16} color={unpaidCount > 0 ? '#9A3412' : colors.primary} /><Text style={[styles.statusText, unpaidCount > 0 && styles.statusTextUnpaid]}>{unpaidCount > 0 ? `${unpaidCount} tháng còn nợ · Thu cuối tháng` : 'Chưa có tiền ăn còn nợ'}</Text></View>
                </>}
            <View style={styles.divider} />
            <Button title="Xem thanh toán" onPress={() => router.push('/(tabs)/payments')} fullWidth rightIcon={<Ionicons name="arrow-forward" size={18} color="white" />} />
          </Card>
          <View style={styles.reminder}><Ionicons name="information-circle-outline" size={22} color={colors.primary} /><View style={styles.reminderCopy}><Text style={styles.actionTitle}>Có kế hoạch nghỉ?</Text><Text style={styles.body}>Báo cắt suất trước 08:00 để nhà bếp chuẩn bị đúng số lượng nhé.</Text></View></View>
          {(role === 'admin' || role === 'manager') && <Card onPress={() => router.push('/management')} padding="xl" style={styles.managementCard}><Ionicons name="grid-outline" size={24} color={colors.primary} /><Text style={styles.actionTitle}>Trung tâm quản lý</Text><Text style={styles.body}>Suất ăn, lịch bếp và thu tiền toàn đơn vị →</Text></Card>}
        </View>
      </View>
      {/* Modal xác nhận Cắt suất */}
      <ConfirmDialog
        visible={cancelModalVisible}
        title="Xác nhận cắt suất ăn hôm nay"
        message={`Bạn có chắc chắn muốn cắt suất ăn ngày ${formatDisplayDate(todayStr)}? Thao tác này sẽ cập nhật số lượng suất ăn cần nấu của nhà bếp.`}
        confirmText={cancelClosed ? 'Quá hạn cắt suất' : 'Đồng ý cắt suất'}
        confirmDisabled={cancelClosed}
        cancelText="Giữ lại"
        isDestructive
        iconName="close-circle-outline"
        loading={cancelMutation.isPending}
        onConfirm={handleCancelToday}
        onCancel={() => setCancelModalVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  datePill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: radius.full, backgroundColor: colors.primary50 },
  todayCard: { padding: 20, marginBottom: 0, borderRadius: 20 },
  quickGridCompact: { flexDirection: 'column' },
  paymentLoading: { paddingVertical: 24, gap: 12, alignItems: 'center' },
  paymentError: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 20 },
  paymentStatus: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: colors.primaryLight, borderRadius: 10, padding: 8, marginTop: 8 },
  paymentStatusUnpaid: { backgroundColor: '#FFF1E6' },
  statusText: { flexShrink: 1, fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.primary },
  statusTextUnpaid: { color: '#9A3412' },
  reminder: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: colors.primary50, borderRadius: 16 },
  reminderCopy: { flex: 1, minWidth: 0 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  brandRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingBottom: 18, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 16, fontWeight: '800', letterSpacing: 1.2, color: colors.primaryDark },
  brandLight: { fontWeight: '400', color: colors.primary },
  brandCaption: { fontSize: 12, fontWeight: '600', color: colors.primary },
  notifBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    width: '100%',
    aspectRatio: 2,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: colors.primaryLight,
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  columns: { gap: 28 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 1, minWidth: 0 },
  sideColumn: { gap: 16 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  textLink: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 13, fontWeight: '600', color: colors.primary },
  quickGrid: { flexDirection: 'row', gap: 12 },
  quickCard: { flex: 1, minWidth: 0, borderRadius: 18, backgroundColor: colors.surface, borderColor: colors.border },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  body: { fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  paymentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
  },
  paymentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paymentLabel: { flex: 1, fontSize: 10, lineHeight: 16, letterSpacing: 1, fontWeight: '700', color: colors.textSecondary },
  paymentAmount: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, color: colors.primaryDark, marginTop: 14, marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#DFE8E1', marginVertical: 16 },
  managementCard: {
    gap: 8,
    borderColor: colors.primary300,
    backgroundColor: colors.primary50,
    borderRadius: radius.xl,
  },
  empty: { gap: 12, alignItems: 'center', backgroundColor: colors.surface },
});
