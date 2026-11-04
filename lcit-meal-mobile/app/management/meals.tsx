import { ModalCard } from '../../src/components/common/ModalCard';
import { ModalBackdrop } from '../../src/components/common/ModalBackdrop';
/**
 * Quản lý Lịch Bếp & Ngày Nghỉ Lễ (Admin & Manager)
 * T29: Danh sách, tạo/sửa lịch ăn, chi tiết tổng suất, hủy/mở bếp (dialog cảnh báo tác động) và quản lý nghỉ lễ.
 * TỐI ƯU HÓA: FlatList virtualization mượt mà & DatePickerInput chọn ngày trực quan.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { Input } from '../../src/components/common/Input';
import { DatePickerInput } from '../../src/components/common/DatePickerInput';
import { DatePickerModal } from '../../src/components/common/DatePickerModal';
import { useCancellationDeadline } from '../../src/hooks/useCancellationDeadline';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { ForbiddenState } from '../../src/components/states/ForbiddenState';
import { EmptyState } from '../../src/components/states/EmptyState';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  useManagementMeals,
  useMealSummary,
  useCreateMeal,
  useUpdateMeal,
  useCancelMeal,
  useRestoreMeal,
  useHolidayEvents,
  useCreateHoliday,
  useRestoreHoliday,
} from '../../src/hooks/useManagementMeals';
import { formatBusinessDate, formatBusinessDateDisplay } from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { Meal, HolidayEvent } from '../../src/types';

export default function ManagementMealsScreen() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'meals' | 'holidays'>('meals');
  const { today } = useCancellationDeadline();
  const [selectedDate, setSelectedDate] = useState(today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const previousToday = useRef(today);
  useEffect(() => {
    const previous = previousToday.current;
    previousToday.current = today;
    setSelectedDate(date => date === previous ? today : date);
  }, [today]);
  const changeDay = (offset: number) => {
    setSelectedDate(date => {
      const next = new Date(`${date}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + offset);
      return next.toISOString().slice(0, 10);
    });
  };
  const [refreshing, setRefreshing] = useState(false);

  // Meal Modals state
  const [summaryMealId, setSummaryMealId] = useState<number | null>(null);
  const [isCreateMealOpen, setIsCreateMealOpen] = useState(false);
  const [isEditMealOpen, setIsEditMealOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

  // Form states
  const [mealDateInput, setMealDateInput] = useState('');
  const [mealNoteInput, setMealNoteInput] = useState('');
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelTargetMeal, setCancelTargetMeal] = useState<Meal | null>(null);
  const [restoreTargetMeal, setRestoreTargetMeal] = useState<Meal | null>(null);

  // Holiday Modals state
  const [isCreateHolidayOpen, setIsCreateHolidayOpen] = useState(false);
  const [holidayNameInput, setHolidayNameInput] = useState('');
  const [holidayFromInput, setHolidayFromInput] = useState('');
  const [holidayToInput, setHolidayToInput] = useState('');
  const [holidayReasonInput, setHolidayReasonInput] = useState('');

  const hasAccess = role === 'admin' || role === 'manager';

  const { data: meals = [], isLoading: isLoadingMeals, refetch: refetchMeals } = useManagementMeals();
  const selectedMeals = meals.filter(meal => formatBusinessDate(meal.mealDate) === selectedDate);
  const { data: holidays = [], isLoading: isLoadingHolidays, refetch: refetchHolidays } = useHolidayEvents();
  const { data: mealSummary, isLoading: isLoadingSummary } = useMealSummary(summaryMealId || 0);

  const createMealMutation = useCreateMeal();
  const updateMealMutation = useUpdateMeal();
  const cancelMealMutation = useCancelMeal();
  const restoreMealMutation = useRestoreMeal();
  const createHolidayMutation = useCreateHoliday();
  const restoreHolidayMutation = useRestoreHoliday();
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchMeals(), refetchHolidays()]);
    setRefreshing(false);
  };

  const handleCreateMeal = async () => {
    if (!mealDateInput.trim()) return;
    await createMealMutation.mutateAsync({
      mealDate: mealDateInput.trim(),
      note: mealNoteInput.trim() || undefined,
    });
    setSelectedDate(mealDateInput.trim());
    setIsCreateMealOpen(false);
    setMealDateInput('');
    setMealNoteInput('');
  };

  const handleUpdateMeal = async () => {
    if (!selectedMeal) return;
    await updateMealMutation.mutateAsync({
      id: selectedMeal.id,
      data: {
        note: mealNoteInput.trim() || undefined,
      },
    });
    setIsEditMealOpen(false);
    setSelectedMeal(null);
    setMealNoteInput('');
  };

  const handleCancelMeal = async () => {
    if (!cancelTargetMeal) return;
    await cancelMealMutation.mutateAsync({
      id: cancelTargetMeal.id,
      reason: cancelReasonInput.trim() || undefined,
    });
    setCancelTargetMeal(null);
    setCancelReasonInput('');
  };

  const handleRestoreMeal = async () => {
    if (!restoreTargetMeal) return;
    await restoreMealMutation.mutateAsync(restoreTargetMeal.id);
    setRestoreTargetMeal(null);
  };

  const handleCreateHoliday = async () => {
    if (!holidayNameInput.trim() || !holidayFromInput.trim() || !holidayToInput.trim()) return;
    await createHolidayMutation.mutateAsync({
      name: holidayNameInput.trim(),
      fromDate: holidayFromInput.trim(),
      toDate: holidayToInput.trim(),
      reason: holidayReasonInput.trim() || undefined,
    });
    setIsCreateHolidayOpen(false);
    setHolidayNameInput('');
    setHolidayFromInput('');
    setHolidayToInput('');
    setHolidayReasonInput('');
  };

  const renderMealItem = useCallback(({ item: meal }: { item: Meal }) => {
    const isCancelled = Boolean(meal.isCancelled) || meal.status === 'cancelled';
    return (
      <Card key={meal.id} variant="elevated" padding="md" style={styles.mealCard}>
        <View style={styles.mealHeader}>
          <View style={styles.dateCol}>
            <Text style={styles.mealDateText}>
              {formatBusinessDateDisplay(meal.mealDate)}
            </Text>
            <Text style={styles.mealDateRaw}>{meal.mealDate}</Text>
          </View>
          <Badge
            label={isCancelled ? 'Đã hủy bếp' : 'Hoạt động'}
            variant={isCancelled ? 'cancelled' : 'confirmed'}
            size="sm"
          />
        </View>

        <Text style={styles.mealNote}>
          {meal.note || 'Thực đơn chuẩn theo thực đơn tháng của nhà bếp.'}
        </Text>

        <View style={styles.mealFooter}>
          {/* Xem Summary */}
          <TouchableOpacity
            style={styles.summaryBtn}
            onPress={() => setSummaryMealId(meal.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="pie-chart-outline" size={14} color={colors.primary} />
            <Text style={styles.summaryBtnText}>Xem tổng suất</Text>
          </TouchableOpacity>

          {/* Actions */}
          <View style={styles.mealActions}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => {
                setSelectedMeal(meal);
                setMealNoteInput(meal.note || '');
                setIsEditMealOpen(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {isCancelled ? (
              <TouchableOpacity
                style={[styles.actionIconBtn, { backgroundColor: '#DCFCE7' }]}
                onPress={() => setRestoreTargetMeal(meal)}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={18} color="#15803D" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionIconBtn, { backgroundColor: '#FEE2E2' }]}
                onPress={() => {
                  setCancelTargetMeal(meal);
                  setCancelReasonInput('');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="ban-outline" size={18} color="#DC2626" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    );
  }, []);

  const renderHolidayItem = useCallback(
    ({ item: h }: { item: HolidayEvent }) => (
      <Card key={h.id} variant="elevated" padding="md" style={styles.mealCard}>
        <View style={styles.mealHeader}>
          <View style={styles.dateCol}>
            <Text style={styles.mealDateText}>{h.name}</Text>
            <Text style={styles.mealDateRaw}>
              Từ {formatBusinessDateDisplay(h.fromDate)} đến {formatBusinessDateDisplay(h.toDate)}
            </Text>
          </View>
          <Badge
            label={h.status === 'active' ? 'Đang áp dụng' : 'Đã hủy'}
            variant={h.status === 'active' ? 'confirmed' : 'cancelled'}
            size="sm"
          />
        </View>

        {Boolean(h.reason) && <Text style={styles.mealNote}>Lý do: {h.reason}</Text>}

        {h.status !== 'active' && (
          <View style={styles.mealFooter}>
            <Button
              title="Mở lại sự kiện"
              variant="outline"
              size="sm"
              onPress={() => restoreHolidayMutation.mutate(h.id)}
            />
          </View>
        )}
      </Card>
    ),
    [restoreHolidayMutation]
  );

  if (!hasAccess) {
    return (
      <ScreenContainer scrollable={false}>
        <Header title="Lịch Bếp & Nghỉ Lễ" showBack onBack={() => router.back()} />
        <ForbiddenState
          title="Không có quyền truy cập"
          message={`Tài khoản (${user?.fullName} - ${role}) không được phân quyền quản lý lịch bếp.`}
          onGoBack={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const handleOpenCreate = () => {
    if (activeTab === 'meals') {
      setMealDateInput(selectedDate);
      setMealNoteInput('');
      setIsCreateMealOpen(true);
    } else {
      setHolidayFromInput(today);
      setHolidayToInput(today);
      setHolidayNameInput('');
      setHolidayReasonInput('');
      setIsCreateHolidayOpen(true);
    }
  };

  const ListHeader = (
    <View>
      <Header
        title="Quản lý Lịch Bếp & Nghỉ Lễ"
        subtitle="Thiết lập thực đơn, hủy/mở bếp và ngày nghỉ"
        showBack
        onBack={() => router.back()}
        userRole={role || undefined}
      />

      {/* Tabs Segment */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'meals' && styles.tabBtnActive]}
            onPress={() => setActiveTab('meals')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="restaurant-outline"
              size={16}
              color={activeTab === 'meals' ? colors.primaryDark : colors.textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'meals' && styles.tabBtnTextActive]}>
              Lịch nấu ăn
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'holidays' && styles.tabBtnActive]}
            onPress={() => setActiveTab('holidays')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={activeTab === 'holidays' ? colors.primaryDark : colors.textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'holidays' && styles.tabBtnTextActive]}>
              Sự kiện nghỉ ({holidays.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {activeTab === 'meals' && (
        <View style={styles.dayFilter}>
          <View style={styles.dayNavigation}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Xem ngày bếp trước" onPress={() => changeDay(-1)} style={styles.dayArrow}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Chọn ngày xem lịch bếp" onPress={() => setDatePickerOpen(true)} style={styles.daySelect}>
              <Text style={styles.dayHint}>{selectedDate === today ? 'Hôm nay' : 'Ngày đang xem'}</Text>
              <View style={styles.dayLabel}>
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                <Text style={styles.dayValue}>{formatBusinessDateDisplay(selectedDate)}</Text>
                <Ionicons name="chevron-down" size={15} color={colors.primary} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Xem ngày bếp tiếp theo" onPress={() => changeDay(1)} style={styles.dayArrow}>
              <Ionicons name="chevron-forward" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {selectedDate !== today && <Button title="Về hôm nay" variant="ghost" size="sm" onPress={() => setSelectedDate(today)} />}
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer scrollable={false} backgroundColor={colors.background}>
      {activeTab === 'meals' ? (
        <FlatList
          data={selectedMeals}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMealItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <EmptyState
              title={`Chưa có lịch bếp ngày ${formatBusinessDateDisplay(selectedDate)}`}
              description="Chọn ngày khác để xem hoặc bấm dấu cộng để tạo lịch bếp cho ngày này."
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshing={refreshing || isLoadingMeals}
          onRefresh={handleRefresh}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      ) : (
        <FlatList
          data={holidays}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderHolidayItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <EmptyState
              title="Chưa có ngày nghỉ lễ nào"
              description="Bấm nút dấu cộng ở góc dưới bên phải để thiết lập kỳ nghỉ lễ cho toàn cơ quan."
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshing={refreshing || isLoadingHolidays}
          onRefresh={handleRefresh}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      {datePickerOpen && <DatePickerModal visible mode="single" initialDate={selectedDate}
        title="Chọn ngày xem lịch bếp" onSelectSingle={setSelectedDate} onClose={() => setDatePickerOpen(false)} />}

      {/* Nút Thêm Ngày Bếp / Nghỉ Lễ ở góc dưới bên phải (Floating Action Button) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenCreate}
        activeOpacity={0.85}
        accessibilityLabel={activeTab === 'meals' ? 'Thêm ngày nấu ăn mới' : 'Thiết lập kỳ nghỉ lễ mới'}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={colors.textInverse} />
      </TouchableOpacity>

      {/* Modal Xem Tổng Suất Ăn (Summary) */}
      <Modal visible={summaryMealId !== null} transparent animationType="fade" onRequestClose={() => setSummaryMealId(null)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <ModalCard style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tổng hợp suất ăn ngày</Text>
              <TouchableOpacity onPress={() => setSummaryMealId(null)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {isLoadingSummary ? (
              <View style={styles.summaryLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.summaryLoadingText}>Đang tải dữ liệu tổng hợp...</Text>
              </View>
            ) : mealSummary ? (
              <View style={styles.summaryContent}>
                <Text style={styles.summaryDateBadge}>
                  {formatBusinessDateDisplay(mealSummary.meal?.mealDate || '')}
                </Text>

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryNum}>{mealSummary.totalRegistrations}</Text>
                    <Text style={styles.summaryLabel}>Cán bộ đăng ký</Text>
                  </View>
                  <View style={styles.summaryBox}>
                    <Text style={[styles.summaryNum, { color: colors.warning }]}>
                      {mealSummary.totalGuests}
                    </Text>
                    <Text style={styles.summaryLabel}>Khách đi kèm</Text>
                  </View>
                </View>

                <View style={styles.summaryTotalBox}>
                  <Text style={styles.summaryTotalLabel}>TỔNG SUẤT CẦN NẤU:</Text>
                  <Text style={styles.summaryTotalValue}>{mealSummary.totalMealSlots} suất</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.summaryEmptyText}>Không có dữ liệu tổng hợp cho ngày này.</Text>
            )}

            <Button
              title="Đóng"
              variant="secondary"
              onPress={() => setSummaryMealId(null)}
              style={styles.modalCloseBtn}
            />
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* Modal Tạo Ngày Bếp Mới - Tích hợp DatePickerInput */}
      <Modal visible={isCreateMealOpen} transparent animationType="slide" onRequestClose={() => setIsCreateMealOpen(false)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <ModalCard style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm ngày nấu ăn mới</Text>
              <TouchableOpacity onPress={() => setIsCreateMealOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <DatePickerInput
              label="Ngày bếp"
              value={mealDateInput}
              onChangeDate={setMealDateInput}
              placeholder="Chọn ngày nấu..."
            />

            <Input
              label="Ghi chú thực đơn (tùy chọn)"
              value={mealNoteInput}
              onChangeText={setMealNoteInput}
              placeholder="VD: Thịt kho trứng, Rau muống, Canh bí"
              multiline
            />

            <View style={styles.modalActionRow}>
              <Button
                title="Hủy"
                variant="secondary"
                onPress={() => setIsCreateMealOpen(false)}
                style={styles.modalBtnHalf}
              />
              <Button
                title="Tạo ngày bếp"
                variant="primary"
                onPress={handleCreateMeal}
                loading={createMealMutation.isPending}
                style={styles.modalBtnHalf}
              />
            </View>
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* Modal Sửa Thực Đơn */}
      <Modal visible={isEditMealOpen} transparent animationType="slide" onRequestClose={() => setIsEditMealOpen(false)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <ModalCard style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sửa thực đơn ngày bếp</Text>
              <TouchableOpacity onPress={() => setIsEditMealOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubInfo}>
              Ngày: {selectedMeal ? formatBusinessDateDisplay(selectedMeal.mealDate) : ''}
            </Text>

            <Input
              label="Ghi chú thực đơn"
              value={mealNoteInput}
              onChangeText={setMealNoteInput}
              placeholder="Nhập thực đơn món ăn..."
              multiline
            />

            <View style={styles.modalActionRow}>
              <Button
                title="Hủy"
                variant="secondary"
                onPress={() => setIsEditMealOpen(false)}
                style={styles.modalBtnHalf}
              />
              <Button
                title="Lưu thay đổi"
                variant="primary"
                onPress={handleUpdateMeal}
                loading={updateMealMutation.isPending}
                style={styles.modalBtnHalf}
              />
            </View>
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* Modal Hủy Bếp (Dialog cảnh báo tác động) */}
      <Modal visible={cancelTargetMeal !== null} transparent animationType="fade" onRequestClose={() => setCancelTargetMeal(null)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <ModalCard style={styles.modalDialog}>
            <View style={styles.impactWarningBox}>
              <Ionicons name="alert-circle" size={28} color="#DC2626" />
              <Text style={styles.impactTitle}>Cảnh báo tác động Hủy bếp</Text>
              <Text style={styles.impactMessage}>
                Hủy bếp ăn ngày{' '}
                <Text style={styles.boldText}>
                  {cancelTargetMeal ? formatBusinessDateDisplay(cancelTargetMeal.mealDate) : ''}
                </Text>{' '}
                sẽ tự động gửi thông báo đến tất cả cán bộ đã đăng ký ăn và dừng chuẩn bị bữa ăn ngày này.
              </Text>
            </View>

            <Input
              label="Lý do hủy bếp (bắt buộc)"
              value={cancelReasonInput}
              onChangeText={setCancelReasonInput}
              placeholder="VD: Bếp bảo trì thiết bị gas đột xuất..."
              multiline
            />

            <View style={styles.modalActionRow}>
              <Button
                title="Không hủy"
                variant="secondary"
                onPress={() => setCancelTargetMeal(null)}
                style={styles.modalBtnHalf}
              />
              <Button
                title="Xác nhận hủy bếp"
                variant="danger"
                onPress={handleCancelMeal}
                loading={cancelMealMutation.isPending}
                style={styles.modalBtnHalf}
              />
            </View>
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* Confirm Dialog Mở Lại Bếp */}
      <ConfirmDialog
        visible={restoreTargetMeal !== null}
        title="Mở lại ngày bếp đã hủy"
        message={`Bạn có chắc chắn muốn mở lại ngày bếp ${
          restoreTargetMeal ? formatBusinessDateDisplay(restoreTargetMeal.mealDate) : ''
        }? Cán bộ sẽ có thể tiếp tục đăng ký suất ăn.`}
        confirmText="Mở lại bếp"
        cancelText="Hủy"
        variant="primary"
        onConfirm={handleRestoreMeal}
        onCancel={() => setRestoreTargetMeal(null)}
      />

      {/* Modal Thêm Ngày Nghỉ Lễ - Tích hợp DatePickerInput */}
      <Modal visible={isCreateHolidayOpen} transparent animationType="slide" onRequestClose={() => setIsCreateHolidayOpen(false)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <ModalCard style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo sự kiện nghỉ lễ / Tết</Text>
              <TouchableOpacity onPress={() => setIsCreateHolidayOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Input
              label="Tên sự kiện / Ngày lễ"
              value={holidayNameInput}
              onChangeText={setHolidayNameInput}
              placeholder="VD: Nghỉ lễ Quốc khánh 2/9"
            />

            <View style={styles.modalRowInputs}>
              <View style={styles.inputHalf}>
                <DatePickerInput
                  label="Từ ngày"
                  value={holidayFromInput}
                  onChangeDate={setHolidayFromInput}
                  placeholder="Chọn ngày..."
                />
              </View>
              <View style={styles.inputHalf}>
                <DatePickerInput
                  label="Đến ngày"
                  value={holidayToInput}
                  onChangeDate={setHolidayToInput}
                  placeholder="Chọn ngày..."
                  minDate={holidayFromInput}
                />
              </View>
            </View>

            <Input
              label="Ghi chú lý do"
              value={holidayReasonInput}
              onChangeText={setHolidayReasonInput}
              placeholder="VD: Nghỉ lễ theo quy định nhà nước"
            />

            <View style={styles.modalActionRow}>
              <Button
                title="Hủy"
                variant="secondary"
                onPress={() => setIsCreateHolidayOpen(false)}
                style={styles.modalBtnHalf}
              />
              <Button
                title="Tạo sự kiện"
                variant="primary"
                onPress={handleCreateHoliday}
                loading={createHolidayMutation.isPending}
                style={styles.modalBtnHalf}
              />
            </View>
          </ModalCard>
        </ModalBackdrop>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dayFilter: { marginTop: spacing.sm, marginBottom: spacing.md },
  dayNavigation: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  dayArrow: { width: 48, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  daySelect: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  dayHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  dayLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dayValue: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 88,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 99,
  },
  tabBarWrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundDark,
    borderRadius: radius.lg,
    padding: 3,
  },
  tabBtn: {
    flexWrap: 'wrap',
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabBtnText: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  tabBtnTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  mealCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  dateCol: {
    flex: 1,
  },
  mealDateText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  mealDateRaw: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  mealNote: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginVertical: spacing.xs,
  },
  mealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.xs,
  },
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  summaryBtnText: {
    fontSize: typography.sizes['2xs'],
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
  },
  mealActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalDialog: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexWrap: 'wrap',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  modalSubInfo: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalBtnHalf: {
    flex: 1,
  },
  modalCloseBtn: {
    marginTop: spacing.md,
  },
  modalRowInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputHalf: {
    flex: 1,
  },
  summaryLoading: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  summaryLoadingText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  summaryDateBadge: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.extrabold,
    color: colors.primaryDark,
  },
  summaryLabel: {
    fontSize: typography.sizes['2xs'],
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryTotalBox: {
    width: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotalLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  summaryTotalValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.extrabold,
    color: colors.primaryDark,
  },
  summaryEmptyText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  impactWarningBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  impactTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#991B1B',
    marginTop: spacing.xs,
  },
  impactMessage: {
    fontSize: typography.sizes.xs,
    color: '#7F1D1D',
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: typography.weights.bold,
  },
});
