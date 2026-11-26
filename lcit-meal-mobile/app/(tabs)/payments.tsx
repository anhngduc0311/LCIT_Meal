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
  ScrollView,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { ModalCard } from '../../src/components/common/ModalCard';
import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { EmptyState } from '../../src/components/states/EmptyState';
import { useAuth } from '../../src/providers/AuthProvider';
import ManagementPaymentsScreen from '../management/payments';
import {
  useMyPayments,
  useMyPaymentSummary,
  useSubmitPaymentProof,
} from '../../src/hooks/usePaymentsData';
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
  return role === 'manager' || role === 'kitchen' ? <ManagementPaymentsScreen /> : <PersonalPaymentsScreen />;
}

function PersonalPaymentsScreen() {
  const { compact } = useResponsiveLayout();
  const { user } = useAuth();

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [pickedProof, setPickedProof] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [isSharingQr, setIsSharingQr] = useState(false);

  // Queries & Mutations
  const { data: payments = [], isLoading: loadingPayments, refetch: refetchPayments } = useMyPayments();
  const { data: summary, isLoading: loadingSummary, isError: summaryError, refetch: refetchSummary } = useMyPaymentSummary();
  const { data: scheduleConfig } = useScheduleConfig();
  const submitProofMutation = useSubmitPaymentProof();

  const isRefreshing = loadingPayments || loadingSummary;

  const handleRefresh = async () => {
    await Promise.all([refetchPayments(), refetchSummary()]);
  };

  const handleOpenQr = (p: Payment) => {
    setSelectedPayment(p);
    setPickedProof(null);
    setQrModalVisible(true);
  };

  const handleCloseQr = () => {
    setQrModalVisible(false);
    setPickedProof(null);
  };

  const handlePickProofFromLibrary = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để tải lên ảnh chuyển khoản.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        setPickedProof(result.assets[0]);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở thư viện ảnh. Vui lòng thử lại.');
    }
  };

  const handleTakeProofPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền camera để chụp ảnh chuyển khoản.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        setPickedProof(result.assets[0]);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở camera. Vui lòng thử lại.');
    }
  };

  const handleConfirmTransferred = async () => {
    if (!selectedPayment) return;
    if (!pickedProof) {
      if (selectedPayment.billImg) {
        Alert.alert('Thông báo', 'Bạn đã gửi ảnh chuyển khoản cho kỳ này rồi. Chọn ảnh mới nếu muốn cập nhật.');
        return;
      }
      Alert.alert('Thiếu ảnh chuyển khoản', 'Vui lòng tải lên ảnh chụp màn hình đã chuyển tiền trước khi xác nhận.');
      return;
    }

    try {
      await submitProofMutation.mutateAsync({
        id: selectedPayment.id,
        asset: {
          uri: pickedProof.uri,
          mimeType: pickedProof.mimeType,
          fileName: pickedProof.fileName,
          file: (pickedProof as ImagePicker.ImagePickerAsset & { file?: File }).file,
        },
      });
      Alert.alert(
        'Đã xác nhận chuyển tiền',
        'Ảnh chuyển khoản đã được gửi lên hệ thống. Quản trị viên sẽ kiểm tra và duyệt khoản thanh toán của bạn.'
      );
      handleCloseQr();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gửi ảnh xác nhận chuyển tiền thất bại';
      Alert.alert('Lỗi', msg);
    }
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
                title={item.billImg ? 'Cập nhật ảnh CK' : 'Thanh toán & Gửi ảnh'}
                variant="primary"
                size="sm"
                leftIcon={
                  <Ionicons
                    name={item.billImg ? 'image-outline' : 'qr-code-outline'}
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

          {item.billImg ? (
            <TouchableOpacity
              style={styles.proofBanner}
              activeOpacity={0.75}
              onPress={() => {
                const url = getMediaUrl(item.billImg);
                if (url) setProofPreviewUrl(url);
              }}
            >
              <Image
                source={{ uri: getMediaUrl(item.billImg) || item.billImg }}
                style={styles.proofThumb}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.proofBannerTitle}>
                  {isUnpaid ? 'Đã gửi ảnh chuyển khoản · Chờ xác nhận' : 'Ảnh xác nhận chuyển khoản'}
                </Text>
                <Text style={styles.proofBannerSub}>Nhấn để xem ảnh đã gửi</Text>
              </View>
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
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
        Các kỳ thanh toán ({filteredPayments.length})
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
            description="Tiền ăn vẫn cộng dồn hằng ngày ở bảng trên. Đến cuối tháng, hệ thống tự chốt và hiển thị kỳ thanh toán, không cần tạo khoản thu."
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

      {/* Modal Quét mã QR chuyển khoản & Gửi ảnh xác nhận */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseQr}
      >
        <TouchableWithoutFeedback onPress={handleCloseQr}>
          <ModalBackdrop style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <ModalCard style={[styles.qrCard, shadows.xl]}>
                <View style={styles.qrHeader}>
                  <Text style={styles.qrTitle}>Thanh toán chuyển khoản</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleCloseQr}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {selectedPayment && (
                  <ScrollView
                    style={{ width: '100%' }}
                    contentContainerStyle={styles.qrScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
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

                    {/* Upload ảnh đã chuyển tiền */}
                    <View style={styles.proofUploadSection}>
                      <Text style={styles.proofUploadLabel}>
                        Ảnh xác nhận đã chuyển tiền *
                      </Text>
                      {pickedProof || selectedPayment.billImg ? (
                        <View style={styles.proofPreviewBox}>
                          <Image
                            source={{
                              uri:
                                pickedProof?.uri ||
                                getMediaUrl(selectedPayment.billImg) ||
                                selectedPayment.billImg ||
                                '',
                            }}
                            style={styles.proofPreviewImg}
                            resizeMode="contain"
                          />
                          <View style={styles.proofPickerRow}>
                            <Button
                              title="Chọn ảnh khác"
                              variant="secondary"
                              size="sm"
                              leftIcon={<Ionicons name="images-outline" size={16} color={colors.text} />}
                              onPress={handlePickProofFromLibrary}
                              style={{ flex: 1 }}
                            />
                            {Platform.OS !== 'web' && (
                              <Button
                                title="Chụp lại"
                                variant="secondary"
                                size="sm"
                                leftIcon={<Ionicons name="camera-outline" size={16} color={colors.text} />}
                                onPress={handleTakeProofPhoto}
                                style={{ flex: 1 }}
                              />
                            )}
                          </View>
                        </View>
                      ) : (
                        <View style={styles.proofEmptyBox}>
                          <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
                          <Text style={styles.proofEmptyText}>
                            Tải lên ảnh chụp màn hình chuyển khoản thành công
                          </Text>
                          <View style={styles.proofPickerRow}>
                            <Button
                              title="Chọn từ thư viện"
                              variant="secondary"
                              size="sm"
                              leftIcon={<Ionicons name="images-outline" size={16} color={colors.text} />}
                              onPress={handlePickProofFromLibrary}
                              style={{ flex: 1 }}
                            />
                            {Platform.OS !== 'web' && (
                              <Button
                                title="Chụp ảnh"
                                variant="secondary"
                                size="sm"
                                leftIcon={<Ionicons name="camera-outline" size={16} color={colors.text} />}
                                onPress={handleTakeProofPhoto}
                                style={{ flex: 1 }}
                              />
                            )}
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Share QR + Xác nhận đã chuyển tiền */}
                    <View style={[styles.qrActionButtons, compact && { flexDirection: 'column' }]}>
                      <Button
                        title={isSharingQr ? 'Đang chia sẻ...' : 'Lưu / Chia sẻ QR'}
                        variant="secondary"
                        size="md"
                        leftIcon={<Ionicons name="share-social-outline" size={18} color={colors.text} />}
                        onPress={handleShareQr}
                        disabled={isSharingQr || submitProofMutation.isPending}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Xác nhận đã chuyển tiền"
                        variant="primary"
                        size="md"
                        leftIcon={<Ionicons name="checkmark-circle-outline" size={18} color={colors.textInverse} />}
                        onPress={handleConfirmTransferred}
                        loading={submitProofMutation.isPending}
                        disabled={submitProofMutation.isPending}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </ScrollView>
                )}
              </ModalCard>
            </TouchableWithoutFeedback>
          </ModalBackdrop>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal xem ảnh chuyển khoản đã gửi */}
      <Modal
        visible={Boolean(proofPreviewUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setProofPreviewUrl(null)}
      >
        <TouchableWithoutFeedback onPress={() => setProofPreviewUrl(null)}>
          <ModalBackdrop style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <ModalCard style={[styles.qrCard, shadows.xl]}>
                <View style={styles.qrHeader}>
                  <Text style={styles.qrTitle}>Ảnh xác nhận chuyển khoản</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setProofPreviewUrl(null)}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {proofPreviewUrl ? (
                  <Image
                    source={{ uri: proofPreviewUrl }}
                    style={styles.fullProofImage}
                    resizeMode="contain"
                  />
                ) : null}
                <Button
                  title="Đóng"
                  variant="secondary"
                  size="md"
                  onPress={() => setProofPreviewUrl(null)}
                  style={{ width: '100%', marginTop: spacing.md }}
                />
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
  qrScrollContent: {
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  proofBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  proofThumb: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundDark,
  },
  proofBannerTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  proofBannerSub: {
    fontSize: typography.sizes['2xs'],
    color: colors.textSecondary,
    marginTop: 1,
  },
  proofUploadSection: {
    width: '100%',
    marginBottom: spacing.md,
  },
  proofUploadLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  proofEmptyBox: {
    width: '100%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSubtle,
    gap: spacing.xs,
  },
  proofEmptyText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  proofPreviewBox: {
    width: '100%',
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    gap: spacing.sm,
  },
  proofPreviewImg: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundDark,
  },
  proofPickerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    width: '100%',
  },
  fullProofImage: {
    width: '100%',
    height: 360,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
});
