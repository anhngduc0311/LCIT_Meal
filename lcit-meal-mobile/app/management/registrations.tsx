import React, { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { Input } from '../../src/components/common/Input';
import { FacilitySelector } from '../../src/components/common/FacilitySelector';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import { DatePickerModal } from '../../src/components/meals/DatePickerModal';
import { useCancellationDeadline } from '../../src/hooks/useCancellationDeadline';
import { isCancellationClosed } from '../../src/utils/cancellationDeadline';
import { ResultBanner } from '../../src/components/common/ResultBanner';
import { ForbiddenState } from '../../src/components/states/ForbiddenState';
import { EmptyState } from '../../src/components/states/EmptyState';
import { LoadingState } from '../../src/components/states/LoadingState';
import { ErrorState } from '../../src/components/states/ErrorState';
import { useAuth } from '../../src/providers/AuthProvider';
import { useFacilities } from '../../src/hooks/useFacilities';
import { useUsersList } from '../../src/hooks/useManagementUsers';
import {
  useManagementMealOptions,
  useApproveMealOption, useRejectMealOption,
  useReactivateMealOption,
} from '../../src/hooks/useManagementRegistrations';
import { pendingCancellationRequests } from '../../src/utils/cancellationRequests';
import { FacilityFilter, facilityLabel, getFacility, matchesFacility } from '../../src/utils/facilities';
import { formatBusinessDateDisplay } from '../../src/utils/formatters';
import type { MealOption } from '../../src/types';
import { colors } from '../../src/theme/colors';

export default function ManagementRegistrationsScreen() {
  const { role } = useAuth();
  return role === 'admin' || role === 'manager' ? <CancellationApprovals /> :
    <ScreenContainer><Header title="Duyệt cắt suất" showBack /><ForbiddenState message="Chức năng này dành cho admin và quản lý." /></ScreenContainer>;
}

function CancellationApprovals() {
  const router = useRouter();
  const params = useLocalSearchParams<{ facility?: string }>();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [facility, setFacility] = useState<FacilityFilter>(params.facility === 'all' ? 'all' : params.facility === '2' ? 2 : params.facility === 'unassigned' ? 'unassigned' : 1);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [action, setAction] = useState<{ request: MealOption; approve: boolean } | null>(null);
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  const [restoreRequest, setRestoreRequest] = useState<MealOption | null>(null);
  const [restoreDate, setRestoreDate] = useState<string | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const { today, now } = useCancellationDeadline('08:20');
  const earliestRestoreDate = isCancellationClosed(today, now, '08:20')
    ? new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : today;
  const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const options = useManagementMealOptions({ status: tab });
  const users = useUsersList();
  const facilities = useFacilities();
  const approveOption = useApproveMealOption();
  const rejectOption = useRejectMealOption();
  const restoreOption = useReactivateMealOption();

  const person = (request: MealOption) => {
    const record = request;
    const user = users.data?.find(item => item.id === record.userId);
    const fullName = user?.fullName || record.user?.fullName || record.userName || `Cán bộ #${record.userId}`;
    return { fullName, username: user?.username || record.user?.username,
      facility: getFacility(user || { id: record.userId, fullName }, facilities.overrides) };
  };
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  const requests = tab === 'pending' ? pendingCancellationRequests(options.data || [])
    : (options.data || []).filter(item => ['cancel_permanent', 'cancel_schedule'].includes(item.type) && item.toDate >= earliestRestoreDate);
  const inFacility = requests.filter(item => matchesFacility(person(item).facility, facility));
  const query = normalize(search).replace(/^[@#]/, '');
  const filtered = inFacility.filter(item => {
    const user = person(item);
    return !query || normalize(`${user.fullName} ${user.username || ''} ${item.note || ''}`).includes(query)
      || String(item.userId) === query;
  });
  const period = (request: MealOption) => `${formatBusinessDateDisplay(request.fromDate)} – ${request.toDate === '9999-12-31' ? 'Dài hạn' : formatBusinessDateDisplay(request.toDate)}`;
  const typeLabel = (request: MealOption) => request.type === 'cancel_permanent' ? 'Cắt dài hạn' : 'Cắt theo khoảng';
  const loading = options.isLoading || users.isLoading || facilities.isLoading;
  const error = options.error || users.error;
  const refresh = async () => {
    setRefreshing(true);
    try { await Promise.all([options.refetch(), users.refetch()]); }
    finally { setRefreshing(false); }
  };
  const decide = async () => {
    if (!action || busy.current) return;
    const { request, approve } = action;
    busy.current = true; setSaving(true);
    try {
      const mutation = approve ? approveOption : rejectOption;
      await mutation.mutateAsync(request.id);
      setNotice({ variant: 'success', message: `Đã ${approve ? 'duyệt' : 'từ chối'} yêu cầu cắt suất của ${person(request).fullName}.` });
    } catch (error) {
      setNotice({ variant: 'error', message: error instanceof Error ? error.message : 'Chưa xử lý được yêu cầu. Vui lòng thử lại.' });
    } finally {
      setAction(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['management', 'registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['management', 'meal-options'] }),
        queryClient.invalidateQueries({ queryKey: ['meal-registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['meal-options'] }),
        queryClient.invalidateQueries({ queryKey: ['meals'] }),
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      busy.current = false; setSaving(false);
    }
  };

  const restore = async () => {
    if (!restoreRequest || !restoreDate || busy.current) return;
    busy.current = true; setSaving(true);
    try {
      const result = await restoreOption.mutateAsync({ id: restoreRequest.id, fromDate: restoreDate });
      setNotice({ variant: 'success', message: `Đã kết thúc cắt suất của ${person(restoreRequest).fullName} từ ${formatBusinessDateDisplay(result.fromDate)} và khôi phục ${result.restoredCount} suất trong lịch hiện có.` });
      setRestoreRequest(null); setRestoreDate(null);
    } catch (error) {
      setNotice({ variant: 'error', message: error instanceof Error ? error.message : 'Chưa khôi phục được suất ăn.' });
      setRestoreDate(null); setRestoreRequest(null);
    } finally { busy.current = false; setSaving(false); }
  };

  return <ScreenContainer scrollable={false}>
    <FlatList data={loading || error ? [] : filtered} keyExtractor={item => String(item.id)}
      style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}
      refreshing={refreshing} onRefresh={() => { void refresh(); }} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<>
        <Header title="Duyệt cắt suất" subtitle="Duyệt cắt theo khoảng hoặc dài hạn" showBack userRole={role || undefined}
          onBack={() => router.canGoBack() ? router.back() : router.replace('/management')}
          rightAction={<TouchableOpacity accessibilityRole="button" accessibilityLabel="Làm mới yêu cầu cắt suất" onPress={() => { void refresh(); }} style={styles.refresh}><Ionicons name="refresh-outline" size={21} color={colors.primary} /></TouchableOpacity>} />
        <FacilitySelector value={facility} onChange={setFacility} />
        {role === 'admin' && <View style={styles.actions}>
          <Button title="Chờ duyệt" variant={tab === 'pending' ? 'primary' : 'outline'} disabled={saving} onPress={() => setTab('pending')} style={{ flex: 1 }} />
          <Button title="Đã duyệt · Khôi phục" variant={tab === 'approved' ? 'primary' : 'outline'} disabled={saving} onPress={() => setTab('approved')} style={{ flex: 1 }} />
        </View>}
        <Input value={search} onChangeText={setSearch} placeholder="Tìm tên, @tài khoản hoặc mã cán bộ" accessibilityLabel="Tìm yêu cầu cắt suất"
          leftIcon={<Ionicons name="search-outline" size={18} color={colors.textMuted} />} containerStyle={{ marginBottom: 12 }} />
        {notice && <ResultBanner {...notice} onDismiss={() => setNotice(null)} />}
        <View style={styles.summary}><Ionicons name="time-outline" size={20} color={colors.primary} /><Text style={styles.summaryText}>{loading || error ? 'Đang tải yêu cầu...' : `${inFacility.length} yêu cầu ${tab === 'pending' ? 'chờ duyệt' : 'cắt còn hiệu lực'} · ${facilityLabel(facility)}`}</Text></View>
        {search.trim() && !loading && !error && <Text style={styles.hint}>Tìm thấy {filtered.length} yêu cầu</Text>}
      </>}
      ListEmptyComponent={loading ? <LoadingState message="Đang tải yêu cầu cắt suất..." /> : error
        ? <ErrorState message={error.message} onRetry={() => { void refresh(); }} />
        : <EmptyState iconName="checkmark-circle-outline" title={search.trim() ? 'Không tìm thấy yêu cầu phù hợp' : tab === 'pending' ? 'Không có yêu cầu cắt suất chờ duyệt' : 'Không có yêu cầu cắt còn hiệu lực'}
          description={search.trim() ? 'Thử tìm tên hoặc tài khoản khác.' : tab === 'pending' ? 'Các yêu cầu cắt suất mới sẽ xuất hiện tại đây.' : 'Các yêu cầu cắt theo khoảng hoặc dài hạn đã duyệt sẽ xuất hiện tại đây.'} />}
      renderItem={({ item }) => {
        const user = person(item);
        return <Card padding="md" style={styles.card}>
          <View style={styles.personRow}><View style={styles.avatar}><Ionicons name="person-outline" size={20} color={colors.primary} /></View>
            <View style={styles.personInfo}><Text style={styles.name}>{user.fullName}</Text><Text style={styles.hint}>{user.username ? `@${user.username}` : `Mã cán bộ: ${item.userId}`} · {facilityLabel(user.facility || 'unassigned')}</Text></View>
          </View>
          <View style={styles.typeRow}><Text style={styles.type}>{typeLabel(item)}</Text><Badge label={tab === 'pending' ? 'Chờ duyệt cắt' : 'Đã duyệt cắt'} variant={tab === 'pending' ? 'pending' : 'cancelled'} size="sm" /></View>
          <Text style={styles.period}>{period(item)}</Text>
          {Boolean(item.note) && <Text style={styles.reason}>Lý do: {item.note}</Text>}
          {tab === 'approved' && role === 'admin' ? <Button title="Khôi phục suất ăn" disabled={saving} style={{ marginTop: 14 }} onPress={() => { setRestoreRequest(item); setRestoreDate(null); setPickingDate(true); }} /> : <View style={styles.actions}>
            <Button title="Từ chối" variant="outline" disabled={saving} onPress={() => setAction({ request: item, approve: false })} style={{ flex: 1 }} />
            <Button title="Duyệt cắt" disabled={saving} onPress={() => setAction({ request: item, approve: true })} style={{ flex: 1 }} />
          </View>}
        </Card>;
      }} />
    <ConfirmDialog visible={Boolean(action)} loading={saving} title={action?.approve ? 'Duyệt cắt suất' : 'Từ chối cắt suất'}
      message={action ? `${person(action.request).fullName} · ${period(action.request)}. ${action.approve ? 'Duyệt yêu cầu cắt suất này?' : 'Từ chối yêu cầu và giữ lại suất ăn?'}` : ''}
      confirmText={action?.approve ? 'Duyệt cắt' : 'Từ chối'} onConfirm={() => { void decide(); }} onCancel={() => { if (!busy.current) setAction(null); }} />
    {pickingDate && restoreRequest && <DatePickerModal visible mode="single" title="Chọn ngày bắt đầu ăn lại"
      initialDate={restoreRequest.fromDate > earliestRestoreDate ? restoreRequest.fromDate : earliestRestoreDate}
      minDate={restoreRequest.fromDate > earliestRestoreDate ? restoreRequest.fromDate : earliestRestoreDate} maxDate={restoreRequest.toDate}
      onSelectSingle={date => { setRestoreDate(date); setPickingDate(false); }}
      onClose={() => setPickingDate(false)} />}
    <ConfirmDialog visible={Boolean(restoreRequest && restoreDate && !pickingDate)} title="Khôi phục suất ăn" loading={saving}
      message={restoreRequest && restoreDate ? `${person(restoreRequest).fullName} sẽ ăn lại từ ${formatBusinessDateDisplay(restoreDate)}. Kết thúc yêu cầu cắt này và khôi phục suất cán bộ trong lịch hiện có; không khôi phục khách. Ngày đã chốt, ngày bếp nghỉ và yêu cầu cắt khác được giữ nguyên.` : ''}
      confirmText="Xác nhận khôi phục" onConfirm={() => { void restore(); }} onCancel={() => { if (!busy.current) { setRestoreRequest(null); setRestoreDate(null); } }} />
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  refresh: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.primaryLight, borderRadius: 12, marginBottom: 12 },
  summaryText: { flex: 1, color: colors.primaryDark, fontSize: 13, fontWeight: '600' },
  card: { marginBottom: 12 }, personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  personInfo: { flex: 1 }, name: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  type: { fontSize: 12, color: colors.primary, fontWeight: '600' }, period: { fontSize: 14, color: colors.text, fontWeight: '600', marginTop: 8 },
  reason: { fontSize: 13, color: colors.textSecondary, marginTop: 8 }, actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
