import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { Post, Reaction, ReactionKind } from '@/types';
import PostCard from '@/components/PostCard';

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const router = useRouter();

  const fetchPosts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const { data } = await supabase
      .from('posts')
      .select('*, profiles(id, username, avatar_url, pinned_badge), reactions(id, user_id, reaction_type), comments(id, body, gif_url, created_at, user_id, profiles(id, username))')
      .order('created_at', { ascending: false })
      .limit(30);

    if (data) setPosts(data as Post[]);
  };

  const load = async () => {
    setLoading(true);
    await fetchPosts();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, fetchPosts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleReact = async (postId: string, type: ReactionKind, isRemoving: boolean) => {
    if (!currentUserId) return;

    // Optimistic update — apply immediately so the UI responds without waiting for the DB
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const existing = p.reactions ?? [];
      const updated: Reaction[] = isRemoving
        ? existing.filter(r => !(r.reaction_type === type && r.user_id === currentUserId))
        : [...existing, { id: `opt-${Date.now()}`, post_id: postId, user_id: currentUserId, reaction_type: type, created_at: new Date().toISOString() }];
      return { ...p, reactions: updated };
    }));

    // Sync to DB, then fetch authoritative state
    if (isRemoving) {
      await supabase.from('reactions').delete()
        .eq('post_id', postId).eq('user_id', currentUserId).eq('reaction_type', type);
    } else {
      await supabase.from('reactions').insert({
        post_id: postId, user_id: currentUserId, reaction_type: type,
      });
    }
    fetchPosts();
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cheers</Text>
        <Text style={styles.headerEmoji}>🍺</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={currentUserId}
            onReact={handleReact}
            onCommentPress={(postId) => router.push({
              pathname: '/comments/[postId]',
              params: { postId, username: item.profiles?.username ?? '' },
            })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={posts.length === 0 ? styles.emptyOuter : { paddingBottom: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🍺</Text>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySub}>Be the first to share your drink!</Text>
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border, gap: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: COLORS.primary, letterSpacing: -0.5 },
  headerEmoji: { fontSize: 24 },
  emptyOuter: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptySub: { fontSize: 15, color: COLORS.textSecondary },
});
