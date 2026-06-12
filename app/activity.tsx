import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image,
  Modal, ActivityIndicator, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

const { width: SW } = Dimensions.get('window');
const GRID_PAD = 16;
const CELL_W = Math.floor((SW - GRID_PAD * 2) / 7);
const CELL_H = 58;

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ── Types ────────────────────────────────────────────────────

interface CalendarPost {
  id: string;
  created_at: string;
  photo_count: number;
  extra_count: number;
  image_url: string;
  caption: string | null;
  drink_type: string;
}

interface DayData {
  posts: CalendarPost[];
  verified: number;
  selfReported: number;
  total: number;
}

type DayMap = Record<string, DayData>; // key: "YYYY-MM-DD"

// ── Helpers ──────────────────────────────────────────────────

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildGrid(month: Date): (number | null)[] {
  const y = month.getFullYear();
  const m = month.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function groupByDay(posts: CalendarPost[]): DayMap {
  const map: DayMap = {};
  for (const p of posts) {
    const key = toDayKey(new Date(p.created_at));
    if (!map[key]) map[key] = { posts: [], verified: 0, selfReported: 0, total: 0 };
    map[key].posts.push(p);
    const v = p.photo_count ?? 1;
    const s = p.extra_count ?? 0;
    map[key].verified += v;
    map[key].selfReported += s;
    map[key].total += v + s;
  }
  return map;
}

const fmtMonth = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);

const fmtDayHeader = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(d);

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));

