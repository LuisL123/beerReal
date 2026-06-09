import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Post } from '@/types';
import { COLORS } from '@/constants/colors';

interface Props {
  post: Post;
  currentUserId: string;
  onCheers: (postId: string, alreadyReacted: boolean) => void;
}

const { width: SW } = Dimensions.get('window');
const CARD_PADDING = 12;
const PHOTO_SIZE = SW - CARD_PADDING * 2;

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

export default function PostCard({ post, currentUserId, onCheers }: Props) {
  const reactions = post.reactions ?? [];
  const reacted = reactions.some((r) => r.user_id === currentUserId);
  const count = reactions.length;
  const username = post.profiles?.username ?? 'unknown';

  const handleCheers = async () => {
    await Haptics.impactAsync(reacted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    onCheers(post.id, reacted);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarChar}>{username[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>@{username}</Text>
        <View style={styles.meta}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{post.drink_type}</Text>
          </View>
          <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
        </View>
      </View>

      <Image source={{ uri: post.image_url }} style={styles.photo} resizeMode="cover" />

      <View style={styles.cardFooter}>
        {post.caption ? (
          <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text>
        ) : null}

        <TouchableOpacity style={styles.cheersRow} onPress={handleCheers} activeOpacity={0.7}>
          <Text style={[styles.cheersEmoji, !reacted && styles.cheersEmojiMuted]}>🍺</Text>
          <Text style={[styles.cheersText, reacted && styles.cheersTextActive]}>
            {count > 0 ? `${count} ${count === 1 ? 'cheer' : 'cheers'}` : 'Cheers'}
          </Text>
        </TouchableOpacity>
      </View>
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
  badge: {
    backgroundColor: COLORS.surfaceLight, paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  time: { fontSize: 11, color: COLORS.textMuted },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, backgroundColor: COLORS.surfaceLight },
  cardFooter: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  caption: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  cheersRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cheersEmoji: { fontSize: 22 },
  cheersEmojiMuted: { opacity: 0.45 },
  cheersText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  cheersTextActive: { color: COLORS.primary },
});
