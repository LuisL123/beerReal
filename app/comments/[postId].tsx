import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, Modal, TouchableWithoutFeedback, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { Comment } from '@/types';

const { width: SW } = Dimensions.get('window');
const GIF_COL_WIDTH = (SW - 20) / 2; // 8px padding each side + 4px gap

const QUICK_REPLIES = [
  'rate this 1-10 🍺',
  'where are you?',
  'next round?',
  'looking good 👀',
  'what is that??',
];

const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '';

interface GiphyGif {
  id: string;
  images: {
    fixed_height_small: { url: string };
    original: { url: string };
  };
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

export default function CommentsScreen() {
  const { postId, username } = useLocalSearchParams<{ postId: string; username: string }>();
  const router = useRouter();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);

  const [body, setBody] = useState('');
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  const listRef = useRef<FlatList>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    init();

    const channel = supabase
      .channel(`comments:${postId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'comments',
        filter: `post_id=eq.${postId}`,
      }, () => fetchComments())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('username').eq('id', user.id).single();
      setCurrentUser({ id: user.id, username: profile?.username ?? '' });
    }
    await fetchComments();
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(id, username, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (data) setComments(data as Comment[]);
  };

  // ── GIF search ───────────────────────────────────────────────

  const fetchGifs = async (query: string) => {
    if (!GIPHY_KEY) return;
    setGifLoading(true);
    try {
      const url = query.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=g`;
      const res = await fetch(url);
      const json = await res.json();
      setGifs(json.data ?? []);
    } catch { /* network failures are silent in the picker */ }
    setGifLoading(false);
  };

  const openGifPicker = () => {
    setGifPickerVisible(true);
    if (gifs.length === 0) fetchGifs('');
  };

  const onGifSearchChange = (text: string) => {
    setGifSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchGifs(text), 400);
  };

  const selectGif = (gif: GiphyGif) => {
    setGifUrl(gif.images.original.url);
    setGifPickerVisible(false);
    setGifSearch('');
  };

  // ── Send comment ─────────────────────────────────────────────

  const send = async () => {
    if (!currentUser || (!body.trim() && !gifUrl) || sending) return;
    setSending(true);

    const bodyText = body.trim() || null;
    const gif = gifUrl;

    const optimistic: Comment = {
      id: `opt-${Date.now()}`,
      post_id: postId,
      user_id: currentUser.id,
      body: bodyText,
      gif_url: gif,
      created_at: new Date().toISOString(),
      profiles: { id: currentUser.id, username: currentUser.username, avatar_url: null },
    };

    setComments(prev => [...prev, optimistic]);
    setBody('');
    setGifUrl(null);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: currentUser.id,
      body: bodyText,
      gif_url: gif,
    });

    if (error) {
      Alert.alert('Error', error.message);
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
    } else {
      fetchComments();
    }

    setSending(false);
  };

  // ── Render helpers ───────────────────────────────────────────

  const renderComment = ({ item }: { item: Comment }) => {
    const uname = item.profiles?.username ?? 'unknown';
    return (
      <View style={styles.commentRow}>
        <View style={styles.commentAvatar}>
          <Text style={styles.commentAvatarChar}>{uname[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.commentContent}>
          <View style={styles.commentMeta}>
            <Text style={styles.commentUsername}>@{uname}</Text>
            <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
          </View>
          {item.body ? <Text style={styles.commentText}>{item.body}</Text> : null}
          {item.gif_url ? (
            <Image
              source={{ uri: item.gif_url }}
              style={styles.commentGif}
              resizeMode="cover"
            />
          ) : null}
        </View>
      </View>
    );
  };

  const renderGif = ({ item }: { item: GiphyGif }) => (
    <TouchableOpacity
      style={styles.gifGridItem}
      onPress={() => { Haptics.selectionAsync(); selectGif(item); }}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.images.fixed_height_small.url }}
        style={styles.gifGridImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const canSend = (body.trim().length > 0 || gifUrl !== null) && !sending;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>@{username}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Comments list */}
        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No comments yet — be first 🍺</Text>
              </View>
            }
          />
        )}

        {/* Bottom input area */}
        <View style={styles.bottomArea}>
          {/* GIF preview (when selected) */}
          {gifUrl && (
            <View style={styles.gifPreviewWrap}>
              <Image source={{ uri: gifUrl }} style={styles.gifPreview} resizeMode="cover" />
              <TouchableOpacity style={styles.gifPreviewRemove} onPress={() => setGifUrl(null)}>
                <Ionicons name="close-circle" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Quick reply chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {QUICK_REPLIES.map(chip => (
              <TouchableOpacity
                key={chip}
                style={styles.chip}
                onPress={() => setBody(chip)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment…"
              placeholderTextColor={COLORS.textMuted}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={500}
            />
            <TouchableOpacity style={styles.gifBtn} onPress={openGifPicker} activeOpacity={0.7}>
              <Text style={styles.gifBtnText}>GIF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={send}
              disabled={!canSend}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={16} color={canSend ? '#000' : COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* GIF picker modal */}
      <Modal
        visible={gifPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGifPickerVisible(false)}
      >
        <View style={styles.gifModalBackdrop}>
          <TouchableWithoutFeedback onPress={() => setGifPickerVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={styles.gifSheet}>
            {/* Search bar */}
            <View style={styles.gifSearchRow}>
              <Ionicons name="search-outline" size={17} color={COLORS.textMuted} />
              <TextInput
                style={styles.gifSearchInput}
                placeholder="Search GIFs…"
                placeholderTextColor={COLORS.textMuted}
                value={gifSearch}
                onChangeText={onGifSearchChange}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {gifSearch.length > 0 && (
                <TouchableOpacity onPress={() => { setGifSearch(''); fetchGifs(''); }}>
                  <Ionicons name="close-circle" size={17} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Grid or states */}
            {!GIPHY_KEY ? (
              <View style={styles.gifPlaceholder}>
                <Text style={styles.gifPlaceholderText}>
                  Add EXPO_PUBLIC_GIPHY_API_KEY to .env to enable GIFs
                </Text>
              </View>
            ) : gifLoading ? (
              <View style={styles.gifPlaceholder}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={gifs}
                keyExtractor={(item) => item.id}
                numColumns={2}
                renderItem={renderGif}
                contentContainerStyle={styles.gifGrid}
                columnWrapperStyle={styles.gifGridRow}
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

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  loadingArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Comments list
  listContent: { paddingVertical: 12, paddingHorizontal: 14, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },

  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  commentAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  commentAvatarChar: { fontSize: 12, fontWeight: '900', color: '#000' },
  commentContent: { flex: 1 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  commentUsername: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  commentTime: { fontSize: 11, color: COLORS.textMuted },
  commentText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  commentGif: {
    width: '100%', height: 160, borderRadius: 10, marginTop: 6,
    backgroundColor: COLORS.surfaceLight,
  },

  // Bottom area
  bottomArea: {
    borderTopWidth: 0.5, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  gifPreviewWrap: {
    margin: 8, borderRadius: 10, overflow: 'hidden',
    height: 110, backgroundColor: COLORS.surfaceLight,
  },
  gifPreview: { width: '100%', height: '100%' },
  gifPreviewRemove: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12,
  },

  chipsScroll: { maxHeight: 44 },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingVertical: 10, gap: 8,
  },
  input: {
    flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
    color: COLORS.text, fontSize: 14, maxHeight: 100,
    borderWidth: 1, borderColor: COLORS.border,
  },
  gifBtn: {
    height: 36, paddingHorizontal: 10, borderRadius: 18,
    backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  gifBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.surfaceLight },

  // GIF picker modal
  gifModalBackdrop: {
    flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end',
  },
  gifSheet: {
    height: 420, backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 0.5, borderTopColor: COLORS.border,
    overflow: 'hidden',
  },
  gifSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  gifSearchInput: { flex: 1, color: COLORS.text, fontSize: 14 },
  gifPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  gifPlaceholderText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  gifGrid: { padding: 8 },
  gifGridRow: { gap: 4, marginBottom: 4 },
  gifGridItem: {
    width: GIF_COL_WIDTH, height: GIF_COL_WIDTH * 0.7,
    borderRadius: 8, overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
  },
  gifGridImage: { width: '100%', height: '100%' },
});