// ── Screen ───────────────────────────────────────────────────

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const today = new Date();
  const todayKey = toDayKey(today);

  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [dayMap, setDayMap] = useState<DayMap>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Separated so it can be reused by month changes without re-fetching user
  const fetchMonth = useCallback(async (month: Date, uid: string) => {
    setLoading(true);
    const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
    const end   = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const { data } = await supabase
      .from('posts')
      .select('id, created_at, photo_count, extra_count, image_url, caption, drink_type')
      .eq('user_id', uid)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true });

    if (data) setDayMap(groupByDay(data as CalendarPost[]));
    setLoading(false);
  }, []);

  // Initial load — get user ID once, then fetch
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      fetchMonth(currentMonth, user.id);
    })();
  }, []);

  // Re-fetch when month changes (userId already known)
  useEffect(() => {
    if (userId) fetchMonth(currentMonth, userId);
  }, [currentMonth, userId]);

  const prevMonth = () =>
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const grid = buildGrid(currentMonth);
  const selectedKey  = selectedDay ? toDayKey(selectedDay) : null;
  const selectedData = selectedKey ? (dayMap[selectedKey] ?? null) : null;

  // Month-level summary numbers
  const monthTotal    = Object.values(dayMap).reduce((s, d) => s + d.total, 0);
  const monthVerified = Object.values(dayMap).reduce((s, d) => s + d.verified, 0);
  const monthSelf     = Object.values(dayMap).reduce((s, d) => s + d.selfReported, 0);
  const activeDays    = Object.keys(dayMap).length;

  // ── Render helpers ─────────────────────────────────────────

  const renderCell = (day: number | null, idx: number) => {
    if (!day) return <View key={`e${idx}`} style={styles.cell} />;

    const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const key      = toDayKey(cellDate);
    const data     = dayMap[key];
    const isToday  = key === todayKey;
    const isSel    = key === selectedKey;

    return (
      <TouchableOpacity
        key={key}
        style={[styles.cell, isToday && styles.cellToday, isSel && styles.cellSelected]}
        onPress={() => setSelectedDay(cellDate)}
        activeOpacity={0.7}
      >
        <Text style={[styles.cellNum, isToday && styles.cellNumToday, isSel && styles.cellNumSelected]}>
          {day}
        </Text>
        {data ? (
          <View style={[styles.badge, data.total >= 5 && styles.badgeHigh]}>
            <Text style={styles.badgeText}>{data.total > 9 ? '9+' : data.total}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Month navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{fmtMonth(currentMonth)}</Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Ionicons name="chevron-forward" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map(d => (
          <View key={d} style={styles.weekCell}>
            <Text style={styles.weekLabel}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.grid}>
          {grid.map((day, idx) => renderCell(day, idx))}
        </View>
      )}

      {/* Month summary */}
      {!loading && (
        <View style={styles.summary}>
          {monthTotal > 0 ? (
            <>
              <Text style={styles.summaryNum}>{monthTotal}</Text>
              <Text style={styles.summaryLabel}> beers this month</Text>
              <Text style={styles.summaryBreakdown}>
                {'  ·  '}{monthVerified} 📸{'  ·  '}{monthSelf} self-reported{'  ·  '}{activeDays} {activeDays === 1 ? 'day' : 'days'}
              </Text>
            </>
          ) : (
            <Text style={styles.summaryEmpty}>No posts this month</Text>
          )}
        </View>
      )}

      {/* Day detail sheet */}
      <Modal
        visible={selectedDay !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDay(null)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedDay(null)}
            activeOpacity={1}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetDate}>
                  {selectedDay ? fmtDayHeader(selectedDay) : ''}
                </Text>
                {selectedData && (
                  <Text style={styles.sheetSubtitle}>
                    {selectedData.total} 🍺  ·  {selectedData.verified} verified  ·  {selectedData.selfReported} self-reported
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setSelectedDay(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Post list */}
            {!selectedData ? (
              <View style={styles.sheetEmpty}>
                <Text style={styles.sheetEmptyText}>No posts this day</Text>
              </View>
            ) : (
              <FlatList
                data={selectedData.posts}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const v = item.photo_count ?? 1;
                  const s = item.extra_count ?? 0;
                  return (
                    <View style={styles.postRow}>
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.postThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.postInfo}>
                        <View style={styles.postTopRow}>
                          <View style={styles.drinkChip}>
                            <Text style={styles.drinkChipText}>{item.drink_type}</Text>
                          </View>
                          <Text style={styles.postTime}>{fmtTime(item.created_at)}</Text>
                        </View>
                        {item.caption ? (
                          <Text style={styles.postCaption} numberOfLines={2}>{item.caption}</Text>
                        ) : null}
                        <Text style={styles.postBeers}>
                          {v + s} 🍺{s > 0 ? `  (${v} verified · ${s} self-reported)` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                }}
                contentContainerStyle={styles.sheetList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 16,
  },
  monthLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  weekRow: { flexDirection: 'row', paddingHorizontal: GRID_PAD, marginBottom: 2 },
  weekCell: { width: CELL_W, alignItems: 'center', paddingBottom: 6 },
  weekLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GRID_PAD },
  cell: {
    width: CELL_W, height: CELL_H,
    alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6,
  },
  cellToday: {
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  cellSelected: {
    borderRadius: 10,
    backgroundColor: COLORS.primaryGlow, borderWidth: 1, borderColor: COLORS.primary,
  },
  cellNum: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  cellNumToday: { color: COLORS.primary, fontWeight: '800' },
  cellNumSelected: { color: COLORS.primary, fontWeight: '800' },
  badge: {
    marginTop: 3, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeHigh: { backgroundColor: COLORS.primaryDark },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#000' },

  loadingArea: { height: CELL_H * 6, justifyContent: 'center', alignItems: 'center' },

  summary: {
    flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap',
    paddingHorizontal: 20, paddingVertical: 16,
    marginTop: 8, borderTopWidth: 0.5, borderTopColor: COLORS.border,
  },
  summaryNum: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  summaryLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  summaryBreakdown: { width: '100%', fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  summaryEmpty: { fontSize: 14, color: COLORS.textMuted },

  // Day detail sheet
  sheetBackdrop: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '65%', borderTopWidth: 0.5, borderTopColor: COLORS.border,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
    gap: 12,
  },
  sheetDate: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  sheetSubtitle: { fontSize: 12, color: COLORS.textSecondary },
  sheetEmpty: { paddingVertical: 40, alignItems: 'center' },
  sheetEmptyText: { fontSize: 14, color: COLORS.textMuted },
  sheetList: { paddingVertical: 8 },

  postRow: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  postThumb: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: COLORS.surfaceLight, flexShrink: 0,
  },
  postInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  postTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drinkChip: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  drinkChipText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  postTime: { fontSize: 11, color: COLORS.textMuted },
  postCaption: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  postBeers: { fontSize: 12, color: COLORS.textSecondary },
});
