import { ReactionKind } from '@/types';

export const REACTIONS: { type: ReactionKind; emoji: string; label: string }[] = [
  { type: 'same',        emoji: '🍺', label: 'same'        },
  { type: 'rough',       emoji: '🤢', label: 'rough'       },
  { type: 'jealous',     emoji: '😤', label: 'jealous'     },
  { type: 'respect',     emoji: '🏆', label: 'respect'     },
  { type: 'lightweight', emoji: '🐌', label: 'lightweight' },
  { type: 'suspicious',  emoji: '🧐', label: 'suspicious'  },
];
