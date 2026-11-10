/**
 * Tab Screen - Thông báo (Notifications) - T17, T23
 * Danh sách thông báo cá nhân, đếm số thông báo chưa đọc và đánh dấu đã xem
 * TỐI ƯU HÓA: FlatList virtualization mượt mà.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { NotificationImage } from '../../src/components/common/NotificationImage';
import { EmptyState } from '../../src/components/states/EmptyState';
import {
  useMyNotifications,
  useMarkNotificationSeenMutation,
  useMarkAllNotificationsSeenMutation,
} from '../../src/hooks/useNotificationsData';
import { formatDateTime } from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { NotificationItem } from '../../src/types';

export default function NotificationsScreen() {
  // Queries & Mutations
  const {
    data: notifications = [],
    isLoading: loadingNotifications,
    refetch: refetchNotifications,
  } = useMyNotifications();

  const markSeenMutation = useMarkNotificationSeenMutation();
  const markAllSeenMutation = useMarkAllNotificationsSeenMutation();

  const handleRefresh = async () => {
    await refetchNotifications();
  };

  const handleMarkAsSeen = useCallback(
    (id: number) => {
      markSeenMutation.mutate(id);
    },
    [markSeenMutation]
  );

  const handleMarkAllAsSeen = () => {
    markAllSeenMutation.mutate();
  };

  const unreadCount = notifications.filter((n) => !n.isSeen).length;

  const renderNotificationItem = useCallback(
    ({ item }: { item: NotificationItem }) => {
      const isUnread = !item.isSeen;

      return (
        <Card
          variant="elevated"
          padding="lg"
          onPress={() => handleMarkAsSeen(item.id)}
          style={[styles.notifCard, isUnread && styles.notifCardUnread]}
        >
          <View style={styles.cardRow}>
            {/* Icon */}
            <View
              style={[
                styles.iconCircle,
                isUnread ? styles.iconCircleUnread : styles.iconCircleRead,
              ]}
            >
              <Ionicons
                name={
                  item.type === 'PAYMENT_DUE' || item.type === 'PAYMENT_OVERDUE'
                    ? 'wallet-outline'
                    : item.type === 'APPROVAL'
                    ? 'checkmark-done-circle-outline'
                    : 'information-circle-outline'
                }
                size={20}
                color={isUnread ? colors.primaryDark : colors.textMuted}
              />
            </View>

            {/* Nội dung */}
            <View style={styles.contentCol}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.notifTitle,
                    isUnread && styles.notifTitleUnread,
                  ]}
                >
                  {item.title}
                </Text>
                {isUnread && <View style={styles.unreadDot} />}
              </View>

              <Text style={styles.notifBody}>{item.content}</Text>
              <NotificationImage notification={item} />
              <Text style={styles.notifTime}>{formatDateTime(item.createdAt)}</Text>
            </View>
          </View>
        </Card>
      );
    },
    [handleMarkAsSeen]
  );

  const ListHeader = (
    <Header
      title="Thông báo"
      subtitle={
        unreadCount > 0
          ? `Bạn có ${unreadCount} thông báo mới`
          : 'Hộp thư thông báo của bạn'
      }
      rightAction={
        unreadCount > 0 ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleMarkAllAsSeen}
            style={styles.markAllBtn}
          >
            <Text style={styles.markAllText}>Đã đọc tất cả</Text>
          </TouchableOpacity>
        ) : undefined
      }
    />
  );

  return (
    <ScreenContainer scrollable={false} backgroundColor={colors.background}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNotificationItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            iconName="notifications-off-outline"
            title="Không có thông báo nào"
            description="Bạn đã đọc hết các thông báo từ nhà bếp và quản trị hệ thống."
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshing={loadingNotifications}
        onRefresh={handleRefresh}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing['3xl'],
  },
  markAllBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primary50,
  },
  markAllText: {
    fontSize: typography.sizes.xs,
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
  },
  notifCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  notifCardUnread: {
    backgroundColor: '#FAFDF9',
    borderColor: colors.primaryLight,
    borderWidth: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleUnread: {
    backgroundColor: colors.primaryLight,
  },
  iconCircleRead: {
    backgroundColor: colors.backgroundDark,
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.xs,
  },
  notifBody: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  notifTime: {
    fontSize: typography.sizes['2xs'],
    color: colors.textMuted,
  },
});
