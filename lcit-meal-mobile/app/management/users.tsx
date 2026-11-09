import { ModalCard } from '../../src/components/common/ModalCard';
import { ModalBackdrop } from '../../src/components/common/ModalBackdrop';
/**
 * Quản lý Người Dùng & Vai Trò (Admin & Manager)
 * T32: Danh sách người dùng cho manager/admin; tạo/sửa/trạng thái/role chỉ cho admin;
 * hoàn thiện validation và kiểm tra trùng username.
 * TỐI ƯU HÓA: FlatList virtualization mượt mà.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
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
import { PasswordInput } from '../../src/components/common/PasswordInput';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { ForbiddenState } from '../../src/components/states/ForbiddenState';
import { EmptyState } from '../../src/components/states/EmptyState';
import { ErrorState } from '../../src/components/states/ErrorState';
import { LoadingState } from '../../src/components/states/LoadingState';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  useUsersList,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from '../../src/hooks/useManagementUsers';
import { userService } from '../../src/services/userService';
import { extractUserRole } from '../../src/types/auth';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { User, UserRole } from '../../src/types';
import { FacilitySelector } from '../../src/components/common/FacilitySelector';
import { useFacilities } from '../../src/hooks/useFacilities';
import { FacilityFilter, facilityLabel, getFacility, matchesFacility } from '../../src/utils/facilities';

const ACTIVE_USER_STATUS = '1';
const LOCKED_USER_STATUS = '2';

function normalizeUserStatus(status: User['status']) {
  const value = String(status);
  if (value === 'active' || value === 'acitve') return ACTIVE_USER_STATUS;
  if (value === 'locked') return LOCKED_USER_STATUS;
  return value;
}

export default function ManagementUsersScreen() {
  const router = useRouter();
  const { user: currentUser, role, isMockMode } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = role === 'admin';
  const hasAccess = role === 'admin' || role === 'manager';

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [facilityFilter, setFacilityFilter] = useState<FacilityFilter>(1);
  const { overrides, assignment, isLoading: loadingFacilities } = useFacilities();
  const [facilityTarget, setFacilityTarget] = useState<User | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Form states
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRoleId, setFormRoleId] = useState<number>(3); // Default 3: employee
  const [formStatus, setFormStatus] = useState<string>(ACTIVE_USER_STATUS);

  // Username validation state
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const { data: users = [], isLoading, isError, refetch } = useUsersList();

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  // Check username availability when typing in create modal
  useEffect(() => {
    if (!isCreateOpen || !formUsername.trim()) {
      const resetTimer = setTimeout(() => {
        setUsernameError('');
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    if (formUsername.includes(' ')) {
      const errTimer = setTimeout(() => {
        setUsernameError('Tên đăng nhập không được chứa dấu cách');
      }, 0);
      return () => clearTimeout(errTimer);
    }

    if (formUsername.length < 3) {
      const errTimer = setTimeout(() => {
        setUsernameError('Tên đăng nhập tối thiểu 3 ký tự');
      }, 0);
      return () => clearTimeout(errTimer);
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const res = await userService.checkAvailability(formUsername.trim(), undefined, isMockMode);
        if (!res.available) {
          setUsernameError(res.message || 'Tên đăng nhập đã tồn tại trong hệ thống');
        } else {
          setUsernameError('');
        }
      } catch {
        setUsernameError('');
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formUsername, isCreateOpen, isMockMode]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const userRole = extractUserRole(u);
    const matchRole = roleFilter === 'all' || userRole === roleFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchQuery =
      !searchQuery ||
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q));
    return matchRole && matchQuery && matchesFacility(getFacility(u, overrides), facilityFilter);
  });
  const roleCounts = filteredUsers.reduce<Record<UserRole, number>>((counts, user) => {
    counts[extractUserRole(user)] += 1;
    return counts;
  }, { employee: 0, kitchen: 0, manager: 0, admin: 0 });
  const peopleSummary = ([
    ['employee', 'cán bộ'], ['kitchen', 'bếp'], ['manager', 'quản lý'], ['admin', 'admin'],
  ] as const).filter(([role]) => roleCounts[role] > 0)
    .map(([role, label]) => `${roleCounts[role]} ${label}`).join(' · ') || '0 tài khoản';

  const handleCreateUser = async () => {
    if (!formFullName.trim() || !formUsername.trim() || !formPassword.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Họ tên, Tên đăng nhập và Mật khẩu.');
      return;
    }
    if (usernameError) {
      Alert.alert('Lỗi tên đăng nhập', usernameError);
      return;
    }

    try {
      await createMutation.mutateAsync({
        fullName: formFullName.trim(),
        username: formUsername.trim(),
        password: formPassword.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        roleId: formRoleId,
        status: ACTIVE_USER_STATUS,
      });
      setIsCreateOpen(false);
      setFormFullName('');
      setFormUsername('');
      setFormPassword('');
      setFormEmail('');
      setFormPhone('');
    } catch (err: unknown) {
      const error = err as Error;
      Alert.alert('Lỗi tạo người dùng', error.message || 'Thao tác thất bại');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await updateMutation.mutateAsync({
        id: selectedUser.id,
        data: {
          fullName: formFullName.trim() || undefined,
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          roleId: formRoleId,
          status: formStatus,
          password: formPassword.trim() || undefined,
        },
      });
      setIsEditOpen(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      const error = err as Error;
      Alert.alert('Lỗi cập nhật', error.message || 'Thao tác thất bại');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTargetId) return;
    await deleteMutation.mutateAsync(deleteTargetId);
    setDeleteTargetId(null);
  };

  const getRoleBadgeVariant = (userRole: UserRole) => {
    switch (userRole) {
      case 'admin':
        return 'danger';
      case 'manager':
        return 'warning';
      case 'kitchen':
        return 'completed';
      default:
        return 'confirmed';
    }
  };

  const getRoleDisplayName = (userRole: UserRole) => {
    switch (userRole) {
      case 'admin':
        return 'Quản trị viên';
      case 'manager':
        return 'Quản lý bếp';
      case 'kitchen':
        return 'Nhân viên bếp';
      default:
        return 'Cán bộ nhân viên';
    }
  };

  const renderUserItem = useCallback(
    ({ item: u }: { item: User }) => {
      const userRole = extractUserRole(u);
      const isActive = normalizeUserStatus(u.status) === ACTIVE_USER_STATUS;
      return (
        <Card key={u.id} variant="elevated" padding="md" style={styles.userCard}>
          <View style={styles.userHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{u.fullName.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase()}</Text>
            </View>

            <View style={styles.userInfoCol}>
              <Text style={styles.fullNameText}>{u.fullName}</Text>
              <Text style={styles.usernameText}>@{u.username}</Text>
            </View>

            <View style={styles.badgesCol}>
              <Text style={[styles.statusPill, !isActive && styles.statusLocked]}>{isActive ? 'Hoạt động' : 'Đã khóa'}</Text>
            </View>
          </View>
          <View style={styles.identityRow}>
            <Badge label={getRoleDisplayName(userRole)} variant={getRoleBadgeVariant(userRole)} size="sm" />
            <Text style={styles.metaText}><Ionicons name="business-outline" size={13} /> {facilityLabel(getFacility(u, overrides))}</Text>
            {u.id === currentUser?.id && <Text style={styles.selfLabel}>Bạn</Text>}
          </View>

          {/* Contact info */}
          {(u.phone || u.email) && <View style={styles.metaRow}>
            {u.phone && (
              <Text style={styles.metaText}>
                <Ionicons name="call-outline" size={12} color={colors.textMuted} /> {u.phone}
              </Text>
            )}
            {u.email && (
              <Text style={styles.metaText}>
                <Ionicons name="mail-outline" size={12} color={colors.textMuted} /> {u.email}
              </Text>
            )}
          </View>}

          {/* Admin Actions */}
          {isAdmin && (
            <View style={styles.userFooter}>
              <TouchableOpacity style={styles.actionBtnSmall} accessibilityRole="button" accessibilityLabel={`Phân cơ sở cho ${u.fullName}`} accessibilityState={{ disabled: loadingFacilities }} disabled={loadingFacilities} onPress={() => setFacilityTarget(u)}>
                <Ionicons name="business-outline" size={16} color={loadingFacilities ? colors.textMuted : colors.primary} />
                <Text style={styles.actionBtnText}>Phân cơ sở</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSmall}
                accessibilityRole="button"
                accessibilityLabel={`Chỉnh sửa ${u.fullName}`}
                onPress={() => {
                  setSelectedUser(u);
                  setFormFullName(u.fullName);
                  setFormEmail(u.email || '');
                  setFormPhone(u.phone || '');
                  setFormStatus(normalizeUserStatus(u.status));
                  const rId =
                    userRole === 'admin' ? 1 : userRole === 'manager' ? 2 : userRole === 'kitchen' ? 4 : 3;
                  setFormRoleId(rId);
                  setFormPassword('');
                  setIsEditOpen(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={16} color={colors.primary} />
                <Text style={styles.actionBtnText}>Chỉnh sửa</Text>
              </TouchableOpacity>

              {u.id !== currentUser?.id && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Xóa tài khoản ${u.fullName}`}
                  onPress={() => setDeleteTargetId(u.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </Card>
      );
    },
    [isAdmin, currentUser?.id, overrides, loadingFacilities]
  );

  if (!hasAccess) {
    return (
      <ScreenContainer scrollable={false}>
        <Header title="Người Dùng & Vai Trò" showBack onBack={() => router.back()} />
        <ForbiddenState
          title="Không có quyền truy cập"
          message={`Tài khoản (${currentUser?.fullName} - ${role}) không có quyền quản trị người dùng.`}
          onGoBack={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const handleOpenCreateModal = () => {
    setFormFullName('');
    setFormUsername('');
    setFormPassword('123456');
    setFormEmail('');
    setFormPhone('');
    setFormRoleId(3);
    setFormStatus(ACTIVE_USER_STATUS);
    setUsernameError('');
    setIsCreateOpen(true);
  };

  const ListHeader = (
    <View>
      <Header
        title="Người dùng"
        subtitle={isAdmin ? 'Tài khoản & phân quyền' : 'Danh sách cán bộ · Chỉ xem'}
        showBack
        onBack={() => router.back()}
        rightAction={isAdmin ? (
          <TouchableOpacity style={styles.addButton} onPress={handleOpenCreateModal} accessibilityRole="button" accessibilityLabel="Thêm người dùng mới">
            <Ionicons name="add" size={20} color={colors.textInverse} />
            <Text style={styles.addButtonText}>Thêm</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {/* Search Input */}
      <View style={styles.searchBarWrapper}>
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm tên, tài khoản, SĐT, email"
          accessibilityLabel="Tìm kiếm người dùng"
          autoCapitalize="none"
          containerStyle={{ marginBottom: 0 }}
          inputStyle={{ fontSize: 14 }}
          leftIcon={<Ionicons name="search-outline" size={20} color={colors.textSecondary} />}
          rightIcon={searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Xóa từ khóa tìm kiếm">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : undefined}
        />
      </View>
      <FacilitySelector value={facilityFilter} onChange={setFacilityFilter} style={{ marginVertical: 8 }} />

      {/* Role Filter Chips */}
      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'admin', label: 'Admin' },
            { id: 'manager', label: 'Quản lý' },
            { id: 'employee', label: 'Cán bộ' },
            { id: 'kitchen', label: 'Bếp' },
          ].map((c) => {
            const isSelected = roleFilter === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => setRoleFilter(c.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>{isLoading || loadingFacilities ? 'Đang tải danh sách…' : isError ? 'Chưa tải được danh sách' : `${peopleSummary} · ${facilityLabel(facilityFilter)}`}</Text>
        {(searchQuery || roleFilter !== 'all' || facilityFilter !== 'all') && (
          <TouchableOpacity style={styles.resetButton} accessibilityRole="button" onPress={() => { setSearchQuery(''); setRoleFilter('all'); setFacilityFilter('all'); }}>
            <Text style={styles.actionBtnText}>Bỏ lọc</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <ScreenContainer scrollable={false} backgroundColor={colors.background}>
      <FlatList
        data={loadingFacilities ? [] : filteredUsers}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderUserItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          isLoading || loadingFacilities ? <LoadingState message="Đang tải người dùng…" /> : isError ? <ErrorState title="Chưa tải được người dùng" onRetry={handleRefresh} /> : <EmptyState
            title="Không tìm thấy người dùng nào"
            description="Thử đổi từ khóa, vai trò hoặc chọn cơ sở khác."
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshing={refreshing || isLoading}
        onRefresh={handleRefresh}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
      />

      <Modal visible={facilityTarget !== null} transparent animationType="fade" onRequestClose={() => { if (!assignment.isPending) setFacilityTarget(null); }}>
        <ModalBackdrop style={styles.modalOverlay}>
          <ModalCard style={styles.modalDialog}>
            <Text style={styles.fullNameText}>Phân cơ sở · {facilityTarget?.fullName}</Text>
            <Text style={styles.metaText}>Lưu trên thiết bị này. Khách đi kèm được tính cùng cơ sở của cán bộ.</Text>
            <FacilitySelector disabled={assignment.isPending}
              value={facilityTarget ? getFacility(facilityTarget, overrides) ?? 'unassigned' : 'unassigned'}
              onChange={async value => {
                if (!facilityTarget || value === 'all') return;
                try {
                  await assignment.mutateAsync({ person: facilityTarget, facilityId: value === 'unassigned' ? null : value });
                  setFacilityTarget(null);
                } catch { /* Keep the dialog open and show the error below. */ }
              }} />
            {assignment.isError && <Text style={styles.metaText}>Chưa lưu được phân cơ sở. Vui lòng thử lại.</Text>}
            <Button title="Đóng" variant="secondary" disabled={assignment.isPending} onPress={() => { assignment.reset(); setFacilityTarget(null); }} />
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* Modal Thêm Người Dùng Mới (Admin only) */}
      <Modal visible={isCreateOpen} transparent animationType="slide" onRequestClose={() => setIsCreateOpen(false)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo tài khoản người dùng mới</Text>
              <TouchableOpacity style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel="Đóng biểu mẫu tạo tài khoản" onPress={() => setIsCreateOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input
                label="Họ và tên cán bộ (bắt buộc)"
                value={formFullName}
                onChangeText={setFormFullName}
                placeholder="VD: Nguyễn Văn Nam"
              />

              <Input
                label="Tên đăng nhập (bắt buộc)"
                value={formUsername}
                onChangeText={setFormUsername}
                placeholder="VD: nam_nv"
                autoCapitalize="none"
              />
              {usernameError ? (
                <Text style={styles.errorText}>{usernameError}</Text>
              ) : isCheckingUsername ? (
                <Text style={styles.checkingText}>Đang kiểm tra tên đăng nhập...</Text>
              ) : null}

              <PasswordInput
                label="Mật khẩu khởi tạo"
                value={formPassword}
                onChangeText={setFormPassword}
                placeholder="Nhập mật khẩu..."
              />

              <Text style={styles.sectionLabel}>Phân quyền vai trò:</Text>
              <View style={styles.rolePickerRow}>
                {[
                  { id: 3, label: 'Cán bộ (Employee)' },
                  { id: 2, label: 'Quản lý (Manager)' },
                  { id: 1, label: 'Admin' },
                  { id: 4, label: 'Bếp (Kitchen)' },
                ].map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleChip, formRoleId === r.id && styles.roleChipActive]}
                    onPress={() => setFormRoleId(r.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        formRoleId === r.id && styles.roleChipTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Số điện thoại (tùy chọn)"
                value={formPhone}
                onChangeText={setFormPhone}
                placeholder="0901234567"
                keyboardType="phone-pad"
              />

              <Input
                label="Email (tùy chọn)"
                value={formEmail}
                onChangeText={setFormEmail}
                placeholder="nam.nv@lcit.vn"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.modalActionRow}>
                <Button
                  title="Hủy"
                  variant="secondary"
                  onPress={() => setIsCreateOpen(false)}
                  style={styles.modalBtnHalf}
                />
                <Button
                  title="Tạo tài khoản"
                  variant="primary"
                  onPress={handleCreateUser}
                  loading={createMutation.isPending}
                  style={styles.modalBtnHalf}
                />
              </View>
            </ScrollView>
          </View>
        </ModalBackdrop>
      </Modal>

      {/* Modal Sửa Người Dùng (Admin only) */}
      <Modal visible={isEditOpen} transparent animationType="slide" onRequestClose={() => setIsEditOpen(false)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chỉnh sửa tài khoản</Text>
              <TouchableOpacity style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel="Đóng biểu mẫu chỉnh sửa" onPress={() => setIsEditOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.usernameInfo}>
                Tài khoản: <Text style={styles.boldText}>@{selectedUser?.username}</Text>
              </Text>

              <Input
                label="Họ và tên cán bộ"
                value={formFullName}
                onChangeText={setFormFullName}
              />

              <Text style={styles.sectionLabel}>Phân quyền vai trò:</Text>
              <View style={styles.rolePickerRow}>
                {[
                  { id: 3, label: 'Cán bộ (Employee)' },
                  { id: 2, label: 'Quản lý (Manager)' },
                  { id: 1, label: 'Admin' },
                  { id: 4, label: 'Bếp (Kitchen)' },
                ].map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleChip, formRoleId === r.id && styles.roleChipActive]}
                    onPress={() => setFormRoleId(r.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        formRoleId === r.id && styles.roleChipTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Trạng thái tài khoản:</Text>
              <View style={styles.statusRow}>
                {[
                  { id: ACTIVE_USER_STATUS, label: 'Hoạt động' },
                  { id: LOCKED_USER_STATUS, label: 'Khóa tài khoản' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.roleChip, formStatus === s.id && styles.roleChipActive]}
                    onPress={() => setFormStatus(s.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        formStatus === s.id && styles.roleChipTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <PasswordInput
                label="Đặt lại mật khẩu mới (nếu cần)"
                value={formPassword}
                onChangeText={setFormPassword}
                placeholder="Để trống nếu không đổi"
              />

              <Input
                label="Số điện thoại"
                value={formPhone}
                onChangeText={setFormPhone}
                keyboardType="phone-pad"
              />

              <Input
                label="Email"
                value={formEmail}
                onChangeText={setFormEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.modalActionRow}>
                <Button
                  title="Hủy"
                  variant="secondary"
                  onPress={() => setIsEditOpen(false)}
                  style={styles.modalBtnHalf}
                />
                <Button
                  title="Lưu thay đổi"
                  variant="primary"
                  onPress={handleUpdateUser}
                  loading={updateMutation.isPending}
                  style={styles.modalBtnHalf}
                />
              </View>
            </ScrollView>
          </View>
        </ModalBackdrop>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        visible={deleteTargetId !== null}
        title="Xóa tài khoản người dùng"
        message="Bạn có chắc chắn muốn xóa tài khoản này? Hành động này sẽ loại bỏ quyền truy cập của người dùng."
        confirmText="Xóa tài khoản"
        cancelText="Hủy"
        variant="danger"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTargetId(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 2,
    paddingBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: colors.textInverse, fontSize: 13, fontWeight: '600' },
  avatarText: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
  identityRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  selfLabel: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  statusPill: { color: '#166534', backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 11, fontWeight: '600' },
  statusLocked: { color: '#991B1B', backgroundColor: '#FEF2F2' },
  resultsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, marginBottom: 4 },
  resultsText: { flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  resetButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  searchBarWrapper: {
    marginTop: 4,
  },
  clearBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    paddingVertical: spacing.xs,
  },
  chipsScroll: {
    gap: 6,
  },
  chip: {
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.textInverse,
    fontWeight: typography.weights.bold,
  },
  userCard: {
    marginBottom: 10,
    padding: 14,
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: colors.surface,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  userInfoCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  fullNameText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  usernameText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 1,
  },
  badgesCol: {
    alignItems: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: 6,
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  userFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 10,
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  actionBtnText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
  },
  deleteBtn: {
    width: 44,
    height: 44,
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
    maxWidth: 540,
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
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  usernameInfo: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  rolePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  roleChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.backgroundDark,
  },
  roleChipActive: {
    backgroundColor: colors.primaryLight,
  },
  roleChipText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  roleChipTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  errorText: {
    fontSize: 10,
    color: '#DC2626',
    marginTop: -8,
    marginBottom: spacing.xs,
    marginLeft: 2,
  },
  checkingText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: -8,
    marginBottom: spacing.xs,
    marginLeft: 2,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalBtnHalf: {
    flex: 1,
  },
  boldText: {
    fontWeight: typography.weights.bold,
  },
});
