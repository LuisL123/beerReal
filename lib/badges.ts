export const BADGE_PRIORITY = [
  // Volume
  'drinker', 'took_it_easy', 'most_improved', 'biggest_session',
  // Reactions
  'mr_sus', 'most_respected', 'rough_patch',
  // Behavior
  'on_a_streak', 'ghost',
  // Drink type
  'hop_head', 'wine_enthusiast', 'cocktail_connoisseur', 'stout_lout', 'variety_pack',
] as const;

export type BadgeId = typeof BADGE_PRIORITY[number];

export interface BadgeInfo {
  id: BadgeId;
  emoji: string;
  label: string;
}

export const BADGES: Record<BadgeId, BadgeInfo> = {
  drinker:               { id: 'drinker',               emoji: '👑', label: 'Top Drinker' },
  took_it_easy:          { id: 'took_it_easy',          emoji: '🪶', label: 'Took It Easy' },
  most_improved:         { id: 'most_improved',         emoji: '📈', label: 'Most Improved' },
  biggest_session:       { id: 'biggest_session',       emoji: '💥', label: 'Biggest Session' },
  mr_sus:                { id: 'mr_sus',                emoji: '🧐', label: 'Mr/Ms Sus' },
  most_respected:        { id: 'most_respected',        emoji: '🏆', label: 'Most Respected' },
  rough_patch:           { id: 'rough_patch',           emoji: '🤢', label: 'Rough Patch' },
  on_a_streak:           { id: 'on_a_streak',           emoji: '🔥', label: 'On a Streak' },
  ghost:                 { id: 'ghost',                 emoji: '👻', label: 'Ghost' },
  hop_head:              { id: 'hop_head',              emoji: '🍺', label: 'Hop Head' },
  wine_enthusiast:       { id: 'wine_enthusiast',       emoji: '🍷', label: 'Wine Enthusiast' },
  cocktail_connoisseur:  { id: 'cocktail_connoisseur',  emoji: '🍸', label: 'Cocktail Connoisseur' },
  stout_lout:            { id: 'stout_lout',            emoji: '🖤', label: 'Stout Lout' },
  variety_pack:          { id: 'variety_pack',          emoji: '🌈', label: 'Variety Pack' },
};

export interface PostData {
  id: string;
  user_id: string;
  created_at: string;
  photo_count: number;
  extra_count: number;
  drink_type: string;
  reactions?: { reaction_type: string }[];
}

interface UserStats {
  total: number;
  biggestSession: number;
  maxStreak: number;
  sus: number;
  respect: number;
  rough: number;
  hopHead: number;
  wine: number;
  cocktail: number;
  stout: number;
  distinct: number;
}

function toDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function computeStats(posts: PostData[]): Map<string, UserStats> {
  const byUser = new Map<string, PostData[]>();
  for (const p of posts) {
    if (!byUser.has(p.user_id)) byUser.set(p.user_id, []);
    byUser.get(p.user_id)!.push(p);
  }

  const result = new Map<string, UserStats>();
  for (const [uid, userPosts] of byUser) {
    const sorted = userPosts.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));

    const total = sorted.reduce((s, p) => s + (p.photo_count ?? 1) + (p.extra_count ?? 0), 0);

    const byDay: Record<string, number> = {};
    for (const p of sorted) {
      const day = toDayKey(p.created_at);
      byDay[day] = (byDay[day] ?? 0) + (p.photo_count ?? 1) + (p.extra_count ?? 0);
    }
    const biggestSession = Object.values(byDay).reduce((m, v) => Math.max(m, v), 0);

    const days = Object.keys(byDay).sort();
    let maxStreak = days.length > 0 ? 1 : 0;
    let curStreak = days.length > 0 ? 1 : 0;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1] + 'T12:00:00');
      const curr = new Date(days[i] + 'T12:00:00');
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) {
        curStreak++;
        if (curStreak > maxStreak) maxStreak = curStreak;
      } else {
        curStreak = 1;
      }
    }

    let sus = 0, respect = 0, rough = 0;
    for (const p of sorted) {
      for (const r of (p.reactions ?? [])) {
        if (r.reaction_type === 'suspicious') sus++;
        else if (r.reaction_type === 'respect') respect++;
        else if (r.reaction_type === 'rough') rough++;
      }
    }

    const dtLower = sorted.map(p => p.drink_type.toLowerCase());
    const hopHead = dtLower.filter(d => d.includes('ipa')).length;
    const wine = dtLower.filter(d => d.includes('wine')).length;
    const cocktail = dtLower.filter(d => d.includes('cocktail')).length;
    const stout = dtLower.filter(d => d.includes('stout')).length;
    const distinct = new Set(dtLower).size;

    result.set(uid, { total, biggestSession, maxStreak, sus, respect, rough, hopHead, wine, cocktail, stout, distinct });
  }
  return result;
}

