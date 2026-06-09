export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  beer_count: number;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  drink_type: string;
  created_at: string;
  profiles?: Profile;
  reactions?: Reaction[];
}

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  type: string;
  created_at: string;
}
