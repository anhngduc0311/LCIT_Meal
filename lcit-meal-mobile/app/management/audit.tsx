import { ModalBackdrop } from '../../src/components/common/ModalBackdrop';
/**
 * Nhật Ký Hệ Thống / Audit Logs (Admin Only)
 * T35: Danh sách, bộ lọc, chi tiết actor/action/target/result; chỉ đọc.
 * TỐI ƯU HÓA: FlatList virtualization mượt mà.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
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
import { ForbiddenState } from '../../src/components/states/ForbiddenState';
import { EmptyState } from '../../src/components/states/EmptyState';
import { useAuth } from '../../src/providers/AuthProvider';
import { useAuditLogs } from '../../src/hooks/useAuditLogs';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { AuditLogItem } from '../../src/types';

export default function ManagementAuditScreen() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = role === 'admin';

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const { data: logs = [], isLoading, refetch } = useAuditLogs();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredLogs = logs.filter((l) => {
    const action = String(l?.logAction || (l as any)?.log_action || '').toLowerCase();
    const matchAction =
      actionFilter === 'all' ||
      (actionFilter === 'create' && (action.includes('create') || action.includes('tạo') || action.includes('sinh') || action.includes('restore') || action.includes('mở'))) ||
      (actionFilter === 'update' && (action.includes('update') || action.includes('sửa') || action.includes('cập nhật') || action.includes('setting') || action.includes('cấu hình'))) ||
      (actionFilter === 'delete' && (action.includes('delete') || action.includes('xóa') || action.includes('hủy') || action.includes('cancel'))) ||
      (actionFilter === 'approve' && (action.includes('approve') || action.includes('duyệt'))) ||
      (actionFilter === 'payment' && (action.includes('paid') || action.includes('payment') || action.includes('tiền')));

    if (!searchQuery.trim()) {
      return matchAction;
    }

    const q = searchQuery.toLowerCase();
    const actorName = String(l?.actorName || (l as any)?.actor_name || '').toLowerCase();
    const actorUsername = String(l?.actorUsername || (l as any)?.actor_username || '').toLowerCase();
    const logDetail = String(l?.logDetail || (l as any)?.log_detail || '').toLowerCase();
    const logTarget = String(l?.logTarget || (l as any)?.log_target || '').toLowerCase();

    const matchQuery =
      actorName.includes(q) ||
      actorUsername.includes(q) ||
      logDetail.includes(q) ||
      logTarget.includes(q) ||
      action.includes(q);

    return matchAction && matchQuery;
  });

  const getActionBadge = (rawAction?: string) => {
    const action = String(rawAction || '').toLowerCase();
    if (action.includes('create') || action.includes('restore') || action.includes('tạo') || action.includes('mở') || action.includes('sinh')) {
      return <Badge label="Tạo mới / Mở" variant="confirmed" size="sm" />;
    }
    if (action.includes('update') || action.includes('setting') || action.includes('sửa') || action.includes('cập nhật') || action.includes('cấu hình')) {
      return <Badge label="Cập nhật" variant="warning" size="sm" />;
    }
    if (action.includes('delete') || action.includes('cancel') || action.includes('xóa') || action.includes('hủy')) {
      return <Badge label="Xóa / Hủy" variant="cancelled" size="sm" />;
    }
    if (action.includes('approve') || action.includes('duyệt')) {
      return <Badge label="Phê duyệt" variant="confirmed" size="sm" />;
    }
    if (action.includes('paid') || action.includes('thu tiền') || action.includes('payment')) {
      return <Badge label="Thu tiền" variant="completed" size="sm" />;
    }
    return <Badge label={rawAction || 'Thao tác'} variant="confirmed" size="sm" />;
  };

  const renderAuditItem = useCallback(
    ({ item: log }: { item: AuditLogItem }) => {
      const actionName = log?.logAction || (log as any)?.log_action || '';
      const actorDisplayName = log?.actorName || (log as any)?.actor_name || 'Hệ thống';
      const actorUser = log?.actorUsername
        ? `@${log.actorUsername}`
        : (log?.actorName || (log as any)?.actor_name ? '' : 'System');
      const detailText = log?.logDetail || (log as any)?.log_detail || actionName || 'Thao tác hệ thống';
      const targetText = log?.logTarget || (log as any)?.log_target || 'N/A';
      const timeRaw = log?.createdAt || (log as any)?.log_time || '';
      const timeText = timeRaw ? String(timeRaw).replace('T', ' ').substring(0, 19) : '';

      return (
        <Card
          variant="elevated"
          padding="md"
          style={styles.logCard}
          onPress={() => setSelectedLog(log)}
        >
          <View style={styles.logHeader}>
            <View style={styles.actorCol}>
              <Text style={styles.actorName}>{actorDisplayName}</Text>
              {actorUser ? <Text style={styles.actorUser}>{actorUser}</Text> : null}
            </View>
            {getActionBadge(actionName)}
          </View>

          <Text style={styles.logDetailText}>{detailText}</Text>

          <View style={styles.logFooter}>
            <Text style={styles.logMetaText}>
              Đối tượng: <Text style={styles.boldText}>{targetText}</Text>
            </Text>
            <Text style={styles.logTimeText}>{timeText}</Text>
          </View>
        </Card>
      );
    },
    []
  );

  if (!isAdmin) {
    return (
      <ScreenContainer scrollable={false}>
        <Header title="Nhật ký hệ thống" showBack onBack={() => router.back()} />
        <ForbiddenState
          title="Chỉ dành cho Quản trị viên"
          message={`Tài khoản (${user?.fullName} - ${role}) không có quyền xem nhật ký thao tác hệ thống.`}
          onGoBack={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const ListHeader = (
    <View style={styles.headerContainer}>
      <Header
        title="Nhật ký Hệ thống (Audit Logs)"
        subtitle="Theo dõi và tra cứu toàn bộ lịch sử thao tác"
        showBack
        onBack={() => router.back()}
        userRole={role || undefined}
      />

      {/* Search Bar */}
      <View style={styles.searchBarWrapper}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm theo người thực hiện, đối tượng, mô tả..."
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
            { id: 'create', label: 'Tạo mới' },
            { id: 'update', label: 'Chỉnh sửa' },
            { id: 'approve', label: 'Phê duyệt' },
            { id: 'payment', label: 'Thanh toán' },
            { id: 'delete', label: 'Xóa / Hủy' },
          ].map((c) => {
            const isSelected = actionFilter === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => setActionFilter(c.id)}
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
      <FlatList
        data={filteredLogs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderAuditItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            title="Không có nhật ký nào"
            description="Không tìm thấy bản ghi nhật ký phù hợp với bộ lọc."
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshing={refreshing || isLoading}
        onRefresh={handleRefresh}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Modal Chi tiết Audit Log */}
      <Modal visible={!!selectedLog} transparent animationType="fade" onRequestClose={() => setSelectedLog(null)}>
        <ModalBackdrop style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết Nhật ký #{selectedLog?.id}</Text>
              <TouchableOpacity onPress={() => setSelectedLog(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hành động</Text>
                <Text style={styles.detailValue}>{selectedLog?.logAction || (selectedLog as any)?.log_action || 'N/A'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Người thực hiện</Text>
                <Text style={styles.detailValue}>
                  {selectedLog?.actorName || (selectedLog as any)?.actor_name || 'Hệ thống'}
                  {selectedLog?.actorUsername ? ` (@${selectedLog.actorUsername})` : ''}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Đối tượng tác động</Text>
                <Text style={styles.detailValue}>{selectedLog?.logTarget || (selectedLog as any)?.log_target || 'N/A'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Thời gian</Text>
                <Text style={styles.detailValue}>
                  {selectedLog?.createdAt
                    ? String(selectedLog.createdAt).replace('T', ' ').substring(0, 19)
                    : (selectedLog as any)?.log_time
                    ? String((selectedLog as any).log_time).replace('T', ' ').substring(0, 19)
                    : 'N/A'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Địa chỉ IP</Text>
                <Text style={styles.detailValue}>{selectedLog?.ipAddress || '127.0.0.1'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Mô tả chi tiết</Text>
                <Text style={styles.detailValue}>{selectedLog?.logDetail}</Text>
              </View>

            </ScrollView>

            <Button
              title="Đóng"
              variant="secondary"
              size="md"
              onPress={() => setSelectedLog(null)}
              style={styles.closeBtn}
            />
          </View>
        </ModalBackdrop>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: spacing.xs,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
    paddingHorizontal: spacing.md,
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
  logCard: {
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  actorCol: {
    flex: 1,
  },
  actorName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  actorUser: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  logDetailText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    marginVertical: 4,
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 4,
  },
  logMetaText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  logTimeText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  boldText: {
    fontWeight: typography.weights.bold,
    color: colors.text,
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
  detailRow: {
    marginBottom: spacing.xs,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    marginTop: 2,
    fontWeight: typography.weights.medium,
  },
  closeBtn: {
    marginTop: spacing.md,
  },
});
