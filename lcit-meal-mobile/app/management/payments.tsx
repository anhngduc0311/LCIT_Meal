import { ModalCard } from '../../src/components/common/ModalCard';
import { ModalBackdrop } from '../../src/components/common/ModalBackdrop';
/**
 * Quản lý Thanh Toán Tiền Ăn (Admin & Manager)
 * T31, T36: Danh sách/lọc thanh toán, tạo/sửa khoản thu thủ công, đánh dấu đã thanh toán (kèm chứng từ theo API thực tế)
 * và xuất báo cáo Excel thanh toán.
 * TỐI ƯU HÓA: FlatList virtualization mượt mà & DatePickerInput chọn ngày trực quan.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
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
import { DatePickerInput } from '../../src/components/common/DatePickerInput';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { ForbiddenState } from '../../src/components/states/ForbiddenState';
import { EmptyState } from '../../src/components/states/EmptyState';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  useManagementPayments,
  useCreatePayment,
  useUpdatePayment,
  useMarkPaid,
  useDeletePayment,
} from '../../src/hooks/useManagementPayments';
import { useUsersList } from '../../src/hooks/useManagementUsers';
import { exportService } from '../../src/services/exportService';
import { formatCurrency, formatBusinessDateDisplay } from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { Payment, PaymentStatus } from '../../src/types';
import { MonthlyCollections } from '../../src/components/management/MonthlyCollections';
import { monthRange } from '../../src/utils/monthlyMeals';
import { formatBusinessDate } from '../../src/utils/formatters';

export default function ManagementPaymentsScreen() {
  const router = useRouter();
  const { user, role, isMockMode } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyView, setMonthlyView] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Form states
  const [formUserId, setFormUserId] = useState<number>(0);
  const [formPaymentDate, setFormPaymentDate] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formStatus, setFormStatus] = useState<PaymentStatus>('unpaid');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // Mark-paid form
  const [markPaidAmount, setMarkPaidAmount] = useState('');
  const [markPaidBillImg, setMarkPaidBillImg] = useState('');

  const hasAccess = role === 'admin' || role === 'manager';

  const { data: payments = [], isLoading, refetch } = useManagementPayments();
  const { data: users = [] } = useUsersList();

  const createMutation = useCreatePayment();
  const updateMutation = useUpdatePayment();
  const markPaidMutation = useMarkPaid();
  const deleteMutation = useDeletePayment();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const normalizeSearch = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .trim();

  const filteredPayments = payments.filter((p) => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    if (!searchQuery.trim()) return matchStatus;

    const rawQuery = searchQuery.trim();
    const q = normalizeSearch(rawQuery);
    const cleanQ = q.replace(/^[@#]/, '').replace(/^cb/, '').trim();

    const fullName = normalizeSearch(p.user?.fullName || p.userName || '');
    const username = normalizeSearch(p.user?.username || '');
    const date = p.paymentDate || '';

    const matchQuery =
      fullName.includes(q) ||
      fullName.includes(cleanQ) ||
      (username && (username.includes(q) || username.includes(cleanQ))) ||
      date.includes(rawQuery);

    return matchStatus && matchQuery;
  });

  const selectableUsers = users.filter((u) => {
    if (!userSearchQuery.trim()) return true;
    const q = normalizeSearch(userSearchQuery);
    const cleanQ = q.replace(/^[@#]/, '').replace(/^cb/, '').trim();
    const fullName = normalizeSearch(u.fullName || '');
    const username = normalizeSearch(u.username || '');
    if (fullName.includes(q) || fullName.includes(cleanQ)) return true;
    if (username.includes(q) || username.includes(cleanQ)) return true;
    const words = cleanQ.split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.every((w) => fullName.includes(w) || username.includes(w))) return true;
    if (/^\d+$/.test(cleanQ) && u.id === Number(cleanQ)) return true;
    return false;
  });

  // Calculate totals
  const totalUnpaid = payments
    .filter((p) => p.status === 'unpaid' || p.status === 'overdue')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.paidAmount || p.amount || 0), 0);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await exportService.exportPayments(
        {
          status: statusFilter !== 'all' ? (statusFilter as PaymentStatus) : undefined,
        },
        isMockMode
      );
      if (res.success) {
        Alert.alert('Thành công', res.message || 'Đã xuất file báo cáo thanh toán thành công.');
      } else {
        Alert.alert('Lỗi xuất file', res.message || 'Không thể xuất file.');
      }
    } catch (err: unknown) {
      const error = err as Error;
      Alert.alert('Lỗi', error.message || 'Xuất báo cáo thất bại');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!formUserId || !formPaymentDate.trim() || !formAmount.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn Cán bộ, nhập kỳ thanh toán và số tiền.');
      return;
    }
    await createMutation.mutateAsync({
      userId: formUserId,
      paymentDate: formPaymentDate.trim(),
      amount: parseInt(formAmount, 10) || 0,
      status: formStatus,
    });
    setIsCreateOpen(false);
    setFormUserId(0);
    setFormPaymentDate('');
    setFormAmount('');
  };

  const handleUpdatePayment = async () => {
    if (!selectedPayment) return;
    await updateMutation.mutateAsync({
      id: selectedPayment.id,
      data: {
        paymentDate: formPaymentDate.trim() || undefined,
        amount: parseInt(formAmount, 10) || selectedPayment.amount,
        status: formStatus,
      },
    });
    setIsEditOpen(false);
    setSelectedPayment(null);
  };

  const handleMarkPaid = async () => {
    if (!selectedPayment) return;
    await markPaidMutation.mutateAsync({
      id: selectedPayment.id,
      data: {
        paidAmount: markPaidAmount ? parseInt(markPaidAmount, 10) : selectedPayment.amount,
        billImg: markPaidBillImg.trim() || null,
      },
    });
    setIsMarkPaidOpen(false);
    setSelectedPayment(null);
    setMarkPaidAmount('');
    setMarkPaidBillImg('');
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    await deleteMutation.mutateAsync(deleteTargetId);
    setDeleteTargetId(null);
  };

  const renderPaymentItem = useCallback(
    ({ item: p }: { item: Payment }) => {
      const isPaid = p.status === 'paid' || p.isPaid === 1 || p.isPaid === true;
      return (
        <Card key={p.id} variant="elevated" padding="md" style={styles.paymentCard}>
          <View style={styles.paymentHeader}>
            <View style={styles.userCol}>
              <Text style={styles.userName}>
                {p.user?.fullName || p.userName || 'Cán bộ'}
              </Text>
              <Text style={styles.paymentDate}>
                Kỳ: {formatBusinessDateDisplay(p.paymentDate)}
              </Text>
            </View>
            <Badge
              label={isPaid ? 'Đã thu' : p.status === 'overdue' ? 'Quá hạn' : 'Chưa thu'}
              variant={isPaid ? 'confirmed' : p.status === 'overdue' ? 'cancelled' : 'pending'}
              size="sm"
            />
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Số tiền cần thu:</Text>
            <Text style={styles.amountValue}>{formatCurrency(p.amount)}</Text>
          </View>

          {isPaid && p.paidAmount && (
            <View style={styles.paidInfoRow}>
              <Text style={styles.paidInfoText}>
                Thực thu: <Text style={styles.boldText}>{formatCurrency(p.paidAmount)}</Text>{' '}
                {p.paidAt ? `(${formatBusinessDateDisplay(p.paidAt.slice(0, 10))})` : ''}
              </Text>
              {p.billImg && (
                <Text style={styles.billImgText} numberOfLines={1}>
                  Chứng từ: {p.billImg}
                </Text>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.paymentFooter}>
            <View style={styles.actionBtnsLeft}>
              {!isPaid && (
                <Button
                  title="Xác nhận đã nộp"
                  variant="primary"
                  size="sm"
                  style={styles.markPaidBtn}
                  onPress={() => {
                    setSelectedPayment(p);
                    setMarkPaidAmount(String(p.amount));
                    setMarkPaidBillImg(p.billImg || '');
                    setIsMarkPaidOpen(true);
                  }}
                />
              )}
            </View>

            <View style={styles.actionBtnsRight}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setSelectedPayment(p);
                  setFormPaymentDate(p.paymentDate);
                  setFormAmount(String(p.amount));
                  setFormStatus(p.status);
                  setIsEditOpen(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {role === 'admin' && (
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: '#FEE2E2' }]}
                  onPress={() => setDeleteTargetId(p.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Card>
      );
    },
    [role]
  );

  if (!hasAccess) {
    return (
      <ScreenContainer scrollable={false}>
        <Header title="Quản lý Thu Tiền" showBack onBack={() => router.back()} />
        <ForbiddenState
          title="Không có quyền truy cập"
          message={`Tài khoản (${user?.fullName} - ${role}) không có quyền quản lý tài chính & thanh toán.`}
          onGoBack={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const selectedFormUser = users.find((u) => u.id === formUserId);

  const handleOpenCreateModal = () => {
    if (users.length > 0) setFormUserId(users[0].id);
    const currentMonth = formatBusinessDate(new Date()).slice(0, 7);
    setFormPaymentDate(monthRange(currentMonth).to);
    setFormAmount('');
    setFormStatus('unpaid');
    setUserSearchQuery('');
    setIsUserDropdownOpen(false);
    setIsCreateOpen(true);
  };

  const viewSwitcher = <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
    <Button title="Cuối tháng" size="sm" variant={monthlyView ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={() => setMonthlyView(true)} />
    <Button title="Khoản thu" size="sm" variant={!monthlyView ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={() => setMonthlyView(false)} />
  </View>;

  const pageHeader = <>
      <Header
        title="Quản lý Thu Tiền Ăn"
        subtitle={monthlyView ? 'Tiền cuối tháng từng người · tiền khách tách riêng' : 'Khoản thu đã lập, xác nhận đóng và xuất báo cáo'}
        showBack
        onBack={() => router.back()}
        userRole={role || undefined}
        rightAction={!monthlyView ?
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleExport}
            disabled={isExporting}
            activeOpacity={0.7}
            accessibilityLabel="Xuất báo cáo Excel"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={20} color={colors.primary} />
            )}
          </TouchableOpacity> : undefined
        }
      />
      {viewSwitcher}
    </>;

  const ListHeader = (
    <View>
      {pageHeader}

      {/* Summary KPI Mini */}
      <View style={styles.kpiRow}>
        <Card variant="elevated" padding="sm" style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Chưa thu</Text>
          <Text style={[styles.kpiValue, { color: '#DC2626' }]}>
            {formatCurrency(totalUnpaid)}
          </Text>
        </Card>
        <Card variant="elevated" padding="sm" style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Đã thu</Text>
          <Text style={[styles.kpiValue, { color: '#15803D' }]}>{formatCurrency(totalPaid)}</Text>
        </Card>
      </View>

      {/* Search Input */}
      <View style={styles.searchBarWrapper}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm theo tên cán bộ, kỳ thanh toán..."
          style={styles.searchInput}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Chips */}
      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'unpaid', label: 'Chưa thanh toán' },
            { id: 'paid', label: 'Đã thanh toán' },
            { id: 'overdue', label: 'Quá hạn' },
          ].map((c) => {
            const isSelected = statusFilter === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => setStatusFilter(c.id)}
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
    </View>
  );

  return (
    <ScreenContainer scrollable={false} backgroundColor={colors.background}>
      {monthlyView ? <MonthlyCollections header={pageHeader} onPrepareInvoice={(userId, date, amount) => {
        setFormUserId(userId); setFormPaymentDate(date); setFormAmount(String(amount));
        setFormStatus('unpaid'); setUserSearchQuery(''); setIsUserDropdownOpen(false); setIsCreateOpen(true);
      }} /> : <FlatList
        data={filteredPayments}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPaymentItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            title="Không có khoản thanh toán nào"
            description="Thử thay đổi bộ lọc hoặc bấm nút tạo khoản thu mới ở góc dưới bên phải."
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshing={refreshing || isLoading}
        onRefresh={handleRefresh}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
      />}

      {/* Nút Tạo Khoản Thu ở góc dưới bên phải (Floating Action Button) */}
      {!monthlyView && <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenCreateModal}
        activeOpacity={0.85}
        accessibilityLabel="Tạo khoản thanh toán mới"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={colors.textInverse} />
      </TouchableOpacity>}

      {/* Modal Tạo Khoản Thu - Tích hợp DatePickerInput & Searchable Dropdown */}
      <Modal visible={isCreateOpen} transparent animationType="slide" onRequestClose={() => setIsCreateOpen(false)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo khoản thanh toán mới</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsCreateOpen(false);
                  setIsUserDropdownOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <Text style={styles.formSectionLabel}>1. Chọn Cán bộ:</Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={[styles.dropdownTrigger, isUserDropdownOpen && styles.dropdownTriggerActive]}
                  onPress={() => setIsUserDropdownOpen((prev) => !prev)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Chọn cán bộ"
                >
                  <View style={styles.dropdownTriggerContent}>
                    <View style={styles.dropdownAvatar}>
                      <Ionicons name="person" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.dropdownTextCol}>
                      {selectedFormUser ? (
                        <>
                          <Text style={styles.dropdownSelectedName} numberOfLines={1}>
                            {selectedFormUser.fullName}
                          </Text>
                          <Text style={styles.dropdownSelectedSub} numberOfLines={1}>
                            @{selectedFormUser.username}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.dropdownPlaceholder}>
                          -- Chọn cán bộ cần tạo khoản thu --
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons
                    name={isUserDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {isUserDropdownOpen && (
                  <View style={styles.dropdownListWrapper}>
                    <Input
                      value={userSearchQuery}
                      onChangeText={setUserSearchQuery}
                      placeholder="Tìm theo tên hoặc tài khoản..."
                      autoFocus
                      containerStyle={styles.dropdownSearchInput}
                      leftIcon={<Ionicons name="search" size={16} color={colors.textMuted} />}
                      rightIcon={
                        userSearchQuery ? (
                          <TouchableOpacity onPress={() => setUserSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        ) : undefined
                      }
                    />

                    <ScrollView
                      style={styles.dropdownListScroll}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {selectableUsers.length === 0 ? (
                        <Text style={styles.dropdownEmptyText}>
                          Không tìm thấy cán bộ nào
                        </Text>
                      ) : (
                        selectableUsers.map((u) => {
                          const isSelected = formUserId === u.id;
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                              onPress={() => {
                                setFormUserId(u.id);
                                setIsUserDropdownOpen(false);
                                setUserSearchQuery('');
                              }}
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.dropdownItemAvatar,
                                  isSelected && styles.dropdownItemAvatarSelected,
                                ]}
                              >
                                <Ionicons
                                  name="person"
                                  size={14}
                                  color={isSelected ? colors.surface : colors.textSecondary}
                                />
                              </View>
                              <View style={styles.dropdownItemInfo}>
                                <Text
                                  style={[
                                    styles.dropdownItemName,
                                    isSelected && styles.dropdownItemNameSelected,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {u.fullName}
                                </Text>
                                <Text style={styles.dropdownItemSub} numberOfLines={1}>
                                  @{u.username}
                                </Text>
                              </View>
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <DatePickerInput
                label="Kỳ thanh toán"
                value={formPaymentDate}
                onChangeDate={setFormPaymentDate}
                placeholder="Chọn ngày thanh toán..."
              />

              <Input
                label="Số tiền (VND)"
                value={formAmount}
                onChangeText={setFormAmount}
                placeholder="VD: 660000"
                keyboardType="numeric"
              />

              <View style={styles.modalActionRow}>
                <Button
                  title="Hủy"
                  variant="secondary"
                  onPress={() => {
                    setIsCreateOpen(false);
                    setIsUserDropdownOpen(false);
                  }}
                  style={styles.modalBtnHalf}
                />
                <Button
                  title="Tạo khoản thu"
                  variant="primary"
                  onPress={handleCreatePayment}
                  loading={createMutation.isPending}
                  style={styles.modalBtnHalf}
                />
              </View>
            </ScrollView>
          </View>
        </ModalBackdrop>
      </Modal>

      {/* Modal Sửa Khoản Thu - Tích hợp DatePickerInput */}
      <Modal visible={isEditOpen} transparent animationType="slide" onRequestClose={() => setIsEditOpen(false)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <ModalCard style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sửa khoản thanh toán</Text>
              <TouchableOpacity onPress={() => setIsEditOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <DatePickerInput
              label="Kỳ thanh toán"
              value={formPaymentDate}
              onChangeDate={setFormPaymentDate}
              placeholder="Chọn ngày thanh toán..."
            />

            <Input
              label="Số tiền (VND)"
              value={formAmount}
              onChangeText={setFormAmount}
              keyboardType="numeric"
            />

            <View style={styles.statusSelectRow}>
              {(['unpaid', 'paid', 'overdue'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.statusChip, formStatus === st && styles.statusChipActive]}
                  onPress={() => setFormStatus(st)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      formStatus === st && styles.statusChipTextActive,
                    ]}
                  >
                    {st === 'paid' ? 'Đã thu' : st === 'overdue' ? 'Quá hạn' : 'Chưa thu'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionRow}>
              <Button
                title="Hủy"
                variant="secondary"
                onPress={() => setIsEditOpen(false)}
                style={styles.modalBtnHalf}
              />
              <Button
                title="Lưu"
                variant="primary"
                onPress={handleUpdatePayment}
                loading={updateMutation.isPending}
                style={styles.modalBtnHalf}
              />
            </View>
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* Modal Mark Paid */}
      <Modal visible={isMarkPaidOpen} transparent animationType="slide" onRequestClose={() => setIsMarkPaidOpen(false)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <ModalCard style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xác nhận đã thanh toán</Text>
              <TouchableOpacity onPress={() => setIsMarkPaidOpen(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.markPaidNotice}>
              Khoản thu:{' '}
              <Text style={styles.boldText}>
                {selectedPayment?.user?.fullName || selectedPayment?.userName}
              </Text>{' '}
              · Số tiền:{' '}
              <Text style={[styles.boldText, { color: colors.primaryDark }]}>
                {formatCurrency(selectedPayment?.amount || 0)}
              </Text>
            </Text>

            <Input
              label="Số tiền thực thu (VND)"
              value={markPaidAmount}
              onChangeText={setMarkPaidAmount}
              placeholder="VD: 660000"
              keyboardType="numeric"
            />

            <Input
              label="Mã giao dịch / URL chứng từ (tùy chọn)"
              value={markPaidBillImg}
              onChangeText={setMarkPaidBillImg}
              placeholder="VD: FT26250912345 hoặc URL ảnh biên lai"
            />

            <View style={styles.modalActionRow}>
              <Button
                title="Hủy"
                variant="secondary"
                onPress={() => setIsMarkPaidOpen(false)}
                style={styles.modalBtnHalf}
              />
              <Button
                title="Xác nhận thu tiền"
                variant="primary"
                onPress={handleMarkPaid}
                loading={markPaidMutation.isPending}
                style={styles.modalBtnHalf}
              />
            </View>
          </ModalCard>
        </ModalBackdrop>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        visible={deleteTargetId !== null}
        title="Xóa khoản thanh toán"
        message="Bạn có chắc chắn muốn xóa khoản thanh toán này? Thao tác này không thể hoàn tác."
        confirmText="Xóa"
        cancelText="Hủy"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerBtn: {
    padding: spacing.xs,
  },
  kpiRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  kpiCard: {
    minWidth: 120,
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  kpiValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  searchBarWrapper: {
    position: 'relative',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  searchIcon: {
    position: 'absolute',
    left: 24,
    top: 22,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 34,
    height: 42,
  },
  clearBtn: {
    position: 'absolute',
    right: 24,
    top: 22,
    zIndex: 1,
  },
  chipsRow: {
    paddingVertical: spacing.xs,
  },
  chipsScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundDark,
  },
  chipSelected: {
    backgroundColor: colors.primaryLight,
  },
  chipText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  paymentCard: {
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  userCol: {
    flex: 1,
  },
  userName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  paymentDate: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  amountRow: {
    flexWrap: 'wrap',
    gap: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  amountLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  amountValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.extrabold,
    color: colors.primaryDark,
  },
  paidInfoRow: {
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 4,
  },
  paidInfoText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  billImgText: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  paymentFooter: {
    flexWrap: 'wrap',
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.xs,
  },
  actionBtnsLeft: {
    flex: 1,
  },
  markPaidBtn: {
    height: 30,
    alignSelf: 'flex-start',
    minWidth: 120,
  },
  actionBtnsRight: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 30,
    height: 30,
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
  markPaidNotice: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  formSectionLabel: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 6,
  },
  dropdownContainer: {
    marginBottom: spacing.md,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
  },
  dropdownTriggerActive: {
    borderColor: colors.primary,
  },
  dropdownTriggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  dropdownAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  dropdownTextCol: {
    flex: 1,
  },
  dropdownSelectedName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  dropdownSelectedSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  dropdownPlaceholder: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  dropdownListWrapper: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownSearchInput: {
    marginBottom: spacing.xs,
  },
  dropdownListScroll: {
    maxHeight: 180,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  dropdownItemSelected: {
    backgroundColor: '#F0FDF4',
  },
  dropdownItemAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  dropdownItemAvatarSelected: {
    backgroundColor: colors.primary,
  },
  dropdownItemInfo: {
    flex: 1,
  },
  dropdownItemName: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  dropdownItemNameSelected: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  dropdownItemSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  dropdownEmptyText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  statusSelectRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.backgroundDark,
  },
  statusChipActive: {
    backgroundColor: colors.primaryLight,
  },
  statusChipText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusChipTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
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