function tieBreak(tiedIds: string[], posts: PostData[]): string {
  let winner = tiedIds[0];
  let earliest = '';
  for (const uid of tiedIds) {
    const first = posts
      .filter(p => p.user_id === uid)
      .reduce((min, p) => (!min || p.created_at < min ? p.created_at : min), '');
    if (!earliest || (first && first < earliest)) {
      earliest = first;
      winner = uid;
    }
  }
  return winner;
}

function findMaxWinner(
  userIds: string[],
  getValue: (uid: string) => number,
  minValue: number,
  posts: PostData[],
): string | null {
  const pairs = userIds.map(uid => ({ uid, val: getValue(uid) })).filter(x => x.val >= minValue);
  if (pairs.length === 0) return null;
  const max = pairs.reduce((m, x) => Math.max(m, x.val), -Infinity);
  const tied = pairs.filter(x => x.val === max).map(x => x.uid);
  return tied.length === 1 ? tied[0] : tieBreak(tied, posts);
}

// Returns a map of userId → array of earned BadgeIds for the given period.
// Ties go to whoever has the earliest qualifying post.
export function computeBadges(
  currentPosts: PostData[],
  prevPosts: PostData[],
): Map<string, BadgeId[]> {
  const currentStats = computeStats(currentPosts);
  const prevStats = computeStats(prevPosts);
  const currentUsers = [...currentStats.keys()];

  const badges = new Map<string, BadgeId[]>();
  const award = (uid: string, badge: BadgeId) => {
    if (!badges.has(uid)) badges.set(uid, []);
    badges.get(uid)!.push(badge);
  };

  // Top Drinker
  const drinker = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.total ?? 0, 1, currentPosts);
  if (drinker) award(drinker, 'drinker');

  // Took It Easy (only meaningful when 2+ active users)
  if (currentUsers.length >= 2) {
    const min = currentUsers.reduce((m, uid) => Math.min(m, currentStats.get(uid)?.total ?? Infinity), Infinity);
    const tied = currentUsers.filter(uid => (currentStats.get(uid)?.total ?? 0) === min);
    const easy = tied.length === 1 ? tied[0] : tieBreak(tied, currentPosts);
    if (easy && easy !== drinker) award(easy, 'took_it_easy');
  }

  // Most Improved (positive delta vs previous period)
  const improved = findMaxWinner(
    currentUsers,
    uid => (currentStats.get(uid)?.total ?? 0) - (prevStats.get(uid)?.total ?? 0),
    1,
    currentPosts,
  );
  if (improved) award(improved, 'most_improved');

  // Biggest Session
  const biggest = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.biggestSession ?? 0, 1, currentPosts);
  if (biggest) award(biggest, 'biggest_session');

  // Reaction badges
  const mrSus = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.sus ?? 0, 1, currentPosts);
  if (mrSus) award(mrSus, 'mr_sus');

  const respected = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.respect ?? 0, 1, currentPosts);
  if (respected) award(respected, 'most_respected');

  const roughPatch = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.rough ?? 0, 1, currentPosts);
  if (roughPatch) award(roughPatch, 'rough_patch');

  // On a Streak (min 2 consecutive days)
  const streak = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.maxStreak ?? 0, 2, currentPosts);
  if (streak) award(streak, 'on_a_streak');

  // Ghost: posted last period but not this period
  const currentSet = new Set(currentPosts.map(p => p.user_id));
  for (const uid of new Set(prevPosts.map(p => p.user_id))) {
    if (!currentSet.has(uid)) award(uid, 'ghost');
  }

  // Drink type badges
  const hopHead = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.hopHead ?? 0, 1, currentPosts);
  if (hopHead) award(hopHead, 'hop_head');

  const wineEnth = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.wine ?? 0, 1, currentPosts);
  if (wineEnth) award(wineEnth, 'wine_enthusiast');

  const cocktailC = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.cocktail ?? 0, 1, currentPosts);
  if (cocktailC) award(cocktailC, 'cocktail_connoisseur');

  const stoutL = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.stout ?? 0, 1, currentPosts);
  if (stoutL) award(stoutL, 'stout_lout');

  // Variety Pack (min 3 distinct drink types)
  const variety = findMaxWinner(currentUsers, uid => currentStats.get(uid)?.distinct ?? 0, 3, currentPosts);
  if (variety) award(variety, 'variety_pack');

  return badges;
}

export function getPeriodBoundaries() {
  const now = new Date();

  const dow = now.getDay();
  const daysSinceMonday = (dow + 6) % 7;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  prevWeekEnd.setHours(23, 59, 59, 999);
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekStart.getDate() - 6);
  prevWeekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    prevWeekStart: prevWeekStart.toISOString(),
    prevWeekEnd: prevWeekEnd.toISOString(),
    monthStart: monthStart.toISOString(),
    monthEnd: monthEnd.toISOString(),
    prevMonthStart: prevMonthStart.toISOString(),
    prevMonthEnd: prevMonthEnd.toISOString(),
  };
}

export function defaultBadge(earned: BadgeId[]): BadgeId | null {
  return BADGE_PRIORITY.find(b => earned.includes(b)) ?? null;
}
