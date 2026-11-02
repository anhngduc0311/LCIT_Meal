import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/providers/AuthProvider';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Button } from '../../src/components/common/Button';
import { EmptyState } from '../../src/components/states/EmptyState';
import { ErrorState } from '../../src/components/states/ErrorState';
import { LoadingState } from '../../src/components/states/LoadingState';
import { ForbiddenState } from '../../src/components/states/ForbiddenState';
import { useMealGuestCounts, useManagementMeals } from '../../src/hooks/useManagementMeals';
import { useSystemSettings } from '../../src/hooks/useManagementSettings';
import { monthRange, shiftMonth } from '../../src/utils/monthlyMeals';
import { formatBusinessDate, formatCurrency, formatDisplayDate } from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';

export default function GuestPaymentsScreen() {
  const { role } = useAuth();
  return role === 'admin' || role === 'manager' ? <GuestBoard /> : <ScreenContainer><ForbiddenState /></ScreenContainer>;
}

function GuestBoard() {
  const router = useRouter();
  const today = formatBusinessDate(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [facility, setFacility] = useState<1 | 2>(1);
  const range = monthRange(month);
  const guests = useMealGuestCounts({ from: range.from, to: range.to });
  const meals = useManagementMeals({ from: range.from, to: range.to });
  const settings = useSystemSettings();
  const queries = [guests, meals, settings];
  const loading = queries.some(q => q.isLoading);
  const error = queries.find(q => q.error)?.error;
  const rawPrice = settings.data?.find(s => s.settingKey === 'guest_meal_price')?.settingValue;
  const price = rawPrice === undefined ? NaN : Number(rawPrice);
  const priceReady = Number.isFinite(price) && price >= 0;
  const rows = (guests.data || []).filter(g => g.facilityId === facility && g.guestCount > 0
    && meals.data?.some(m => m.id === g.mealId && m.status === 'active' && !m.isCancelled))
    .sort((a, b) => b.mealDate.localeCompare(a.mealDate));
  const count = rows.reduce((sum, row) => sum + Number(row.guestCount), 0);
  const ready = !loading && !error && priceReady;
  const refresh = async () => { await Promise.all(queries.map(q => q.refetch())); };
  const editGuests = (date: string) => router.push({ pathname: '/management/monthly', params: { date, facility: String(facility) } });
  return <ScreenContainer scrollable={false}>
    <FlatList data={ready ? rows : []} keyExtractor={row => `${row.mealId}:${row.facilityId}`}
      contentContainerStyle={styles.content} refreshing={queries.some(q => q.isRefetching)} onRefresh={() => { void refresh(); }}
      ListHeaderComponent={<View style={styles.header}>
        <Header title="Tiền khách" subtitle="Suất khách thêm riêng theo cơ sở" showBack onBack={() => router.back()} />
        <View style={styles.monthRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tháng trước" style={styles.arrow} onPress={() => setMonth(shiftMonth(month, -1))}><Ionicons name="chevron-back" size={22} color={colors.primary} /></TouchableOpacity>
          <Text style={styles.title}>Tháng {month.slice(5)}/{month.slice(0, 4)}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tháng sau" style={styles.arrow} onPress={() => setMonth(shiftMonth(month, 1))}><Ionicons name="chevron-forward" size={22} color={colors.primary} /></TouchableOpacity>
        </View>
        <View style={styles.monthRow}>{([1, 2] as const).map(value => <Button key={value} title={`Cơ sở ${value}`} size="sm"
          variant={facility === value ? 'primary' : 'secondary'} style={{ flex: 1 }}
          accessibilityState={{ selected: facility === value }} onPress={() => setFacility(value)} />)}</View>
        {loading ? <LoadingState /> : error || !priceReady ? <ErrorState message={error instanceof Error ? error.message : 'Chưa cấu hình đơn giá suất khách.'} onRetry={() => { void refresh(); }} /> : <Card padding="lg" style={styles.summary}>
          <Text style={styles.title}>Cơ sở {facility} · {count} suất khách</Text>
          <Text style={styles.amount}>{formatCurrency(count * price)}</Text>
          <Text style={styles.hint}>Đơn giá {formatCurrency(price)}/suất. Theo dõi riêng, không cộng vào tiền cán bộ. Ngày bếp nghỉ được loại khỏi tổng tiền.</Text>
        </Card>}
        <Button title="Điều chỉnh suất khách" variant="outline" onPress={() => editGuests(today.slice(0, 7) === month ? today : range.from)} />
        <Text style={styles.title}>Chi tiết theo ngày</Text>
      </View>}
      ListEmptyComponent={ready ? <EmptyState title="Chưa có suất khách thêm riêng" description="Chọn Điều chỉnh suất khách để thêm hoặc bớt theo ngày." /> : null}
      renderItem={({ item }) => <Card padding="md" style={styles.day}>
        <View style={styles.line}><Text style={styles.title}>{formatDisplayDate(item.mealDate)}</Text><Text style={styles.value}>{formatCurrency(Number(item.guestCount) * price)}</Text></View>
        <View style={styles.line}><Text style={styles.hint}>{item.guestCount} suất khách</Text><Button title="Điều chỉnh" size="sm" variant="outline" onPress={() => editGuests(item.mealDate)} /></View>
      </Card>} />
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 }, header: { gap: 14, marginBottom: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, arrow: { padding: 12 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' }, hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
  summary: { gap: 10, backgroundColor: '#FFF9ED' }, amount: { color: colors.warning, fontSize: 28, fontWeight: '800' },
  day: { marginBottom: 12, gap: 10 }, line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  value: { color: colors.warning, fontSize: 15, fontWeight: '700' },
});
