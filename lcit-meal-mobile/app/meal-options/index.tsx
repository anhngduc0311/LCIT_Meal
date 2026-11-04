/**
 * Screen: Cắt suất theo yêu cầu & Lịch sử - T15, T22, T25
 * - Tạo yêu cầu cắt suất: Cắt hôm nay (cancel_today), Cắt theo khoảng (cancel_schedule), Cắt dài hạn (cancel_permanent)
 * - Tích hợp DatePickerModal tương tác lịch tháng
 * - Tối ưu danh sách Lịch sử bằng FlatList mượt mà
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { Input } from '../../src/components/common/Input';
import { DatePickerModal } from '../../src/components/common/DatePickerModal';
import { ResultBanner } from '../../src/components/common/ResultBanner';
import { EmptyState } from '../../src/components/states/EmptyState';
import {
  useMyMealOptions,
  useCreateMealOptionMutation,
} from '../../src/hooks/useMealsData';
import { MealOption, MealOptionType } from '../../src/types';
import {
  formatDisplayDate,
} from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { useCancellationDeadline } from '../../src/hooks/useCancellationDeadline';
import { CANCELLATION_CLOSED_MESSAGE, isCancellationClosed } from '../../src/utils/cancellationDeadline';

export default function MealOptionsScreen() {
  const { today: todayStr, now } = useCancellationDeadline();

  // Tab: 'create' | 'history'
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Form states
  const [optionType, setOptionType] = useState<MealOptionType>('cancel_schedule');
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [note, setNote] = useState('');
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<{
    variant: 'success' | 'error';
    text: string;
  } | null>(null);

  // Queries & Mutations
  const { data: options = [], isLoading: loadingOptions, isError: optionsError, refetch: refetchOptions } = useMyMealOptions();
  const hasPendingRequest = options.some(option => option.status === 'pending');
  const createMutation = useCreateMealOptionMutation();
  const cancelClosed = isCancellationClosed(optionType === 'cancel_today' ? todayStr : fromDate, now);

  const handleSubmit = async () => {
    if (createMutation.isPending || loadingOptions || optionsError || hasPendingRequest) return;
    if (!fromDate) {
      setBannerMessage({ variant: 'error', text: 'Vui lòng chọn ngày bắt đầu cắt suất.' });
      return;
    }

    const finalToDate =
      optionType === 'cancel_today'
        ? fromDate
        : optionType === 'cancel_permanent'
        ? '2099-12-31'
        : toDate || fromDate;

    try {
      await createMutation.mutateAsync({
        type: optionType,
        fromDate,
        toDate: finalToDate,
        note: note.trim() || undefined,
      });

      setBannerMessage({
        variant: 'success',
        text:
          optionType === 'cancel_today'
            ? `Đã cắt suất ăn ngày ${formatDisplayDate(fromDate)} thành công!`
            : optionType === 'cancel_schedule'
            ? `Đã gửi yêu cầu cắt suất từ ${formatDisplayDate(fromDate)} đến ${formatDisplayDate(finalToDate)} (Đang chờ Quản lý duyệt).`
            : `Đã gửi yêu cầu cắt suất dài hạn từ ${formatDisplayDate(fromDate)} (Đang chờ Quản lý duyệt).`,
      });

      setNote('');
      setActiveTab('history');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tạo yêu cầu cắt suất thất bại.';
      setBannerMessage({ variant: 'error', text: msg });
      Alert.alert('Lỗi thao tác', msg);
    }
  };

  const handleSelectDateRange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  const handleSelectSingleDate = (d: string) => {
    setFromDate(d);
    setToDate(d);
  };

  const renderHistoryItem = useCallback(({ item }: { item: MealOption }) => {
    const typeLabel =
      item.type === 'cancel_today'
        ? 'Cắt hôm nay'
        : item.type === 'cancel_schedule'
        ? 'Cắt theo khoảng'
        : 'Cắt dài hạn';

    return (
      <Card variant="elevated" padding="lg" style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <View>
            <Text style={styles.historyType}>{typeLabel}</Text>
            <Text style={styles.historyDates}>
              {item.type === 'cancel_permanent'
                ? `Từ ${formatDisplayDate(item.fromDate)} (Dài hạn)`
                : `${formatDisplayDate(item.fromDate)} → ${formatDisplayDate(item.toDate)}`}
            </Text>
          </View>
          <Badge type="mealOption" value={item.status} size="sm" />
        </View>

        {item.note && (
          <Text style={styles.historyNote}>
            Lý do: <Text style={styles.historyNoteContent}>{item.note}</Text>
          </Text>
        )}

        {item.createdAt && (
          <Text style={styles.historyTime}>
            Tạo lúc: {item.createdAt}
          </Text>
        )}
      </Card>
    );
  }, []);

  const ListHeader = (
    <>
      <Header
        title="Yêu cầu cắt suất"
        subtitle="Cắt suất hôm nay, theo khoảng ngày hoặc dài hạn"
        showBack
      />

      {bannerMessage && (
        <ResultBanner
          variant={bannerMessage.variant}
          message={bannerMessage.text}
          onDismiss={() => setBannerMessage(null)}
        />
      )}

      {/* Tab Switcher */}
      {hasPendingRequest && <ResultBanner variant="error"
        message="Bạn đang có yêu cầu cắt suất chờ duyệt. Vui lòng chờ quản lý duyệt hoặc từ chối trước khi gửi yêu cầu tiếp." />}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab('create')}
          style={[styles.tabBtn, activeTab === 'create' && styles.tabBtnActive]}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'create' && styles.tabBtnTextActive,
            ]}
          >
            Tạo yêu cầu mới
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab('history')}
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'history' && styles.tabBtnTextActive,
            ]}
          >
            Lịch sử ({options.length})
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <ScreenContainer
      scrollable={false}
      backgroundColor={colors.background}
    >
      {activeTab === 'create' ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              {ListHeader}
              <View style={styles.formContainer}>
                {/* Chọn loại cắt suất */}
                <Card variant="elevated" padding="lg" style={styles.card}>
                  <Text style={styles.fieldLabel}>1. Chọn loại cắt suất:</Text>

                  <View style={styles.typeGrid}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setOptionType('cancel_today');
                        setFromDate(todayStr);
                        setToDate(todayStr);
                      }}
                      style={[
                        styles.typeOption,
                        optionType === 'cancel_today' && styles.typeOptionActive,
                      ]}
                    >
                      <Ionicons
                        name="today-outline"
                        size={22}
                        color={optionType === 'cancel_today' ? colors.primaryDark : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.typeTitle,
                          optionType === 'cancel_today' && styles.typeTitleActive,
                        ]}
                      >
                        Cắt hôm nay
                      </Text>
                      <Text style={styles.typeDesc}>Chỉ cắt bữa trưa hôm nay</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setOptionType('cancel_schedule')}
                      style={[
                        styles.typeOption,
                        optionType === 'cancel_schedule' && styles.typeOptionActive,
                      ]}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={22}
                        color={optionType === 'cancel_schedule' ? colors.primaryDark : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.typeTitle,
                          optionType === 'cancel_schedule' && styles.typeTitleActive,
                        ]}
                      >
                        Cắt theo khoảng
                      </Text>
                      <Text style={styles.typeDesc}>Từ ngày đến ngày</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setOptionType('cancel_permanent')}
                      style={[
                        styles.typeOption,
                        optionType === 'cancel_permanent' && styles.typeOptionActive,
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={22}
                        color={optionType === 'cancel_permanent' ? colors.primaryDark : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.typeTitle,
                          optionType === 'cancel_permanent' && styles.typeTitleActive,
                        ]}
                      >
                        Cắt dài hạn
                      </Text>
                      <Text style={styles.typeDesc}>Nghỉ phép dài hạn</Text>
                    </TouchableOpacity>
                  </View>
                </Card>

                {/* Chọn thời gian */}
                <Card variant="elevated" padding="lg" style={styles.card}>
                  <Text style={styles.fieldLabel}>2. Thời gian hiệu lực:</Text>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setDateModalVisible(true)}
                    style={styles.datePickerTrigger}
                  >
                    <View style={styles.dateTriggerRow}>
                      <Ionicons name="calendar" size={22} color={colors.primary} />
                      <View style={styles.dateTriggerTextCol}>
                        <Text style={styles.dateTriggerSub}>Khoảng ngày đã chọn:</Text>
                        <Text style={styles.dateTriggerMain}>
                          {optionType === 'cancel_today'
                            ? formatDisplayDate(todayStr)
                            : optionType === 'cancel_permanent'
                            ? `Bắt đầu từ ${formatDisplayDate(fromDate)} (dài hạn)`
                            : `Từ ${formatDisplayDate(fromDate)} đến ${formatDisplayDate(toDate || fromDate)}`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.changeDateText}>Thay đổi</Text>
                  </TouchableOpacity>
                </Card>

                {/* Nhập lý do */}
                <Card variant="elevated" padding="lg" style={styles.card}>
                  <Text style={styles.fieldLabel}>3. Lý do / Ghi chú (không bắt buộc):</Text>
                  <Input
                    placeholder="Ví dụ: Đi công tác tại cảng, Nghỉ phép..."
                    value={note}
                    onChangeText={setNote}
                    leftIcon={
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color={colors.textSecondary}
                      />
                    }
                  />
                </Card>

                {/* Thông tin quy định duyệt */}
                <View style={styles.policyNotice}>
                  <Ionicons
                    name={optionType === 'cancel_today' ? 'checkmark-circle' : 'time-outline'}
                    size={18}
                    color={optionType === 'cancel_today' ? colors.status.confirmed.dot : colors.status.pending.dot}
                  />
                  <Text style={styles.policyText}>
                    {cancelClosed ? CANCELLATION_CLOSED_MESSAGE + ' Vui lòng chọn ngày bắt đầu từ ngày mai.' : optionType === 'cancel_today' ? (
                      <>
                        Yêu cầu cắt hôm nay sẽ được{' '}
                        <Text style={styles.policyBold}>tự động duyệt ngay</Text> nếu thực hiện trước 08:00 sáng (giờ Việt Nam).
                      </>
                    ) : (
                      <>
                        Yêu cầu cắt suất tùy chỉnh / dài hạn sẽ ở trạng thái{' '}
                        <Text style={styles.policyBold}>Chờ duyệt</Text> và cần Quản lý phê duyệt.
                      </>
                    )}
                  </Text>
                </View>

                {/* Nút gửi yêu cầu */}
                <Button
                  title={hasPendingRequest ? 'Đang chờ duyệt yêu cầu trước' : cancelClosed ? 'Quá hạn cắt suất' : 'Xác nhận gửi yêu cầu cắt suất'}
                  variant="primary"
                  size="lg"
                  loading={createMutation.isPending}
                  disabled={createMutation.isPending || cancelClosed || loadingOptions || optionsError || hasPendingRequest}
                  onPress={handleSubmit}
                  fullWidth
                  style={styles.submitBtn}
                />
              </View>
            </>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        />
      ) : (
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderHistoryItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <EmptyState
              iconName="document-text-outline"
              title="Chưa có yêu cầu cắt suất nào"
              description="Bạn chưa tạo yêu cầu cắt suất ăn nào trước đây."
              actionText="Tạo yêu cầu ngay"
              onAction={() => setActiveTab('create')}
            />
          }
          refreshing={loadingOptions}
          onRefresh={refetchOptions}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        />
      )}

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={dateModalVisible}
        mode={optionType === 'cancel_schedule' ? 'range' : 'single'}
        initialDate={fromDate}
        initialFromDate={fromDate}
        initialToDate={toDate}
        minDate={todayStr}
        title={
          optionType === 'cancel_today'
            ? 'Chọn ngày cắt'
            : optionType === 'cancel_permanent'
            ? 'Chọn ngày bắt đầu cắt dài hạn'
            : 'Chọn khoảng ngày cắt suất'
        }
        onSelectSingle={(d) => {
          handleSelectSingleDate(d);
          setDateModalVisible(false);
        }}
        onSelectRange={(f, t) => {
          handleSelectDateRange(f, t);
          setDateModalVisible(false);
        }}
        onClose={() => setDateModalVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.xl,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabBtn: {
    flexWrap: 'wrap',
    minWidth: 0,
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  formContainer: {
    gap: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  typeGrid: {
    gap: spacing.sm,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.md,
  },
  typeOptionActive: {
    backgroundColor: colors.primary50,
    borderColor: colors.primary,
  },
  typeTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  typeTitleActive: {
    color: colors.primaryDark,
  },
  typeDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  dateTriggerTextCol: {
    flex: 1,
  },
  dateTriggerSub: {
    fontSize: typography.sizes['2xs'],
    color: colors.textSecondary,
  },
  dateTriggerMain: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 2,
  },
  changeDateText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  policyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary50,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  policyText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  policyBold: {
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  historyCard: {
    marginBottom: spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  historyType: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  historyDates: {
    fontSize: typography.sizes.xs,
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  historyNote: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  historyNoteContent: {
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  historyTime: {
    fontSize: typography.sizes['2xs'],
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
