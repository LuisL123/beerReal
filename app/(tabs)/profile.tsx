import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, Alert, ActivityIndicator, Dimensions, Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { Profile, Post } from '@/types';
import BadgeAvatar from '@/components/BadgeAvatar';
import {
  BADGES, BADGE_PRIORITY, BadgeId,
  computeBadges, getPeriodBoundaries, defaultBadge,
  PostData,
} from '@/lib/badges';

const { width: SW } = Dimensions.get('window');
const GRID_CELL = (SW - 3) / 3;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyBadges, setWeeklyBadges] = useState<BadgeId[]>([]);
  const [monthlyBadges, setMonthlyBadges] = useState<BadgeId[]>([]);
  const [pinnedBadge, setPinnedBadge] = useState<string | null>(null);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const router = useRouter();

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: p }, { data: pp }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    if (p) {
      setProfile(p);
      setPinnedBadge(p.pinned_badge);
    }
    if (pp) setPosts(pp);
    setLoading(false);

    loadBadges(user.id, p?.pinned_badge ?? null);
  };

  const loadBadges = async (uid: string, currentPinned: string | null) => {
    setBadgesLoading(true);
    const b = getPeriodBoundaries();

    const [{ data: wk }, { data: pwk }, { data: mo }, { data: pmo }] = await Promise.all([
      supabase.from('posts')
        .select('id, user_id, created_at, photo_count, extra_count, drink_type, reactions(reaction_type)')
        .gte('created_at', b.weekStart).lte('created_at', b.weekEnd),
      supabase.from('posts')
        .select('id, user_id, created_at, photo_count, extra_count, drink_type')
        .gte('created_at', b.prevWeekStart).lte('created_at', b.prevWeekEnd),
      supabase.from('posts')
        .select('id, user_id, created_at, photo_count, extra_count, drink_type, reactions(reaction_type)')
        .gte('created_at', b.monthStart).lte('created_at', b.monthEnd),
      supabase.from('posts')
        .select('id, user_id, created_at, photo_count, extra_count, drink_type')
        .gte('created_at', b.prevMonthStart).lte('created_at', b.prevMonthEnd),
    ]);

    const weeklyMap = computeBadges((wk ?? []) as PostData[], (pwk ?? []) as PostData[]);
    const monthlyMap = computeBadges((mo ?? []) as PostData[], (pmo ?? []) as PostData[]);

    const myWeekly = weeklyMap.get(uid) ?? [];
    const myMonthly = monthlyMap.get(uid) ?? [];

    setWeeklyBadges(myWeekly);
    setMonthlyBadges(myMonthly);

    const allEarned = [...new Set([...myWeekly, ...myMonthly])];
    let computedPinned = currentPinned;

    if (currentPinned && !allEarned.includes(currentPinned as BadgeId)) {
      computedPinned = defaultBadge(allEarned);
      supabase.from('profiles').update({ pinned_badge: computedPinned }).eq('id', uid);
    } else if (!currentPinned && allEarned.length > 0) {
      computedPinned = defaultBadge(allEarned);
      supabase.from('profiles').update({ pinned_badge: computedPinned }).eq('id', uid);
    }

    setPinnedBadge(computedPinned);
    setBadgesLoading(false);
  };

  const savePinnedBadge = async (badge: BadgeId) => {
    setPinnedBadge(badge);
    setPickerVisible(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ pinned_badge: badge }).eq('id', user.id);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const signOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const allBadges = [...new Set([...weeklyBadges, ...monthlyBadges])];
  const hasBadges = weeklyBadges.length > 0 || monthlyBadges.length > 0;

  const renderChip = (badge: BadgeId) => {
    const info = BADGES[badge];
    const isPinned = pinnedBadge === badge;
    return (
      <View key={badge} style={[styles.chip, isPinned && styles.chipPinned]}>
        <Text style={styles.chipEmoji}>{info.emoji}</Text>
        <Text style={[styles.chipLabel, isPinned && styles.chipLabelPinned]}>{info.label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.push('/activity')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Profile</Text>
              <TouchableOpacity onPress={signOut} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="log-out-outline" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.info}>
              <BadgeAvatar username={profile?.username ?? '?'} size={82} badge={pinnedBadge} />
              <Text style={styles.username}>@{profile?.username}</Text>

              <View style={styles.counter}>
                <Text style={styles.counterEmoji}>🍺</Text>
                <Text style={styles.counterNum}>{profile?.beer_count ?? 0}</Text>
                <Text style={styles.counterLabel}>beers</Text>
                {((profile?.verified_beer_count ?? 0) > 0 || (profile?.self_reported_count ?? 0) > 0) && (
                  <Text style={styles.counterBreakdown}>
                    {profile?.verified_beer_count ?? 0} 📸 verified · {profile?.self_reported_count ?? 0} self-reported
                  </Text>
                )}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{posts.length}</Text>
                  <Text style={styles.statKey}>posts</Text>
                </View>
              </View>
            </View>

            {/* Badges section */}
            {(hasBadges || badgesLoading) && (
              <View style={styles.badgeSection}>
                <Text style={styles.badgeSectionTitle}>BADGES</Text>

                {badgesLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 10 }} />
                ) : (
                  <>
                    {weeklyBadges.length > 0 && (
                      <>
                        <Text style={styles.badgePeriod}>THIS WEEK</Text>
                        <View style={styles.badgeChips}>
                          {weeklyBadges.map(renderChip)}
                        </View>
                      </>
                    )}
                    {monthlyBadges.length > 0 && (
                      <>
                        <Text style={[styles.badgePeriod, weeklyBadges.length > 0 && { marginTop: 12 }]}>
                          THIS MONTH
                        </Text>
                        <View style={styles.badgeChips}>
                          {monthlyBadges.map(renderChip)}
                        </View>
                      </>
                    )}
                    {allBadges.length >= 2 && (
                      <TouchableOpacity style={styles.pinBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
                        <Text style={styles.pinBtnText}>
                          {pinnedBadge && BADGES[pinnedBadge as BadgeId]
                            ? `${BADGES[pinnedBadge as BadgeId].emoji} ${BADGES[pinnedBadge as BadgeId].label} pinned`
                            : 'Set pinned badge'}
                        </Text>
                        <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            <View style={styles.divider} />
          </>
        }
        renderItem={({ item }) => (
          <Image source={{ uri: item.image_url }} style={styles.gridImg} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📸</Text>
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        }
      />

      {/* Badge picker modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.pickerBackdrop}>
          <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>PIN A BADGE</Text>
            {BADGE_PRIORITY.filter(b => allBadges.includes(b)).map(badge => (
              <TouchableOpacity
                key={badge}
                style={[styles.pickerRow, pinnedBadge === badge && styles.pickerRowActive]}
                onPress={() => savePinnedBadge(badge)}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerRowEmoji}>{BADGES[badge].emoji}</Text>
                <Text style={styles.pickerRowLabel}>{BADGES[badge].label}</Text>
                {pinnedBadge === badge && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  info: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  username: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 24, marginTop: 14 },
  counter: {
    alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 20, paddingVertical: 22, paddingHorizontal: 44,
    marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
    minWidth: 180,
  },
  counterEmoji: { fontSize: 40, marginBottom: 8 },
  counterNum: { fontSize: 56, fontWeight: '900', color: COLORS.primary, lineHeight: 64 },
  counterLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500', marginTop: 2 },
  counterBreakdown: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500', marginTop: 6, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 32 },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statKey: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },

  // Badges
  badgeSection: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, borderWidth: 0.5, borderColor: COLORS.border,
  },
  badgeSectionTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 1, marginBottom: 10,
  },
  badgePeriod: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 0.8, marginBottom: 6,
  },
  badgeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.surfaceLight, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipPinned: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryGlow },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  chipLabelPinned: { color: COLORS.primary },
  pinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 14, alignSelf: 'flex-start',
  },
  pinBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  divider: { height: 0.5, backgroundColor: COLORS.border },
  gridImg: { width: GRID_CELL, height: GRID_CELL, margin: 0.5, backgroundColor: COLORS.surfaceLight },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },

  // Badge picker modal
  pickerBackdrop: {
    flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingBottom: 40,
    borderTopWidth: 0.5, borderTopColor: COLORS.border,
  },
  pickerTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 1, textAlign: 'center', marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 12, marginHorizontal: 8,
  },
  pickerRowActive: { backgroundColor: COLORS.primaryGlow },
  pickerRowEmoji: { fontSize: 24 },
  pickerRowLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
});
