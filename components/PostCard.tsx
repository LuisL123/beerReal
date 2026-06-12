import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, Modal, TouchableWithoutFeedback,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Post, Comment, ReactionKind } from '@/types';
import { COLORS } from '@/constants/colors';
import { REACTIONS } from '@/constants/reactions';

interface Props {
  post: Post;
  currentUserId: string;
  onReact: (postId: string, type: ReactionKind, isRemoving: boolean) => void;
  onCommentPress: (postId: string) => void;
}

const { width: SW } = Dimensions.get('window');
const CARD_PADDING = 12;
const PHOTO_SIZE = SW - CARD_PADDING * 2;

function formatPostTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date);
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  const dateStr = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
  return `${dateStr}, ${time}`;
}

function CommentPreview({ comments, onPress }: { comments: Comment[]; onPress: () => void }) {
  const sorted = [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const preview = sorted.slice(-2);
  const count = comments.length;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.commentSection}>
      {count === 0 ? (
        <Text style={styles.addCommentPrompt}>Add a comment…</Text>
      ) : (
        <>
          {preview.map(c => {
            const uname = c.profiles?.username ?? 'unknown';
            const body = c.body
              ? (c.gif_url ? `${c.body} 🖼` : c.body)
              : '🖼 GIF';
            return (
              <View key={c.id} style={styles.previewRow}>
                <View style={styles.previewAvatar}>
                  <Text style={styles.previewAvatarChar}>{uname[0]?.toUpperCase()}</Text>
                </View>
                <Text style={styles.previewLine} numberOfLines={1}>
                  <Text style={styles.previewUsername}>@{uname} </Text>
                  {body}
                </Text>
              </View>
            );
          })}
          <Text style={styles.viewAllText}>
            View all {count} {count === 1 ? 'comment' : 'comments'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function PostCard({ post, currentUserId, onReact, onCommentPress }: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const reactions = post.reactions ?? [];
  const username = post.profiles?.username ?? 'unknown';
  const photoCount = post.photo_count ?? 1;
  const allPhotos = [post.image_url, ...(post.image_urls ?? [])];

  const reactionData = REACTIONS.map(r => ({
    ...r,
    count: reactions.filter(rx => rx.reaction_type === r.type).length,
    userReacted: reactions.some(rx => rx.reaction_type === r.type && rx.user_id === currentUserId),
  }));

  const visibleBubbles = reactionData.filter(r => r.count > 0);

  const handleBubbleTap = (type: ReactionKind, userReacted: boolean) => {
    Haptics.impactAsync(userReacted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    onReact(post.id, type, userReacted);
  };

  const handlePickerTap = (type: ReactionKind, userReacted: boolean) => {
    Haptics.impactAsync(userReacted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    onReact(post.id, type, userReacted);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarChar}>{username[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>@{username}</Text>
        <View style={styles.meta}>
          <View style={styles.drinkBadge}>
            <Text style={styles.drinkBadgeText}>{post.drink_type}</Text>
          </View>
          <Text style={styles.time}>{formatPostTime(post.created_at)}</Text>
        </View>
      </View>

      {photoCount > 1 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: PHOTO_SIZE }}
          >
            {allPhotos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.photo} resizeMode="cover" />
            ))}
          </ScrollView>
          <View style={styles.dotsRow}>
            {allPhotos.map((_, idx) => (
              <View key={idx} style={styles.dot} />
            ))}
          </View>
        </View>
      ) : (
        <Image source={{ uri: post.image_url }} style={styles.photo} resizeMode="cover" />
      )}

      <View style={styles.cardFooter}>
        {post.caption ? (
          <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text>
        ) : null}

        {(post.extra_count ?? 0) > 0 && (
          <View style={styles.extraBadge}>
            <Text style={styles.extraBadgeText}>+{post.extra_count} more (unverified)</Text>
          </View>
        )}

        <CommentPreview
          comments={post.comments ?? []}
          onPress={() => onCommentPress(post.id)}
        />

        <View style={styles.reactionsRow}>
          {visibleBubbles.map(r => (
            <TouchableOpacity
              key={r.type}
              style={[styles.bubble, r.userReacted && styles.bubbleActive]}
              onPress={() => handleBubbleTap(r.type, r.userReacted)}
              activeOpacity={0.7}
            >
              <Text style={styles.bubbleEmoji}>{r.emoji}</Text>
              <Text style={[styles.bubbleCount, r.userReacted && styles.bubbleCountActive]}>
                {r.count}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          {/* Invisible full-screen tap target to close */}
          <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>React</Text>
            <View style={styles.pickerGrid}>
              {reactionData.map(r => (
                <TouchableOpacity
                  key={r.type}
                  style={[styles.pickerItem, r.userReacted && styles.pickerItemActive]}
                  onPress={() => handlePickerTap(r.type, r.userReacted)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerEmoji}>{r.emoji}</Text>
                  <Text style={[styles.pickerLabel, r.userReacted && styles.pickerLabelActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: CARD_PADDING,
    marginVertical: 6,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarChar: { fontSize: 14, fontWeight: '900', color: '#000' },
  username: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  meta: { alignItems: 'flex-end', gap: 4 },
  drinkBadge: {
    backgroundColor: COLORS.surfaceLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  drinkBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  time: { fontSize: 11, color: COLORS.textMuted },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, backgroundColor: COLORS.surfaceLight },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.primary },
  cardFooter: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  caption: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  extraBadge: {
    alignSelf: 'flex-start', backgroundColor: COLORS.surfaceLight,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  extraBadgeText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },

  commentSection: { gap: 5 },
  addCommentPrompt: { fontSize: 13, color: COLORS.textMuted },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  previewAvatar: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  previewAvatarChar: { fontSize: 8, fontWeight: '900', color: COLORS.textSecondary },
  previewLine: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },
  previewUsername: { fontWeight: '700' },
  viewAllText: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  // Reaction bubbles
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  bubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceLight, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  bubbleActive: {
    backgroundColor: COLORS.primaryGlow, borderColor: COLORS.primary,
  },
  bubbleEmoji: { fontSize: 16 },
  bubbleCount: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  bubbleCountActive: { color: COLORS.primary },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { fontSize: 20, color: COLORS.textSecondary, lineHeight: 24 },

  // Picker modal
  modalBackdrop: {
    flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36,
    borderTopWidth: 0.5, borderColor: COLORS.border,
  },
  pickerTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textMuted,
    textAlign: 'center', marginBottom: 16, letterSpacing: 0.5,
  },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  pickerItem: {
    width: '33.33%', alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, gap: 6,
  },
  pickerItemActive: { backgroundColor: COLORS.primaryGlow },
  pickerEmoji: { fontSize: 30 },
  pickerLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  pickerLabelActive: { color: COLORS.primary },
});
