import { View, Text } from 'react-native';
import { BADGES, BadgeInfo } from '@/lib/badges';
import { COLORS } from '@/constants/colors';

interface Props {
  username: string;
  size: number;
  badge?: string | null;
}

export default function BadgeAvatar({ username, size, badge }: Props) {
  const badgeInfo: BadgeInfo | null = badge ? ((BADGES as Record<string, BadgeInfo>)[badge] ?? null) : null;
  const overlaySize = Math.round(size * 0.46);

  return (
    <View style={{ width: size, height: size }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ fontSize: Math.round(size * 0.38), fontWeight: '900', color: '#000' }}>
          {username?.[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      {badgeInfo && (
        <View style={{
          position: 'absolute', bottom: 0, right: 0,
          width: overlaySize, height: overlaySize, borderRadius: overlaySize / 2,
          backgroundColor: COLORS.surface,
          borderWidth: 1.5, borderColor: COLORS.background,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ fontSize: Math.round(overlaySize * 0.62), lineHeight: overlaySize }}>
            {badgeInfo.emoji}
          </Text>
        </View>
      )}
    </View>
  );
}
