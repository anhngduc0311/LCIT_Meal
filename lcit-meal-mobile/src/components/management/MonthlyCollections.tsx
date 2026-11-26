import React, { useState } from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../providers/AuthProvider';
import { paymentService } from '../../services/paymentService';
import { exportService } from '../../services/exportService';
import { buildMonthlyCollections } from '../../utils/monthlyCollections';
import { monthRange, shiftMonth } from '../../utils/monthlyMeals';
import { formatBusinessDate, formatCurrency, formatDisplayDate, getMediaUrl } from '../../utils/formatters';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ModalBackdrop } from '../common/ModalBackdrop';
import { ModalCard } from '../common/ModalCard';
import { ErrorState } from '../states/ErrorState';
import { EmptyState } from '../states/EmptyState';
import { LoadingState } from '../states/LoadingState';
import { colors } from '../../theme/colors';
import { useFacilities } from '../../hooks/useFacilities';
import { useCancellationDeadline } from '../../hooks/useCancellationDeadline';
import type { Payment } from '../../types';

export function MonthlyCollections({ header }: {
  header: React.ReactNode;
}) {
  const [month, setMonth] = useState(() => formatBusinessDate(new Date()).slice(0, 7));
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [viewingProof, setViewingProof] = useState<{ name: string; payment: Payment } | null>(null);
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
  const exportMonthlyBoard = async () => {
    if (!summary || exporting || isMockMode) return;
    setExporting(true);
    setExportError('');
    try {
      const result = await exportService.exportMonthlyCollections(month, today < range.to ? today : range.to, summary);
      if (!result.success) setExportError(result.message || 'Không thể xuất Excel.');
    } catch {
      setExportError('Không thể xuất Excel. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };
  return <>
    <FlatList
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
          {!isMockMode && <Button
            title="Xuất Excel"
            variant="outline"
            size="sm"
            loading={exporting}
            leftIcon={<Ionicons name="download-outline" size={17} color={colors.primary} />}
            onPress={exportMonthlyBoard}
          />}
          {exportError ? <Text accessibilityRole="alert" style={styles.error}>{exportError}</Text> : null}
          <Input placeholder="Tìm tên hoặc @tài khoản..." value={search} onChangeText={setSearch} />
          <Text style={styles.title}>Cần thu đến hiện tại · {rows.length} người</Text>
        </>}
      </View>}
      ListEmptyComponent={ready ? <EmptyState title="Chưa có dữ liệu thu tiền" description="Không có suất ăn hoặc khoản thu phù hợp trong tháng đã chọn." /> : null}
      renderItem={({ item }) => {
        const proofInvoice = item.invoices.find(inv => Boolean(inv.billImg));
        return <Card padding="md" style={styles.person}>
          <Text style={styles.title}>{item.name}</Text>
          {item.username ? <Text style={styles.hint}>@{item.username}</Text> : null}
          <View style={styles.line}><Text style={styles.label}>Cán bộ · {item.staff} suất</Text><Text style={styles.value}>{formatCurrency(item.staffAmount)}</Text></View>
          {item.guests > 0 && <View style={styles.line}><Text style={styles.label}>Khách đi kèm · {item.guests} suất</Text><Text style={styles.guestValue}>{formatCurrency(item.guestAmount)}</Text></View>}
          {item.adjustmentAmount > 0 && <View style={styles.line}><Text style={styles.label}>Chênh lệch khoản thu đã lập</Text><Text style={styles.value}>{formatCurrency(item.adjustmentAmount)}</Text></View>}
          <View style={styles.line}><Text style={styles.label}>Đã thu</Text><Text style={styles.value}>{formatCurrency(item.paidAmount)}</Text></View>
          <View style={styles.line}><Text style={styles.title}>Còn cần thu</Text><Text style={styles.amount}>{formatCurrency(item.remainingAmount)}</Text></View>
          {item.creditAmount > 0 && <Text style={styles.hint}>Đã đóng dư: {formatCurrency(item.creditAmount)}</Text>}
          {proofInvoice?.billImg ? (
            <TouchableOpacity
              style={styles.proofRow}
              activeOpacity={0.75}
              onPress={() => setViewingProof({ name: item.name, payment: proofInvoice })}
            >
              <Image
                source={{ uri: getMediaUrl(proofInvoice.billImg) || proofInvoice.billImg }}
                style={styles.proofThumb}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.proofTitle}>Đã gửi ảnh chuyển khoản</Text>
                <Text style={styles.hint}>Nhấn để xem ảnh xác nhận</Text>
              </View>
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.hint}>{item.invoices.length ? 'Đã có kỳ thanh toán · xem tại tab Thanh toán.'
            : 'Đang cộng dồn · tự động hiện kỳ thanh toán vào cuối tháng.'}</Text>
        </Card>;
      }}
    />

    <Modal
      visible={viewingProof !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setViewingProof(null)}
    >
      <ModalBackdrop style={styles.modalOverlay}>
        <ModalCard style={styles.modalDialog}>
          <View style={styles.modalHeader}>
            <Text style={styles.title}>Ảnh xác nhận chuyển khoản</Text>
            <TouchableOpacity onPress={() => setViewingProof(null)} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {viewingProof && (
            <>
              <Text style={styles.hint}>
                Cán bộ: {viewingProof.name} · Số tiền: {formatCurrency(viewingProof.payment.amount)}
              </Text>
              {viewingProof.payment.billImg ? (
                <Image
                  source={{ uri: getMediaUrl(viewingProof.payment.billImg) || viewingProof.payment.billImg }}
                  style={styles.proofFullImg}
                  resizeMode="contain"
                />
              ) : null}
              <Button title="Đóng" variant="secondary" size="md" onPress={() => setViewingProof(null)} />
            </>
          )}
        </ModalCard>
      </ModalBackdrop>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 100 }, header: { gap: 12, marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { padding: 12 }, title: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  label: { color: colors.textSecondary, fontSize: 13 }, value: { color: colors.text, fontSize: 14, fontWeight: '600' },
  guestValue: { color: colors.warning, fontSize: 14, fontWeight: '700' },
  amount: { fontSize: 18, fontWeight: '800', color: colors.primary },
  guestCard: { backgroundColor: '#FFF9ED' }, person: { marginBottom: 12, gap: 6 },
  proofRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, padding: 8,
    borderRadius: 10, backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border,
  },
  proofThumb: { width: 38, height: 38, borderRadius: 6, backgroundColor: colors.backgroundDark },
  proofTitle: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalDialog: { width: '100%', backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proofFullImg: { width: '100%', height: 340, borderRadius: 12, backgroundColor: colors.surfaceSubtle },
});
