export type Profile = {
  id: string;
  name: string;
  initial: string;
};

export type Term = { term: string; def: string };

export type ReaderTake = {
  author?: string;
  impressive?: string[];
  thoughts?: string;
  apply?: string;
  other?: string;
};

export type HighlightRow = {
  id: string;
  post_id: string;
  owner_id: string;
  para_idx: number;
  text: string;
  created_at: string;
  profiles?: Profile | null;
};

export type CommentRow = {
  id: string;
  highlight_id: string;
  user_id: string;
  text: string;
  created_at: string;
  profiles?: Profile | null;
};

export type PostRow = {
  id: string;
  title: string;
  source: string;
  url: string | null;
  sharer_id: string;
  icon: string;
  tags: string[];
  paragraphs: string[];
  ai_summary: string;
  terms: Term[];
  reader_take: ReaderTake;
  created_at: string;
  profiles?: Profile | null;
};

export type FeedPost = PostRow & {
  sharer: Profile;
  talkCount: number;
  commentCount: number;
  bookmarked: boolean;
  talked: boolean;
};

export type DraftRow = {
  id: string;
  user_id: string;
  title: string;
  source: string;
  url: string | null;
  step: number;
  paragraphs: string[];
  highlights: { id: string; paraIdx: number; text: string }[];
  comments: Record<string, { text: string; time: string }[]>;
  reason_form: { thoughts: string; apply: string; other: string };
  tags: string[];
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  action: string;
  snippet: string;
  post_id: string | null;
  read: boolean;
  created_at: string;
  profiles?: Profile | null;
};
