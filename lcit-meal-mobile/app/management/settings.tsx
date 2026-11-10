/**
 * Cấu Hình Hệ Thống (Admin Only)
 * T34: Lịch thứ trong tuần, giờ đóng, các key được hỗ trợ, upload QR thanh toán;
 * phân biệt cập nhật từng mục và lưu toàn bộ.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Switch,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Button } from '../../src/components/common/Button';
import { Input } from '../../src/components/common/Input';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { ForbiddenState } from '../../src/components/states/ForbiddenState';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  useSystemSettings,
  useMealScheduleDays,
  useBulkUpdateSettings,
  useUpdateScheduleDays,
  useUploadPaymentQr,
} from '../../src/hooks/useManagementSettings';
import { getMediaUrl } from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { MealScheduleDayConfig } from '../../src/types';

const DAY_NAMES = [
  'Chủ nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

function TimePicker({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const parts = (draft ?? value).split(':');

  function adjust(index: number, limit: number, delta: number) {
    setDraft(current => {
      if (current === null) return null;
      const next = current.split(':');
      const number = (Number(next[index]) + delta + limit) % limit;
      next[index] = String(number).padStart(2, '0');
      return next.join(':');
    });
  }

  return (
    <View>
      <Text style={styles.timeLabel}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}. Mở bộ chọn giờ`}
        onPress={() => setDraft(value)}
        style={styles.timeField}
      >
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <Text style={styles.timeFieldValue}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
      {draft !== null && (
        <ConfirmDialog
          visible
          title={label}
          confirmText="Áp dụng"
          cancelText="Hủy"
          onConfirm={() => {
            onChange(draft);
            setDraft(null);
          }}
          onCancel={() => setDraft(null)}
        >
          <View style={styles.timePicker}>
            {[{ name: 'giờ', limit: 24 }, { name: 'phút', limit: 60 }].map(({ name, limit }, index) => (
              <View key={name} style={styles.timeColumn}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, tăng ${name}`}
                  onPress={() => adjust(index, limit, 1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-up" size={20} color={colors.primary} />
                </TouchableOpacity>
                <Text accessibilityLabel={`${label}, ${parts[index]} ${name}`} style={styles.timeNumber}>
                  {parts[index]}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, giảm ${name}`}
                  onPress={() => adjust(index, limit, -1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-down" size={20} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.timeUnit}>{name}</Text>
              </View>
            ))}
          </View>
        </ConfirmDialog>
      )}
    </View>
  );
}

const TIME_VALUE = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export default function ManagementSettingsScreen() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = role === 'admin';

  // Days state
  const [days, setDays] = useState<MealScheduleDayConfig[]>([
    { dayOfWeek: 0, isEnabled: false, notes: 'Chủ nhật nghỉ' },
    { dayOfWeek: 1, isEnabled: true, notes: 'Bữa trưa đầu tuần' },
    { dayOfWeek: 2, isEnabled: true, notes: 'Bữa trưa thứ 3' },
    { dayOfWeek: 3, isEnabled: true, notes: 'Bữa trưa thứ 4' },
    { dayOfWeek: 4, isEnabled: true, notes: 'Bữa trưa thứ 5' },
    { dayOfWeek: 5, isEnabled: true, notes: 'Bữa trưa thứ 6' },
    { dayOfWeek: 6, isEnabled: false, notes: 'Thứ 7 nghỉ' },
  ]);

  // Settings values state
  const [mealPrice, setMealPrice] = useState('30000');
  const [guestPrice, setGuestPrice] = useState('35000');
  const [closeTime, setCloseTime] = useState('08:00');
  const [completionTime, setCompletionTime] = useState('12:00');
  const [paymentQrUrl, setPaymentQrUrl] = useState('');

  const { data: rawSettings = [], refetch: refetchSettings } = useSystemSettings();
  const { data: daysResponse, refetch: refetchDays } = useMealScheduleDays();

  const bulkUpdateMutation = useBulkUpdateSettings();
  const updateDaysMutation = useUpdateScheduleDays();
  const uploadQrMutation = useUploadPaymentQr();

  // Populate data when query loads
  useEffect(() => {
    if (daysResponse?.days && daysResponse.days.length > 0) {
      const timer = setTimeout(() => {
        setDays(daysResponse.days);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [daysResponse]);

  useEffect(() => {
    if (rawSettings.length > 0) {
      const timer = setTimeout(() => {
        const mp = rawSettings.find((s) => s.settingKey === 'meal_price');
        if (mp) setMealPrice(mp.settingValue);

        const gp = rawSettings.find((s) => s.settingKey === 'guest_meal_price');
        if (gp) setGuestPrice(gp.settingValue);

        const ct = rawSettings.find((s) => s.settingKey === 'registration_close_time');
        if (ct) setCloseTime(TIME_VALUE.test(ct.settingValue) ? ct.settingValue.slice(0, 5) : '08:00');

        const comp = rawSettings.find((s) => s.settingKey === 'meal_completion_time');
        if (comp) setCompletionTime(TIME_VALUE.test(comp.settingValue) ? comp.settingValue.slice(0, 5) : '12:00');

        const qr = rawSettings.find((s) => s.settingKey === 'payment_qr_image');
        if (qr) setPaymentQrUrl(qr.settingValue);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [rawSettings]);

  if (!isAdmin) {
    return (
      <ScreenContainer scrollable={false}>
        <Header title="Cấu hình hệ thống" showBack onBack={() => router.back()} />
        <ForbiddenState
          title="Chỉ dành cho Quản trị viên"
          message={`Tài khoản (${user?.fullName} - ${role}) không có quyền thay đổi cấu hình hệ thống.`}
          onGoBack={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSettings(), refetchDays()]);
    setRefreshing(false);
  };

  const toggleDay = (dayOfWeek: number) => {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, isEnabled: !d.isEnabled } : d))
    );
  };

  const handleSaveDays = async () => {
    try {
      await updateDaysMutation.mutateAsync(days);
      Alert.alert('Thành công', 'Đã lưu cấu hình các ngày ăn trong tuần.');
    } catch (err: unknown) {
      const error = err as Error;
      Alert.alert('Lỗi lưu lịch thứ', error.message || 'Thao tác thất bại');
    }
  };

  const handleSaveGeneralSettings = async () => {
    try {
      await bulkUpdateMutation.mutateAsync([
        { settingKey: 'meal_price', settingValue: mealPrice },
        { settingKey: 'guest_meal_price', settingValue: guestPrice },
        { settingKey: 'registration_close_time', settingValue: closeTime },
        { settingKey: 'meal_completion_time', settingValue: completionTime },
        { settingKey: 'payment_qr_image', settingValue: paymentQrUrl },
      ]);
      Alert.alert('Thành công', 'Đã lưu cấu hình chung của hệ thống.');
    } catch (err: unknown) {
      const error = err as Error;
      Alert.alert('Lỗi lưu cấu hình', error.message || 'Thao tác thất bại');
    }
  };

  const handleUploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      const res = await uploadQrMutation.mutateAsync({
        fileUri: asset.uri,
        mimeType: asset.mimeType || 'image/png',
      });
      const newUrl = res?.url || asset.uri;
      setPaymentQrUrl(newUrl);
      Alert.alert('Thành công', 'Đã tải ảnh mã QR lên hệ thống thành công.');
    } catch (err: unknown) {
      const error = err as Error;
      Alert.alert('Lỗi tải ảnh', error.message || 'Không thể tải ảnh QR lên máy chủ.');
    }
  };

  const handlePickImage = async (useCamera = false) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền máy ảnh', 'Vui lòng cấp quyền truy cập máy ảnh để chụp mã QR.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets?.[0]) {
          await handleUploadAsset(result.assets[0]);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền truy cập ảnh', 'Vui lòng cấp quyền truy cập thư viện ảnh để chọn mã QR.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets?.[0]) {
          await handleUploadAsset(result.assets[0]);
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      Alert.alert('Lỗi thao tác', error.message || 'Không thể chọn ảnh từ thiết bị.');
    }
  };

  const handleChooseUploadOption = () => {
    Alert.alert(
      'Tải ảnh mã QR',
      'Chọn phương thức tải ảnh từ điện thoại của bạn:',
      [
        {
          text: 'Chọn từ thư viện ảnh',
          onPress: () => handlePickImage(false),
        },
        {
          text: 'Chụp ảnh mới',
          onPress: () => handlePickImage(true),
        },
        {
          text: 'Hủy',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable={false} backgroundColor={colors.background}>
      <Header
        title="Cấu hình Hệ thống"
        subtitle="Lịch thứ, giờ đóng đăng ký, đơn giá & mã QR"
        showBack
        onBack={() => router.back()}
        userRole={role || undefined}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {/* Phần 1: Lịch thứ trong tuần */}
        <Card variant="elevated" padding="md" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>1. Các ngày ăn trong tuần</Text>
              <Text style={styles.sectionSubtitle}>
                Bật/tắt các ngày nhà bếp phục vụ nấu ăn mặc định
              </Text>
            </View>
            <Button
              title="Lưu lịch thứ"
              variant="outline"
              size="sm"
              loading={updateDaysMutation.isPending}
              onPress={handleSaveDays}
            />
          </View>

          <View style={styles.daysList}>
            {days.map((d) => {
              const isEnabled = Boolean(d.isEnabled);
              return (
                <View key={d.dayOfWeek} style={styles.dayRow}>
                  <View style={styles.dayInfo}>
                    <Text style={[styles.dayName, isEnabled && styles.dayNameActive]}>
                      {DAY_NAMES[d.dayOfWeek]}
                    </Text>
                    <Text style={styles.dayNotes}>{d.notes || 'Không có ghi chú'}</Text>
                  </View>

                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleDay(d.dayOfWeek)}
                    trackColor={{ false: colors.border, true: colors.primaryLight }}
                    thumbColor={isEnabled ? colors.primary : '#F4F3F4'}
                  />
                </View>
              );
            })}
          </View>
        </Card>

        {/* Phần 2: Đơn giá & Khung giờ */}
        <Card variant="elevated" padding="md" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>2. Đơn giá & Thời gian cắt suất</Text>
              <Text style={styles.sectionSubtitle}>Thiết lập giá tiền và giờ chốt danh sách</Text>
            </View>
            <Button
              title="Lưu cài đặt"
              variant="primary"
              size="sm"
              loading={bulkUpdateMutation.isPending}
              onPress={handleSaveGeneralSettings}
            />
          </View>

          <View style={styles.inputsGrid}>
            <View style={styles.rowInputs}>
              <View style={styles.halfCol}>
                <Input
                  label="Giá suất cán bộ (VND)"
                  value={mealPrice}
                  onChangeText={setMealPrice}
                  keyboardType="numeric"
                  placeholder="30000"
                />
              </View>
              <View style={styles.halfCol}>
                <Input
                  label="Giá suất khách (VND)"
                  value={guestPrice}
                  onChangeText={setGuestPrice}
                  keyboardType="numeric"
                  placeholder="35000"
                />
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfCol}>
                <TimePicker
                  label="Giờ đóng báo suất"
                  value={closeTime}
                  onChange={setCloseTime}
                />
              </View>
              <View style={styles.halfCol}>
                <TimePicker
                  label="Giờ chốt hoàn thành"
                  value={completionTime}
                  onChange={setCompletionTime}
                />
              </View>
            </View>
          </View>
        </Card>

        {/* Phần 3: Mã QR thanh toán */}
        <Card variant="elevated" padding="md" style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. Mã QR Thanh Toán Ngân Hàng</Text>
          <Text style={styles.sectionSubtitle}>
            Hiển thị cho cán bộ quét chuyển khoản khi xem khoản thanh toán
          </Text>

          {/* Button tải ảnh QR từ điện thoại */}
          <View style={styles.qrActionSection}>
            <Button
              title="Tải ảnh QR từ điện thoại"
              variant="primary"
              size="md"
              leftIcon={<Ionicons name="cloud-upload-outline" size={18} color={colors.textInverse} />}
              loading={uploadQrMutation.isPending}
              onPress={handleChooseUploadOption}
              style={styles.uploadQrBtn}
            />
          </View>

          {paymentQrUrl ? (
            <View style={styles.qrPreviewBox}>
              <View style={styles.qrPreviewHeader}>
                <Text style={styles.qrPreviewLabel}>Xem trước mã QR:</Text>
                <TouchableOpacity
                  onPress={() => setPaymentQrUrl('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removeQrText}>Xóa ảnh</Text>
                </TouchableOpacity>
              </View>
              <Image
                source={{ uri: getMediaUrl(paymentQrUrl) }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View style={styles.emptyQrBox}>
              <Ionicons name="qr-code-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.emptyQrText}>Chưa có ảnh mã QR ngân hàng</Text>
            </View>
          )}

          <Button
            title="Cập nhật mã QR"
            variant="outline"
            size="md"
            style={styles.saveQrBtn}
            loading={bulkUpdateMutation.isPending}
            onPress={handleSaveGeneralSettings}
          />
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  sectionCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  sectionHeaderRow: {
    flexWrap: 'wrap',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  daysList: {
    gap: spacing.xs,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundDark,
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
  },
  dayNameActive: {
    color: colors.primaryDark,
  },
  dayNotes: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  inputsGrid: {
    marginTop: spacing.xs,
  },
  rowInputs: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfCol: {
    minWidth: 180,
    flex: 1,
  },
  timeLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  timeField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  timeFieldValue: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  timePicker: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    paddingBottom: spacing.xs,
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeArrow: {
    alignSelf: 'stretch',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeNumber: {
    color: colors.text,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    fontVariant: ['tabular-nums'],
  },
  timeUnit: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  qrActionSection: {
    marginVertical: spacing.sm,
  },
  uploadQrBtn: {
    width: '100%',
  },
  qrPreviewBox: {
    alignItems: 'center',
    marginVertical: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.backgroundDark,
    borderRadius: radius.lg,
  },
  qrPreviewHeader: {
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  qrPreviewLabel: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  removeQrText: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: typography.weights.medium,
  },
  emptyQrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    marginVertical: spacing.sm,
    backgroundColor: colors.backgroundDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  emptyQrText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  qrImage: {
    width: 150,
    height: 150,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  saveQrBtn: {
    marginTop: spacing.xs,
  },
});
