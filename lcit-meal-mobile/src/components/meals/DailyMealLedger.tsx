import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { MealLedger } from '../../types';
import { formatCurrency, formatDisplayDate } from '../../utils/formatters';
import { colors } from '../../theme/colors';

export function DailyMealLedger({ ledger, compact = false }: { ledger: MealLedger; compact?: boolean }) {
  const [selected, setSelected] = useState<string>();
  const index = Math.max(0, ledger.months.findIndex(m => m.month === (selected || ledger.currentMonth)));
  const month = ledger.months[index];
  const days = compact
    ? ledger.months.flatMap(m => m.days).filter(d => d.unpaidAmount > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    : [...(month?.days || [])].reverse();
  return <View style={styles.container}>
    <Text style={styles.title}>{compact ? 'Tiền chưa thanh toán theo ngày' : 'Tiền ăn từng ngày'}</Text>
    {!compact && month && <>
      <View style={styles.navigation}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tháng tiền ăn trước" disabled={index >= ledger.months.length - 1} onPress={() => setSelected(ledger.months[index + 1].month)}><Text style={styles.link}>{index < ledger.months.length - 1 ? '‹ Tháng trước' : ''}</Text></TouchableOpacity>
        <Text style={styles.title}>{month.month.slice(5)}/{month.month.slice(0, 4)}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tháng tiền ăn sau" disabled={index === 0} onPress={() => setSelected(ledger.months[index - 1].month)}><Text style={styles.link}>{index > 0 ? 'Tháng sau ›' : ''}</Text></TouchableOpacity>
      </View>
      <Text style={styles.note}>Phát sinh: {formatCurrency(month.mealAmount)} · Đã thu: {formatCurrency(month.paidAmount)}</Text>
      <Text style={styles.due}>Còn phải thanh toán: {formatCurrency(month.unpaidAmount)}</Text>
      <Text style={styles.note}>Thanh toán cuối tháng, ngày {formatDisplayDate(month.dueDate)}.</Text>
    </>}
    {days.map(day => <View key={day.date} style={styles.row}>
      <View style={{ flex: 1 }}><Text style={styles.date}>{formatDisplayDate(day.date)}</Text><Text style={styles.note}>{day.staff} suất cán bộ{day.guests > 0 ? ` + ${day.guests} suất khách` : ''} · {formatCurrency(day.amount)}</Text></View>
      <View style={styles.balance}><Text style={styles.due}>{formatCurrency(day.unpaidAmount)}</Text><Text style={styles.note}>{day.unpaidAmount > 0 ? 'Chưa thanh toán' : 'Đã thanh toán'}</Text></View>
    </View>)}
    {days.length === 0 && <Text style={styles.note}>{compact ? 'Chưa có tiền ăn theo ngày còn nợ.' : 'Chưa có suất ăn đã hoàn thành trong tháng này.'}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 10, marginVertical: 14 }, title: { fontSize: 14, fontWeight: '700', color: colors.text },
  note: { fontSize: 11, lineHeight: 17, color: colors.textSecondary }, date: { fontSize: 13, fontWeight: '600', color: colors.text },
  due: { fontSize: 13, fontWeight: '700', color: '#9A3412' }, link: { fontSize: 12, color: colors.primary, paddingVertical: 10 },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 9 },
  balance: { alignItems: 'flex-end' },
});
