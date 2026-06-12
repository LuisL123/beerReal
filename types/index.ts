export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  verified_beer_count: number;
  self_reported_count: number;
  beer_count: number; // generated column: verified_beer_count + self_reported_count
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  image_url: string;        // primary/first photo
  image_urls: string[];     // additional photos (index 1…n)
  photo_count: number;      // total photographed beers
  extra_count: number;      // self-reported beers added alongside this post
  caption: string | null;
  drink_type: string;
  created_at: string;
  profiles?: Profile;
  reactions?: Reaction[];
  comments?: Comment[];
}

export type ReactionKind = 'same' | 'rough' | 'jealous' | 'respect' | 'lightweight' | 'suspicious';

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionKind;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string | null;
  gif_url: string | null;
  created_at: string;
  profiles?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}
