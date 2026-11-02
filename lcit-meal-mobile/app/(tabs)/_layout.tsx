/**
 * Tabs Layout
 * Cấu hình 5 tab chính: Trang chủ, Lịch ăn, Thanh toán, Thông báo, Tài khoản
 * Có badge số thông báo chưa đọc kết nối thực tế với backend (T23), icon rõ ràng và màu xanh lá active.
 */

import React from 'react';
import { Platform, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnseenNotificationCount } from '../../src/hooks/useNotificationsData';
import { colors } from '../../src/theme/colors';
import { useAuth } from '../../src/providers/AuthProvider';
import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';

export default function TabLayout() {
  const { role } = useAuth();
  const { data: unreadCount = 0 } = useUnseenNotificationCount();
  const insets = useSafeAreaInsets();
  const { fontScale } = useResponsiveLayout();

  // Đảm bảo không bị phím điều hướng Android (3 nút hoặc thanh cử chỉ) che mất:
  // - Nếu insets.bottom có giá trị (Android 3 nút ~48dp, cử chỉ ~16-24dp, iOS ~34dp) -> dùng insets.bottom
  // - Nếu insets.bottom = 0 (trên một số dòng Android hoặc ROM tùy biến), đặt đệm an toàn tối thiểu 16dp
  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === 'android' ? 16 : 8
  );
  const tabHeight = 74 + Math.max(0, fontScale - 1) * 32 + bottomInset;
  const tabLabel = (label: string) => function TabLabel({ color }: { color: string }) {
    return (
      <Text style={{ color, fontSize: 11, fontWeight: '600', textAlign: 'center', flexShrink: 1, marginTop: 2 }}>
        {label}
      </Text>
    );
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarActiveBackgroundColor: colors.primary50,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: Platform.OS === 'ios' ? 0 : 2,
        },
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 3,
          marginVertical: 2,
          paddingVertical: 4,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 4,
          elevation: 8,
          shadowColor: colors.primaryDark,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: role === 'manager' ? 'Điều hành bếp' : 'Trang chủ',
          tabBarLabel: tabLabel(role === 'manager' ? 'Điều hành' : 'Trang chủ'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          href: (role === 'kitchen' || role === 'admin') ? null : '/schedule',
          title: role === 'manager' ? 'Lịch bếp' : 'Lịch ăn',
          tabBarLabel: tabLabel(role === 'manager' ? 'Lịch bếp' : 'Lịch ăn'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="payments"
        options={{
          href: (role === 'kitchen' || role === 'admin') ? null : '/payments',
          title: 'Thanh toán',
          tabBarLabel: tabLabel('Thanh toán'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'wallet' : 'wallet-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          href: role === 'kitchen' ? null : '/notifications',
          title: 'Thông báo',
          tabBarLabel: tabLabel('Thông báo'),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.status.cancelled.dot,
            fontSize: 10,
            fontWeight: 'bold',
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Tài khoản',
          tabBarLabel: tabLabel('Tài khoản'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
