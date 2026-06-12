import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { Profile, Post } from '@/types';

const { width: SW } = Dimensions.get('window');
const GRID_CELL = (SW - 3) / 3;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: p }, { data: pp }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    if (p) setProfile(p);
    if (pp) setPosts(pp);
    setLoading(false);
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
              <Text style={styles.headerTitle}>Profile</Text>
              <TouchableOpacity onPress={signOut} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="log-out-outline" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.info}>
              <View style={styles.avatar}>
                <Text style={styles.avatarChar}>
                  {profile?.username?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
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
  avatar: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  avatarChar: { fontSize: 34, fontWeight: '900', color: '#000' },
  username: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 24 },
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
  divider: { height: 0.5, backgroundColor: COLORS.border },
  gridImg: { width: GRID_CELL, height: GRID_CELL, margin: 0.5, backgroundColor: COLORS.surfaceLight },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});
