/**
 * Management Meal Chart Component
 * Biểu đồ suất ăn thực tế trực quan, tối ưu cho màn hình di động:
 * - Hiển thị 2 dòng nhãn rõ ràng: Thứ trong tuần (T2-CN) & Ngày (DD/MM), không bị tràn/cắt chữ.
 * - Chế độ "Tuần": Tự động dàn đều 7 ngày vừa vặn màn hình điện thoại (không bị cuộn ngang/mất Chủ Nhật).
 * - Chế độ "Tháng" & "Năm": Hỗ trợ cuộn mượt mà kèm tự động cuộn đến ngày hiện tại.
 * - Nhấn vào cột để xem chi tiết: Ngày đầy đủ, suất cán bộ, suất khách, trạng thái.
 * - Dải thẻ tóm tắt KPI nhanh: Tổng kỳ, Trung bình/ngày, Suất cao nhất.
 * - Cột 0 suất hiển thị sạch sẽ, không bị vệt màu thừa.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { formatBusinessDate } from '../../utils/formatters';

export interface ChartPoint {
  meal_date: string;
  total_meal_slots: number;
  registered_staff_count?: number;
  is_cancelled?: number | boolean;
}

export interface ManagementMealChartProps {
  scopeLabel?: string;
  points: ChartPoint[];
  isLoading?: boolean;
  selectedPeriod: 'week' | 'month' | 'year';
  onPeriodChange: (period: 'week' | 'month' | 'year') => void;
}

interface ParsedPoint {
  rawDate: string;
  primaryLabel: string;   // Dòng 1: Thứ (T2, T3...) hoặc Tháng (T1, T2...)
  secondaryLabel: string; // Dòng 2: Ngày (19/10) hoặc phụ
  fullDateLabel: string;  // Tiêu đề chi tiết: "Thứ Hai, 19/10/2026"
  isToday: boolean;
  isWeekend: boolean;
  totalSlots: number;
  staffCount?: number;
  guestCount?: number;
  isCancelled?: boolean;
}

const SHORT_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const FULL_DAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function parsePoint(pt: ChartPoint, period: 'week' | 'month' | 'year', todayStr: string): ParsedPoint {
  const rawDate = pt.meal_date || '';
  const totalSlots = Number(pt.total_meal_slots || 0);
  const staffCount = pt.registered_staff_count !== undefined ? Number(pt.registered_staff_count) : undefined;
  const guestCount = staffCount !== undefined ? Math.max(0, totalSlots - staffCount) : undefined;
  const isCancelled = Boolean(pt.is_cancelled);

  // 1. Dạng YYYY-MM-DD từ API
  const ymdMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const dateObj = new Date(year, month - 1, day);
    const dayIdx = dateObj.getDay();
    const shortDay = SHORT_DAYS[dayIdx];
    const fullDay = FULL_DAYS[dayIdx];
    const dayMonth = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    const isToday = rawDate === todayStr;
    const isWeekend = dayIdx === 0 || dayIdx === 6;

    if (period === 'week') {
      return {
        rawDate,
        primaryLabel: shortDay,
        secondaryLabel: dayMonth,
        fullDateLabel: `${fullDay}, ${dayMonth}/${year}`,
        isToday,
        isWeekend,
        totalSlots,
        staffCount,
        guestCount,
        isCancelled,
      };
    }

    if (period === 'month') {
      return {
        rawDate,
        primaryLabel: shortDay,
        secondaryLabel: dayMonth,
        fullDateLabel: `${fullDay}, ${dayMonth}/${year}`,
        isToday,
        isWeekend,
        totalSlots,
        staffCount,
        guestCount,
        isCancelled,
      };
    }
  }

  // 2. Dạng YYYY-MM (Kỳ năm từ API)
  const ymMatch = rawDate.match(/^(\d{4})-(\d{2})/);
  if (ymMatch) {
    const year = ymMatch[1];
    const month = parseInt(ymMatch[2], 10);
    return {
      rawDate,
      primaryLabel: `T${month}`,
      secondaryLabel: `Thg ${month}`,
      fullDateLabel: `Tháng ${month}/${year}`,
      isToday: false,
      isWeekend: false,
      totalSlots,
      staffCount,
      guestCount,
      isCancelled,
    };
  }

  // 3. Dạng mock data tuần: "T2 (21/09)"
  const mockWeekMatch = rawDate.match(/^(T[2-7]|CN)\s*\((.+)\)$/);
  if (mockWeekMatch) {
    const dow = mockWeekMatch[1];
    const dStr = mockWeekMatch[2];
    const isWeekend = dow === 'T7' || dow === 'CN';
    const fullDow = dow === 'CN' ? 'Chủ Nhật' : `Thứ ${dow.replace('T', '')}`;
    return {
      rawDate,
      primaryLabel: dow,
      secondaryLabel: dStr,
      fullDateLabel: `${fullDow}, ${dStr}`,
      isToday: false,
      isWeekend,
      totalSlots,
      staffCount,
      guestCount,
      isCancelled,
    };
  }

  // 4. Dạng mock data tháng: "1/09"
  const mockMonthMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (mockMonthMatch) {
    const day = mockMonthMatch[1];
    const month = mockMonthMatch[2];
    return {
      rawDate,
      primaryLabel: `${day}`,
      secondaryLabel: `${day}/${month}`,
      fullDateLabel: `Ngày ${day}/${month}`,
      isToday: false,
      isWeekend: false,
      totalSlots,
      staffCount,
      guestCount,
      isCancelled,
    };
  }

  // 5. Dạng mock data năm: "Tháng 1"
  if (rawDate.startsWith('Tháng ')) {
    const m = rawDate.replace('Tháng ', '').trim();
    return {
      rawDate,
      primaryLabel: `T${m}`,
      secondaryLabel: `Thg ${m}`,
      fullDateLabel: rawDate,
      isToday: false,
      isWeekend: false,
      totalSlots,
      staffCount,
      guestCount,
      isCancelled,
    };
  }

  // Dự phòng nếu chuỗi không chuẩn
  return {
    rawDate,
    primaryLabel: rawDate.slice(0, 5),
    secondaryLabel: '',
    fullDateLabel: rawDate,
    isToday: false,
    isWeekend: false,
    totalSlots,
    staffCount,
    guestCount,
    isCancelled,
  };
}

export function ManagementMealChart({
  points,
  isLoading = false,
  selectedPeriod,
  onPeriodChange,
  scopeLabel = 'Toàn cơ quan',
}: ManagementMealChartProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const compact = width < 400;
  const todayStr = useMemo(() => formatBusinessDate(new Date()), []);
  const scrollRef = useRef<ScrollView>(null);

  // Parse points với định dạng chuẩn
  const parsedPoints = useMemo(() => {
    return points.map((p) => parsePoint(p, selectedPeriod, todayStr));
  }, [points, selectedPeriod, todayStr]);

  // Tìm điểm được chọn mặc định (hôm nay hoặc điểm cuối có dữ liệu hoặc điểm cuối cùng)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (parsedPoints.length === 0) {
      setSelectedIndex(null);
      return;
    }
    // Ưu tiên chọn ngày Hôm nay
    const todayIdx = parsedPoints.findIndex((p) => p.isToday);
    if (todayIdx >= 0) {
      setSelectedIndex(todayIdx);
      return;
    }
    // Nếu không có hôm nay, chọn ngày gần nhất có suất ăn
    for (let i = parsedPoints.length - 1; i >= 0; i--) {
      if (parsedPoints[i].totalSlots > 0) {
        setSelectedIndex(i);
        return;
      }
    }
    // Mặc định chọn phần tử cuối
    setSelectedIndex(parsedPoints.length - 1);
  }, [parsedPoints, selectedPeriod]);

  // Cuộn đến ngày hiện tại khi xem Tháng
  useEffect(() => {
    if (selectedPeriod === 'month' && selectedIndex !== null && selectedIndex > 3 && scrollRef.current) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: Math.max(0, (selectedIndex - 2) * 44), animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedPeriod, selectedIndex]);

  // Thống kê nhanh KPI
  const { totalSlots, avgSlots, peakSlots, maxSlots } = useMemo(() => {
    const total = parsedPoints.reduce((sum, p) => sum + p.totalSlots, 0);
    const activeDays = parsedPoints.filter((p) => p.totalSlots > 0);
    const avg = activeDays.length > 0 ? Math.round(total / activeDays.length) : 0;
    const peak = Math.max(...parsedPoints.map((p) => p.totalSlots), 0);
    const max = Math.max(peak, 10);
    return { totalSlots: total, avgSlots: avg, peakSlots: peak, maxSlots: max };
  }, [parsedPoints]);

  const selectedPoint = selectedIndex !== null && parsedPoints[selectedIndex] ? parsedPoints[selectedIndex] : null;

  const isWeekMode = selectedPeriod === 'week';
  // Đối với tuần (<= 7 ngày), luôn fit 100% chiều rộng thẻ mà không cần cuộn ngang trên điện thoại
  const canFitWithoutScroll = isWeekMode && parsedPoints.length <= 7;

  return (
    <Card variant="elevated" padding="md" style={styles.chartCard}>
      {/* Header: Tiêu đề & Bộ chọn chu kỳ */}
      <View style={[styles.chartHeader, !wide && styles.stacked]}>
        <View style={styles.headingCopy}>
          <Text style={styles.sectionTitle}>Biểu đồ suất ăn thực tế</Text>
          <Text style={styles.sectionSubtitle}>
            {scopeLabel} · Chỉ tính các suất đã hoàn thành qua trưa
          </Text>
        </View>

        {/* Tab chọn Tuần / Tháng / Năm */}
        <View style={styles.periodTabs}>
          {(['week', 'month', 'year'] as const).map((p) => {
            const isActive = selectedPeriod === p;
            const label = p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm';
            return (
              <TouchableOpacity
                key={p}
                style={[styles.periodTab, isActive && styles.periodTabActive]}
                onPress={() => onPeriodChange(p)}
                accessibilityRole="button"
                accessibilityLabel={`Xem biểu đồ theo ${label.toLowerCase()}`}
                accessibilityState={{ selected: isActive }}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodTabText, isActive && styles.periodTabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Dải thống kê tóm tắt nhanh (KPI Summary Strip) */}
      {!isLoading && parsedPoints.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>TỔNG KỲ</Text>
            <View style={styles.summaryValueRow}>
              <Text style={styles.summaryValue}>{totalSlots}</Text>
              <Text style={styles.summaryUnit}>suất</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>TRUNG BÌNH</Text>
            <View style={styles.summaryValueRow}>
              <Text style={styles.summaryValue}>{avgSlots}</Text>
              <Text style={styles.summaryUnit}>suất/ngày</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>CAO NHẤT</Text>
            <View style={styles.summaryValueRow}>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{peakSlots}</Text>
              <Text style={styles.summaryUnit}>suất</Text>
            </View>
          </View>
        </View>
      )}

      {/* Vùng vẽ biểu đồ */}
      {isLoading ? (
        <View style={styles.chartLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu biểu đồ...</Text>
        </View>
      ) : parsedPoints.length === 0 ? (
        <View style={styles.chartEmpty}>
          <Ionicons name="bar-chart-outline" size={36} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Chưa có dữ liệu suất ăn trong kỳ này</Text>
        </View>
      ) : (
        <View style={styles.chartAreaWrapper}>
          {/* Đường lưới chỉ dẫn mờ (Reference Grid Lines) */}
          <View style={styles.gridOverlay} pointerEvents="none">
            <View style={styles.gridLineRow}>
              <Text style={styles.gridLabel}>{maxSlots}</Text>
              <View style={styles.gridLineDashed} />
            </View>
            <View style={styles.gridLineRow}>
              <Text style={styles.gridLabel}>{Math.round(maxSlots / 2)}</Text>
              <View style={styles.gridLineDashed} />
            </View>
            <View style={[styles.gridLineRow, { marginBottom: 38 }]}>
              <Text style={styles.gridLabel}>0</Text>
              <View style={styles.gridLineSolid} />
            </View>
          </View>

          {/* Vùng cột biểu đồ: Tuần tự động vừa vặn, Tháng/Năm cuộn ngang nếu cần */}
          {canFitWithoutScroll ? (
            <View style={styles.weekChartContainer}>
              {parsedPoints.map((pt, idx) => {
                const isSelected = selectedIndex === idx;
                const isPeak = pt.totalSlots > 0 && pt.totalSlots === peakSlots;
                const heightPercent = maxSlots > 0 ? (pt.totalSlots / maxSlots) * 100 : 0;
                const barWidth = wide ? 28 : compact ? 20 : 24;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.barColFixed, isSelected && styles.barColFixedSelected]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedIndex(idx)}
                    accessibilityRole="button"
                    accessibilityLabel={`${pt.fullDateLabel}: ${pt.totalSlots} suất ăn`}
                  >
                    {/* Số lượng trên đỉnh cột */}
                    <View style={styles.barValueWrapper}>
                      {pt.totalSlots > 0 ? (
                        <Text
                          style={[
                            styles.barValueText,
                            isSelected && styles.barValueTextSelected,
                            isPeak && styles.barValueTextPeak,
                          ]}
                          numberOfLines={1}
                        >
                          {pt.totalSlots}
                        </Text>
                      ) : (
                        <Text style={styles.barValueZero}>—</Text>
                      )}
                    </View>

                    {/* Khung thân cột dạng con nhộng */}
                    <View
                      style={[
                        styles.barTrack,
                        { width: barWidth },
                        isSelected && styles.barTrackSelected,
                        pt.isWeekend && styles.barTrackWeekend,
                      ]}
                    >
                      {pt.totalSlots > 0 && (
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${Math.max(heightPercent, 6)}%`,
                              backgroundColor: isSelected
                                ? colors.primaryDark
                                : isPeak
                                ? '#0F6B52'
                                : colors.primary,
                            },
                          ]}
                        />
                      )}
                    </View>

                    {/* Nhãn 2 dòng bên dưới */}
                    <View style={styles.barLabelWrapper}>
                      {/* Dòng 1: Thứ trong tuần (T2, T3...) */}
                      <View
                        style={[
                          styles.dayBadge,
                          pt.isToday && styles.todayBadge,
                          isSelected && !pt.isToday && styles.selectedBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayBadgeText,
                            pt.isToday && styles.todayBadgeText,
                            pt.isWeekend && !pt.isToday && styles.weekendText,
                            isSelected && !pt.isToday && styles.selectedBadgeText,
                          ]}
                          numberOfLines={1}
                        >
                          {pt.primaryLabel}
                        </Text>
                      </View>

                      {/* Dòng 2: Ngày/Tháng (19/10) */}
                      {pt.secondaryLabel ? (
                        <Text
                          style={[
                            styles.dateText,
                            pt.isToday && styles.todayDateText,
                            isSelected && styles.selectedDateText,
                          ]}
                          numberOfLines={1}
                        >
                          {pt.secondaryLabel}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollableChartContent}
            >
              <View style={styles.scrollableChartInner}>
                {parsedPoints.map((pt, idx) => {
                  const isSelected = selectedIndex === idx;
                  const isPeak = pt.totalSlots > 0 && pt.totalSlots === peakSlots;
                  const heightPercent = maxSlots > 0 ? (pt.totalSlots / maxSlots) * 100 : 0;
                  const colWidth = selectedPeriod === 'month' ? 42 : 48;
                  const barWidth = selectedPeriod === 'month' ? 18 : 22;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.barColScrollable, { width: colWidth }]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedIndex(idx)}
                      accessibilityRole="button"
                      accessibilityLabel={`${pt.fullDateLabel}: ${pt.totalSlots} suất ăn`}
                    >
                      {/* Số lượng trên đỉnh */}
                      <View style={styles.barValueWrapper}>
                        {pt.totalSlots > 0 ? (
                          <Text
                            style={[
                              styles.barValueText,
                              isSelected && styles.barValueTextSelected,
                              isPeak && styles.barValueTextPeak,
                            ]}
                            numberOfLines={1}
                          >
                            {pt.totalSlots}
                          </Text>
                        ) : (
                          <Text style={styles.barValueZero}>—</Text>
                        )}
                      </View>

                      {/* Thân cột */}
                      <View
                        style={[
                          styles.barTrack,
                          { width: barWidth },
                          isSelected && styles.barTrackSelected,
                          pt.isWeekend && styles.barTrackWeekend,
                        ]}
                      >
                        {pt.totalSlots > 0 && (
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: `${Math.max(heightPercent, 6)}%`,
                                backgroundColor: isSelected
                                  ? colors.primaryDark
                                  : isPeak
                                  ? '#0F6B52'
                                  : colors.primary,
                              },
                            ]}
                          />
                        )}
                      </View>

                      {/* Nhãn 2 dòng */}
                      <View style={styles.barLabelWrapper}>
                        <View
                          style={[
                            styles.dayBadge,
                            pt.isToday && styles.todayBadge,
                            isSelected && !pt.isToday && styles.selectedBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayBadgeText,
                              pt.isToday && styles.todayBadgeText,
                              pt.isWeekend && !pt.isToday && styles.weekendText,
                              isSelected && !pt.isToday && styles.selectedBadgeText,
                            ]}
                            numberOfLines={1}
                          >
                            {pt.primaryLabel}
                          </Text>
                        </View>
                        {pt.secondaryLabel ? (
                          <Text
                            style={[
                              styles.dateText,
                              pt.isToday && styles.todayDateText,
                              isSelected && styles.selectedDateText,
                            ]}
                            numberOfLines={1}
                          >
                            {pt.secondaryLabel}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* Thẻ hiển thị chi tiết khi chọn/chạm vào một ngày */}
      {selectedPoint && !isLoading && (
        <View style={styles.detailCard}>
          <View style={styles.detailCardLeft}>
            <View style={styles.detailDateRow}>
              <Ionicons name="calendar" size={15} color={colors.primary} />
              <Text style={styles.detailDateText}>{selectedPoint.fullDateLabel}</Text>
              {selectedPoint.isToday && (
                <View style={styles.todayTag}>
                  <Text style={styles.todayTagText}>Hôm nay</Text>
                </View>
              )}
            </View>
            <Text style={styles.detailBreakdownText}>
              {selectedPoint.totalSlots === 0
                ? 'Không có suất ăn hoàn thành (hoặc chưa tới giờ ăn trưa)'
                : selectedPoint.staffCount !== undefined
                ? `${selectedPoint.staffCount} suất cán bộ · ${selectedPoint.guestCount || 0} suất khách mời`
                : 'Suất ăn thực tế đã hoàn thành qua trưa'}
            </Text>
          </View>
          <View style={styles.detailCardRight}>
            <Text style={styles.detailSlotsText}>{selectedPoint.totalSlots}</Text>
            <Text style={styles.detailSlotsLabel}>suất ăn</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    padding: 16,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: 12,
  },
  stacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  headingCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  periodTabs: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    backgroundColor: '#EFF3F0',
    borderRadius: radius.full,
    padding: 3,
  },
  periodTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.full,
  },
  periodTabActive: {
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  periodTabTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },

  // Dải thẻ tóm tắt nhanh
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F9F6',
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E3EDE6',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#DDE8E0',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
  },
  summaryUnit: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },

  // Vùng vẽ
  chartAreaWrapper: {
    position: 'relative',
    height: 200,
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  chartLoading: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  chartEmpty: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Đường lưới mờ phía sau
  gridOverlay: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    bottom: 40,
    justifyContent: 'space-between',
    zIndex: 0,
  },
  gridLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: {
    width: 22,
    fontSize: 9,
    fontWeight: '600',
    color: '#9EAEA5',
    textAlign: 'left',
  },
  gridLineDashed: {
    flex: 1,
    height: 1,
    backgroundColor: '#EDF3EF',
  },
  gridLineSolid: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5ECE8',
  },

  // Chế độ Tuần dàn đều (Không scroll)
  weekChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 195,
    width: '100%',
    zIndex: 1,
    paddingLeft: 20, // Chừa khoảng cho nhãn trục Y
  },
  barColFixed: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 1,
  },
  barColFixedSelected: {
    opacity: 1,
  },

  // Chế độ Tháng/Năm cuộn ngang
  scrollableChartContent: {
    flexGrow: 1,
    paddingLeft: 22,
  },
  scrollableChartInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 195,
    zIndex: 1,
  },
  barColScrollable: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },

  // Phần tử cột
  barValueWrapper: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  barValueText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  barValueTextSelected: {
    color: colors.primaryDark,
    fontSize: 12,
  },
  barValueTextPeak: {
    color: colors.primary,
  },
  barValueZero: {
    fontSize: 11,
    color: '#BDC9C1',
    fontWeight: '500',
  },
  barTrack: {
    height: 115,
    backgroundColor: '#EEF4F0',
    borderRadius: radius.full,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  barTrackSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E4EDE7',
  },
  barTrackWeekend: {
    backgroundColor: '#F3F6F4',
  },
  barFill: {
    width: '100%',
    borderRadius: radius.full,
  },

  // Nhãn dưới đáy (2 dòng)
  barLabelWrapper: {
    alignItems: 'center',
    marginTop: 6,
    height: 42,
  },
  dayBadge: {
    minWidth: 26,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  todayBadge: {
    backgroundColor: colors.primary,
  },
  selectedBadge: {
    backgroundColor: '#D9EDE0',
  },
  dayBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  todayBadgeText: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
  },
  selectedBadgeText: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  weekendText: {
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  dateText: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  todayDateText: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  selectedDateText: {
    color: colors.primaryDark,
  },

  // Thẻ chi tiết ngày được chọn
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAF8',
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2EBE5',
  },
  detailCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  detailDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailDateText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  todayTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  todayTagText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  detailBreakdownText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
  },
  detailCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  detailSlotsText: {
    fontSize: 20,
    fontWeight: typography.weights.extrabold,
    color: colors.primaryDark,
  },
  detailSlotsLabel: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
});
