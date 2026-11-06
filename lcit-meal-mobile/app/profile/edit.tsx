/**
 * Screen: Chỉnh sửa hồ sơ cá nhân & Đổi mật khẩu - T18, T23, T25
 * Cho phép cập nhật Họ tên và thay đổi mật khẩu qua PATCH /api/users/me
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Button } from '../../src/components/common/Button';
import { Input } from '../../src/components/common/Input';
import { PasswordInput } from '../../src/components/common/PasswordInput';
import { ResultBanner } from '../../src/components/common/ResultBanner';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUpdateProfileMutation } from '../../src/hooks/useProfileData';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const updateProfileMutation = useUpdateProfileMutation();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [bannerMessage, setBannerMessage] = useState<{
    variant: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      setBannerMessage({ variant: 'error', text: 'Họ và tên không được để trống.' });
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setBannerMessage({ variant: 'error', text: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setBannerMessage({ variant: 'error', text: 'Mật khẩu xác nhận không khớp.' });
        return;
      }
    }

    setBannerMessage(null);

    try {
      await updateProfileMutation.mutateAsync({
        fullName: fullName.trim(),
        password: newPassword || undefined,
        email: email.trim() || undefined,
        phone: phone.trim(),
      });

      setBannerMessage({
        variant: 'success',
        text: 'Cập nhật thông tin hồ sơ thành công!',
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu thông tin.';
      Alert.alert('Lỗi cập nhật', msg);
    }
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Chỉnh sửa hồ sơ"
        subtitle={`Tài khoản: @${user?.username}`}
        showBack
      />

      {bannerMessage && (
        <ResultBanner
          variant={bannerMessage.variant}
          message={bannerMessage.text}
          onDismiss={() => setBannerMessage(null)}
        />
      )}

      {/* 1. THÔNG TIN CÁ NHÂN */}
      <Card variant="elevated" padding="lg" style={styles.card}>
        <Text style={styles.sectionHeader}>Thông tin cá nhân</Text>

        <Input
          label="Tên đăng nhập (Username)"
          value={user?.username || ''}
          editable={false}
          leftIcon={<Ionicons name="person-circle-outline" size={20} color={colors.textMuted} />}
          helperText="Tên đăng nhập do cơ quan cấp, không thể thay đổi."
        />

        <Input
          label="Họ và tên"
          value={fullName}
          onChangeText={setFullName}
          required
          placeholder="Nhập họ và tên đầy đủ"
          leftIcon={<Ionicons name="person-outline" size={20} color={colors.textSecondary} />}
        />

        <Input
          label="Địa chỉ Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="example@lcit.vn"
          leftIcon={<Ionicons name="mail-outline" size={20} color={colors.textSecondary} />}
        />

        <Input
          label="Số điện thoại"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="0901234567"
          leftIcon={<Ionicons name="call-outline" size={20} color={colors.textSecondary} />}
        />
      </Card>

      {/* 2. ĐỔI MẬT KHẨU */}
      <Card variant="elevated" padding="lg" style={styles.card}>
        <Text style={styles.sectionHeader}>Đổi mật khẩu</Text>
        <Text style={styles.sectionDesc}>
          Để trống nếu bạn không muốn đổi mật khẩu.
        </Text>

        <PasswordInput
          label="Mật khẩu mới"
          placeholder="Tối thiểu 6 ký tự"
          value={newPassword}
          onChangeText={setNewPassword}
          leftIcon={<Ionicons name="key-outline" size={20} color={colors.textSecondary} />}
        />

        <PasswordInput
          label="Xác nhận mật khẩu mới"
          placeholder="Nhập lại mật khẩu mới"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          leftIcon={<Ionicons name="checkmark-circle-outline" size={20} color={colors.textSecondary} />}
        />
      </Card>

      {/* Action Buttons */}
      <View style={styles.btnRow}>
        <Button
          title="Hủy"
          variant="secondary"
          size="lg"
          disabled={updateProfileMutation.isPending}
          onPress={() => router.back()}
          style={styles.cancelBtn}
        />
        <Button
          title="Lưu thay đổi"
          variant="primary"
          size="lg"
          loading={updateProfileMutation.isPending}
          disabled={updateProfileMutation.isPending}
          onPress={handleSaveProfile}
          style={styles.saveBtn}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing['3xl'],
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 2,
  },
});
