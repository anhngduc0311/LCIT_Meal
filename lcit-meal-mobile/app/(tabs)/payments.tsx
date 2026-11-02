import { ModalBackdrop } from '../../src/components/common/ModalBackdrop';
/**
 * Tab Screen - Thanh toán cá nhân (Payments) - T16, T23
 * Hiển thị danh sách các khoản tiền ăn cá nhân, trạng thái thanh toán,
 * hỗ trợ quét mã QR, chia sẻ mã QR và sao chép cú pháp chuyển khoản nhanh.
 * TUÂN THỦ GAP-01: Chỉ hiển thị dữ liệu cá nhân từ /payments/me
 * TỐI ƯU HÓA: FlatList virtualization mượt mà.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  TouchableWithoutFeedback,
  FlatList,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { ModalCard } from '../../src/components/common/ModalCard';
import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { DailyMealLedger } from '../../src/components/meals/DailyMealLedger';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { EmptyState } from '../../src/components/states/EmptyState';
import { useAuth } from '../../src/providers/AuthProvider';
import ManagementPaymentsScreen from '../management/payments';
import { useMyPayments, useMyPaymentSummary } from '../../src/hooks/usePaymentsData';
import { useScheduleConfig } from '../../src/hooks/useMealsData';
import { Payment } from '../../src/types';
import {
  formatCurrency,
  formatDisplayDate,
  formatDateTime,
  getMediaUrl,
} from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { shadows } from '../../src/theme/shadows';

export default function PaymentsScreen() {
  const { role } = useAuth();
  return role === 'manager' ? <ManagementPaymentsScreen /> : <PersonalPaymentsScreen />;
}

function PersonalPaymentsScreen() {
  const { compact } = useResponsiveLayout();
  const { user } = useAuth();

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [isSharingQr, setIsSharingQr] = useState(false);

  // Queries
  const { data: payments = [], isLoading: loadingPayments, refetch: refetchPayments } = useMyPayments();
  const { data: summary, isLoading: loadingSummary, isError: summaryError, refetch: refetchSummary } = useMyPaymentSummary();
  const { data: scheduleConfig } = useScheduleConfig();

  const isRefreshing = loadingPayments || loadingSummary;

  const handleRefresh = async () => {
    await Promise.all([refetchPayments(), refetchSummary()]);
  };

  const handleOpenQr = (p: Payment) => {
    setSelectedPayment(p);
    setQrModalVisible(true);
  };

  const unpaidTotal = summary?.totalUnpaidAmount || 0;

  // Lọc theo filterMode
  const filteredPayments = payments.filter((item) => {
    if (filterMode === 'unpaid') {
      return item.status === 'unpaid' || item.status === 'overdue';
    }
    if (filterMode === 'paid') {
      return item.status === 'paid' || item.isPaid === 1 || item.isPaid === true;
    }
    return true;
  });

  // Chia sẻ / Lưu ảnh QR
  const handleShareQr = async () => {
    if (!selectedPayment) return;
    setIsSharingQr(true);

    const qrUrl =
      getMediaUrl(scheduleConfig?.paymentQrImage) ||
      `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=LCITMEAL_PAYMENT_${selectedPayment.id}`;

    const transferContent = `TIEN AN ${user?.username?.toUpperCase() || 'CAN BO'} P${selectedPayment.id}`;
    const shareMessage = `Thông tin chuyển khoản tiền ăn LCIT:\n• Số tiền: ${formatCurrency(selectedPayment.amount)}\n• Ngân hàng: MB Bank\n• STK: 0888999888\n• Tên TK: LCIT BẾP ĂN CƠ QUAN\n• Nội dung: ${transferContent}`;

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: 'Mã QR thanh toán tiền ăn LCIT',
            text: shareMessage,
            url: qrUrl,
          });
        } else {
          await navigator.clipboard.writeText(shareMessage);
          Alert.alert('Đã sao chép', 'Đã sao chép thông tin chuyển khoản vào clipboard.');
        }
      } else {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          const fileUri = `${FileSystem.cacheDirectory}qr_payment_${selectedPayment.id}.png`;
          const downloadedFile = await FileSystem.downloadAsync(qrUrl, fileUri);
          await Sharing.shareAsync(downloadedFile.uri, {
            mimeType: 'image/png',
            dialogTitle: 'Chia sẻ mã QR thanh toán',
            UTI: 'public.png',
          });
        } else {
          await Share.share({
            title: 'Thanh toán tiền ăn LCIT',
            message: shareMessage,
          });
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.message !== 'User did not share') {
        Alert.alert('Thông báo', 'Không thể chia sẻ mã QR vào lúc này.');
      }
    } finally {
      setIsSharingQr(false);
    }
  };

  const handleCopyText = async (text: string, label: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(text);
      Alert.alert('Đã sao chép', `Đã sao chép ${label} vào bộ nhớ tạm.`);
    } else {
      Alert.alert('Thông tin', `${label}: ${text}`);
    }
  };

  const renderPaymentItem = useCallback(
    ({ item }: { item: Payment }) => {
      const isUnpaid = item.status === 'unpaid' || item.status === 'overdue';

      return (
        <Card variant="elevated" padding="lg" style={styles.paymentItemCard}>
          <View style={styles.itemTopRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.itemTitle}>
                Kỳ tiền ăn ngày {formatDisplayDate(item.paymentDate)}
              </Text>
              <Text style={styles.itemDate}>
                {item.isPaid && item.paidAt
                  ? `Đã thanh toán lúc: ${formatDateTime(item.paidAt)}`
                  : `Hạn thanh toán: ${formatDisplayDate(item.paymentDate)}`}
              </Text>
            </View>

            <Badge type="payment" value={item.status} size="sm" />
          </View>

          <View style={styles.itemBottomRow}>
            <View>
              <Text style={styles.itemAmountLabel}>Số tiền:</Text>
              <Text style={styles.itemAmountValue}>
                {formatCurrency(item.amount)}
              </Text>
            </View>

            {isUnpaid ? (
              <Button
                title="Quét mã QR"
                variant="primary"
                size="sm"
                leftIcon={
                  <Ionicons
                    name="qr-code-outline"
                    size={16}
                    color={colors.textInverse}
                  />
                }
                onPress={() => handleOpenQr(item)}
              />
            ) : (
              <View style={styles.paidCheckRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.status.confirmed.dot}
                />
                <Text style={styles.paidCheckText}>Đã hoàn tất</Text>
              </View>
            )}
          </View>
        </Card>
      );
    },
    []
  );

  const ListHeader = (
    <>
      <Header
        title="Thanh toán tiền ăn"
        subtitle="Theo dõi và hoàn tất các khoản thu tiền ăn định kỳ"
      />

      {/* Tổng quan nợ tiền ăn */}
      <Card variant="elevated" padding="xl" style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Tổng tiền cần thanh toán</Text>
          {!loadingSummary && !summaryError && <Badge
            type="payment"
            value={unpaidTotal > 0 ? 'unpaid' : 'paid'}
            size="sm"
          />}
        </View>

        <Text
          style={[
            styles.summaryAmount,
            unpaidTotal > 0 ? styles.amountUnpaid : styles.amountPaid,
          ]}
        >
          {loadingSummary || summaryError ? '—' : formatCurrency(unpaidTotal)}
        </Text>

        <Text style={styles.summaryDesc}>
          {summaryError ? 'Chưa tải được tiền ăn. Kéo xuống để thử lại.' : 'Tiền ăn cộng dồn theo ngày, chốt và thanh toán một lần vào cuối tháng.'}
        </Text>
      </Card>

      {summary && !summaryError && <Card padding="xl"><DailyMealLedger ledger={summary} /></Card>}

      {/* Bộ lọc trạng thái */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setFilterMode('all')}
          style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}
        >
          <Text style={[styles.filterText, filterMode === 'all' && styles.filterTextActive]}>
            Tất cả ({payments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setFilterMode('unpaid')}
          style={[styles.filterChip, filterMode === 'unpaid' && styles.filterChipActive]}
        >
          <Text style={[styles.filterText, filterMode === 'unpaid' && styles.filterTextActive]}>
            Chưa thanh toán
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setFilterMode('paid')}
          style={[styles.filterChip, filterMode === 'paid' && styles.filterChipActive]}
        >
          <Text style={[styles.filterText, filterMode === 'paid' && styles.filterTextActive]}>
            Đã thanh toán
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>
        Lịch sử các kỳ thu ({filteredPayments.length})
      </Text>
    </>
  );

  return (
    <ScreenContainer
      scrollable={false}
      backgroundColor={colors.background}
    >
      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPaymentItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            iconName="wallet-outline"
            title="Chưa có hóa đơn trong danh sách này"
            description="Tiền ăn theo ngày vẫn được cộng dồn ở bảng phía trên. Hóa đơn được lập khi chốt tiền cuối tháng."
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Modal Quét mã QR chuyển khoản */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setQrModalVisible(false)}>
          <ModalBackdrop style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <ModalCard style={[styles.qrCard, shadows.xl]}>
                <View style={styles.qrHeader}>
                  <Text style={styles.qrTitle}>Mã QR Chuyển khoản</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setQrModalVisible(false)}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {selectedPayment && (
                  <>
                    <View style={styles.qrAmountBox}>
                      <Text style={styles.qrAmountLabel}>Số tiền cần chuyển:</Text>
                      <Text style={styles.qrAmountValue}>
                        {formatCurrency(selectedPayment.amount)}
                      </Text>
                    </View>

                    {/* QR Code Image */}
                    <View style={styles.qrImageBox}>
                      <Image
                        source={{
                          uri:
                            getMediaUrl(scheduleConfig?.paymentQrImage) ||
                            `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=LCITMEAL_PAYMENT_${selectedPayment.id}`,
                        }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    </View>

                    {/* QR Transfer Info with Copy buttons */}
                    <View style={styles.qrInfoBox}>
                      <Text style={styles.qrInfoText}>
                        • Ngân hàng: <Text style={styles.qrBold}>MB Bank (Quân Đội)</Text>
                      </Text>
                      <TouchableOpacity
                        style={styles.copyRow}
                        onPress={() => handleCopyText('0888999888', 'Số tài khoản')}
                      >
                        <Text style={styles.qrInfoText}>
                          • Số tài khoản: <Text style={styles.qrBold}>0888999888</Text>
                        </Text>
                        <Ionicons name="copy-outline" size={14} color={colors.primary} />
                      </TouchableOpacity>
                      <Text style={styles.qrInfoText}>
                        • Chủ tài khoản: <Text style={styles.qrBold}>LCIT BẾP ĂN CƠ QUAN</Text>
                      </Text>
                      <TouchableOpacity
                        style={styles.copyRow}
                        onPress={() =>
                          handleCopyText(
                            `TIEN AN ${user?.username?.toUpperCase()} P${selectedPayment.id}`,
                            'Nội dung chuyển khoản'
                          )
                        }
                      >
                        <Text style={styles.qrInfoText}>
                          • Nội dung CK:{' '}
                          <Text style={styles.qrBold}>
                            TIEN AN {user?.username?.toUpperCase()} P{selectedPayment.id}
                          </Text>
                        </Text>
                        <Ionicons name="copy-outline" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>

                    {/* Share / Save QR action buttons */}
                    <View style={[styles.qrActionButtons, compact && { flexDirection: 'column' }]}>
                      <Button
                        title={isSharingQr ? 'Đang chia sẻ...' : 'Lưu / Chia sẻ mã QR'}
                        variant="secondary"
                        size="md"
                        leftIcon={<Ionicons name="share-social-outline" size={18} color={colors.text} />}
                        onPress={handleShareQr}
                        disabled={isSharingQr}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Đã chuyển"
                        variant="primary"
                        size="md"
                        onPress={() => setQrModalVisible(false)}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </>
                )}
              </ModalCard>
            </TouchableWithoutFeedback>
          </ModalBackdrop>
        </TouchableWithoutFeedback>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing['3xl'],
  },
  summaryCard: {
    padding: 24,
    backgroundColor: colors.primaryDark,
    marginBottom: spacing.lg,
  },
  summaryHeader: {
    flexWrap: 'wrap',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  summaryTitle: {
    fontSize: typography.sizes.sm,
    color: '#D5E4D8',
    fontWeight: typography.weights.medium,
  },
  summaryAmount: {
    fontSize: 34,
    fontWeight: typography.weights.extrabold,
    marginVertical: 4,
  },
  amountUnpaid: {
    color: '#FFFFFF',
  },
  amountPaid: {
    color: '#FFFFFF',
  },
  summaryDesc: {
    fontSize: typography.sizes.sm,
    color: '#D5E4D8',
    marginTop: 4,
    lineHeight: 18,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    minHeight: 40,
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
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  paymentItemCard: {
    marginBottom: spacing.md,
  },
  itemTopRow: {
    flexWrap: 'wrap',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  itemTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  itemDate: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemBottomRow: {
    flexWrap: 'wrap',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  itemAmountLabel: {
    fontSize: typography.sizes['2xs'],
    color: colors.textSecondary,
  },
  itemAmountValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  paidCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paidCheckText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.status.confirmed.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  qrCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
  },
  qrTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  qrAmountBox: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  qrAmountLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  qrAmountValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.extrabold,
    color: colors.primaryDark,
    marginTop: 2,
  },
  qrImageBox: {
    width: 200,
    height: 200,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.xl,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  qrImage: {
    width: 180,
    height: 180,
    borderRadius: radius.md,
  },
  qrInfoBox: {
    width: '100%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 6,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qrInfoText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  qrBold: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  qrActionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.xs,
  },
});
