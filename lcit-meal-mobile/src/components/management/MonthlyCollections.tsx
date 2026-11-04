import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../providers/AuthProvider';
import { paymentService } from '../../services/paymentService';
import { buildMonthlyCollections } from '../../utils/monthlyCollections';
import { monthRange, shiftMonth } from '../../utils/monthlyMeals';
import { formatBusinessDate, formatCurrency, formatDisplayDate } from '../../utils/formatters';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { ErrorState } from '../states/ErrorState';
import { EmptyState } from '../states/EmptyState';
import { LoadingState } from '../states/LoadingState';
import { colors } from '../../theme/colors';
import { useFacilities } from '../../hooks/useFacilities';
import { useCancellationDeadline } from '../../hooks/useCancellationDeadline';

export function MonthlyCollections({ header }: {
  header: React.ReactNode;
}) {
  const [month, setMonth] = useState(() => formatBusinessDate(new Date()).slice(0, 7));
  const [search, setSearch] = useState('');
  const facilities = useFacilities();
  const { today } = useCancellationDeadline();
  const range = monthRange(month);
  const { isMockMode } = useAuth();
  const board = useQuery({ queryKey: ['management', 'payments', 'monthly-board', month, isMockMode],
    queryFn: () => paymentService.getMonthlyBoard(month, isMockMode), refetchInterval: 60000 });
  const loading = board.isLoading || facilities.isLoading;
  const error = board.error;
  const value = (key: string) => board.data?.settings.find(s => s.settingKey === key)?.settingValue;
  const price = value('meal_price') === undefined ? NaN : Number(value('meal_price'));
  const guestPrice = value('guest_meal_price') === undefined ? NaN : Number(value('guest_meal_price'));
  const pricesReady = [price, guestPrice].every(p => Number.isFinite(p) && p >= 0);
  const ready = !loading && !error && pricesReady;
  const summary = ready ? buildMonthlyCollections(month, board.data?.users || [], board.data?.registrations || [], board.data?.meals || [],
    board.data?.payments || [], price, guestPrice, board.data?.guests || [], { facilityId: 1, throughDate: today, overrides: facilities.overrides }) : null;
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const rows = summary?.rows.filter(row => normalize(`${row.name} ${row.username}`).includes(normalize(search.trim().replace(/^@/, '')))) || [];
  const refresh = async () => { await board.refetch(); };
  return <FlatList
    data={rows} keyExtractor={item => String(item.userId)}
    contentContainerStyle={styles.content} onRefresh={() => { void refresh(); }} refreshing={board.isRefetching}
    ListHeaderComponent={<View style={styles.header}>
      {header}
      <View style={styles.monthRow}>
        <TouchableOpacity accessibilityLabel="Tháng trước" onPress={() => setMonth(shiftMonth(month, -1))} style={styles.monthButton}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Tháng {month.slice(5)}/{month.slice(0, 4)}</Text>
        <TouchableOpacity accessibilityLabel="Tháng sau" onPress={() => setMonth(shiftMonth(month, 1))} style={styles.monthButton}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Cơ sở 1 · Chỉ cộng suất trong tháng đã chọn đến ngày {formatDisplayDate(today)}. Suất đã cắt và ngày bếp nghỉ không tính tiền.</Text>
      <Text style={styles.hint}>Tự động chốt ngày {formatDisplayDate(range.to)}, sau giờ hoàn thành bữa ăn. Không cần tạo khoản thu.</Text>
      {loading ? <LoadingState /> : error || !pricesReady ? <ErrorState
        message={error instanceof Error ? error.message : 'Chưa cấu hình đủ đơn giá cán bộ và khách.'} onRetry={() => { void refresh(); }} /> : summary && <>
        <Card padding="md">
          <Text style={styles.title}>Khoản thu theo cán bộ</Text>
          <View style={styles.line}><Text style={styles.label}>Tiền suất cán bộ</Text><Text style={styles.value}>{formatCurrency(summary.staffAmount)}</Text></View>
          <View style={styles.line}><Text style={styles.label}>Đã thu</Text><Text style={styles.value}>{formatCurrency(summary.paidAmount)}</Text></View>
          <View style={styles.line}><Text style={styles.title}>Còn cần thu</Text><Text style={styles.amount}>{formatCurrency(summary.remainingAmount)}</Text></View>
        </Card>
        <Card padding="md" style={styles.guestCard}>
          <Text style={styles.title}>Khách thêm riêng theo cơ sở</Text>
          {summary.standalone.map(item => <View key={item.facilityId} style={styles.line}>
            <Text style={styles.label}>Cơ sở {item.facilityId} · {item.count} suất</Text><Text style={styles.guestValue}>{formatCurrency(item.amount)}</Text>
          </View>)}
          <Text style={styles.hint}>Theo dõi riêng, không cộng vào khoản thu của từng cán bộ.</Text>
        </Card>
        <Text style={styles.hint}>Đơn giá: {formatCurrency(price)}/cán bộ · {formatCurrency(guestPrice)}/khách</Text>
        <Input placeholder="Tìm tên hoặc @tài khoản..." value={search} onChangeText={setSearch} />
        <Text style={styles.title}>Cần thu đến hiện tại · {rows.length} người</Text>
      </>}
    </View>}
    ListEmptyComponent={ready ? <EmptyState title="Chưa có dữ liệu thu tiền" description="Không có suất ăn hoặc khoản thu phù hợp trong tháng đã chọn." /> : null}
    renderItem={({ item }) => <Card padding="md" style={styles.person}>
      <Text style={styles.title}>{item.name}</Text>
      {item.username ? <Text style={styles.hint}>@{item.username}</Text> : null}
      <View style={styles.line}><Text style={styles.label}>Cán bộ · {item.staff} suất</Text><Text style={styles.value}>{formatCurrency(item.staffAmount)}</Text></View>
      {item.guests > 0 && <View style={styles.line}><Text style={styles.label}>Khách đi kèm · {item.guests} suất</Text><Text style={styles.guestValue}>{formatCurrency(item.guestAmount)}</Text></View>}
      {item.adjustmentAmount > 0 && <View style={styles.line}><Text style={styles.label}>Chênh lệch khoản thu đã lập</Text><Text style={styles.value}>{formatCurrency(item.adjustmentAmount)}</Text></View>}
      <View style={styles.line}><Text style={styles.label}>Đã thu</Text><Text style={styles.value}>{formatCurrency(item.paidAmount)}</Text></View>
      <View style={styles.line}><Text style={styles.title}>Còn cần thu</Text><Text style={styles.amount}>{formatCurrency(item.remainingAmount)}</Text></View>
      {item.creditAmount > 0 && <Text style={styles.hint}>Đã đóng dư: {formatCurrency(item.creditAmount)}</Text>}
      <Text style={styles.hint}>{item.invoices.length ? 'Đã có kỳ thanh toán · xem tại tab Thanh toán.'
        : 'Đang cộng dồn · tự động hiện kỳ thanh toán vào cuối tháng.'}</Text>
    </Card>}
  />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 100 }, header: { gap: 12, marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { padding: 12 }, title: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  label: { color: colors.textSecondary, fontSize: 13 }, value: { color: colors.text, fontSize: 14, fontWeight: '600' },
  guestValue: { color: colors.warning, fontSize: 14, fontWeight: '700' },
  amount: { fontSize: 18, fontWeight: '800', color: colors.primary },
  guestCard: { backgroundColor: '#FFF9ED' }, person: { marginBottom: 12, gap: 6 },
});
