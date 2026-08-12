/**
 * Supabase 스키마 타입 (수기 작성 뼈대).
 *
 * 실제 개발 시에는 마이그레이션 적용 후 아래 CLI 로 자동 생성해 이 파일을
 * 대체하는 것을 권장합니다:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * supabase/migrations 의 스키마와 1:1 대응합니다.
 */

import type { Insight } from "@/lib/insight";

export type ShareKind = "link" | "text";
export type DiscussionKind = "link" | "text";
export type MemberRole = "owner" | "member";
export type LikeTarget = "share" | "comment" | "discussion";
export type CommentTarget = "share" | "discussion";
export type NotificationType =
  | "discussion_pending"
  | "cadence"
  | "comment"
  | "reply"
  | "member_joined";

// ===== distill (테크블로그 수집 + 인사이트 + 토론) =====
export type Topic =
  | "dev"
  | "product"
  | "design"
  | "planning"
  | "data_ai"
  | "infra"
  | "career";
export type CollectMethod = "rss_full" | "rss_scrape" | "nuxt" | "listscrape";
export type ReactionTarget = "opinion" | "comment" | "article";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          role_title: string | null;
          theme: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          role_title?: string | null;
          theme?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 블로그(수집 소스) ----
      blogs: {
        Row: {
          id: string;
          key: string;
          name: string;
          homepage: string | null;
          rss_url: string | null;
          collect: CollectMethod;
          brand_color: string | null;
          active: boolean;
          last_collected_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          homepage?: string | null;
          rss_url?: string | null;
          collect?: CollectMethod;
          brand_color?: string | null;
          active?: boolean;
          last_collected_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blogs"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 아티클(자동 수집 글) ----
      articles: {
        Row: {
          id: string;
          blog_id: string;
          url: string;
          title: string;
          author: string | null;
          published_at: string | null;
          summary: string | null;
          body: string | null;
          og_image: string | null;
          topic: Topic | null;
          tags: string[];
          ai_summaries: Record<string, string>;
          like_count: number;
          submitted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          blog_id: string;
          url: string;
          title: string;
          author?: string | null;
          published_at?: string | null;
          summary?: string | null;
          body?: string | null;
          og_image?: string | null;
          topic?: Topic | null;
          tags?: string[];
          ai_summaries?: Record<string, string>;
          like_count?: number;
          submitted_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["articles"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 의견(내 인사이트) ----
      opinions: {
        Row: {
          id: string;
          article_id: string;
          author_id: string | null;
          insight: Insight;
          like_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          author_id?: string | null;
          insight: Insight;
          like_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["opinions"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 토론(의견 대댓글) ----
      opinion_comments: {
        Row: {
          id: string;
          opinion_id: string;
          parent_id: string | null;
          author_id: string | null;
          text: string;
          quote: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          opinion_id: string;
          parent_id?: string | null;
          author_id?: string | null;
          text: string;
          quote?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["opinion_comments"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 문장 하이라이트 ----
      article_highlights: {
        Row: {
          id: string;
          article_id: string;
          author_id: string | null;
          sentence_index: number;
          quote: string | null;
          color: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          author_id?: string | null;
          sentence_index: number;
          quote?: string | null;
          color?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["article_highlights"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 내 단어장(어려운 단어 + AI 뜻) ----
      user_words: {
        Row: {
          id: string;
          user_id: string;
          article_id: string | null;
          term: string;
          reading: string | null;
          definition: string | null;
          context: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          article_id?: string | null;
          term: string;
          reading?: string | null;
          definition?: string | null;
          context?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_words"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 북마크 ----
      article_bookmarks: {
        Row: { user_id: string; article_id: string; created_at: string };
        Insert: { user_id: string; article_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["article_bookmarks"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 좋아요(의견/토론) ----
      reactions: {
        Row: {
          user_id: string;
          target_type: ReactionTarget;
          target_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          target_type: ReactionTarget;
          target_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 관심 주제 ----
      user_topics: {
        Row: { user_id: string; topic: Topic };
        Insert: { user_id: string; topic: Topic };
        Update: Partial<Database["public"]["Tables"]["user_topics"]["Insert"]>;
        Relationships: [];
      };
      studies: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          invite_code: string;
          share_cadence: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          invite_code: string;
          share_cadence?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["studies"]["Insert"]>;
        Relationships: [];
      };
      study_members: {
        Row: {
          study_id: string;
          user_id: string;
          role: MemberRole;
          joined_at: string;
        };
        Insert: {
          study_id: string;
          user_id: string;
          role?: MemberRole;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["study_members"]["Insert"]>;
        Relationships: [];
      };
      shares: {
        Row: {
          id: string;
          study_id: string;
          author_id: string | null;
          kind: ShareKind;
          day_of_week: number;
          shared_date: string;
          title: string;
          url: string | null;
          source: string | null;
          og_image: string | null;
          og_description: string | null;
          body: string | null;
          note: string | null;
          image_urls: string[] | null;
          ai_summary: string | null;
          ai_summaries: Record<string, string> | null;
          article_text: string | null;
          tags: string[] | null;
          promoted_discussion_id: string | null;
          insight: Insight | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          study_id: string;
          author_id?: string | null;
          kind: ShareKind;
          day_of_week: number;
          shared_date: string;
          title: string;
          url?: string | null;
          source?: string | null;
          og_image?: string | null;
          og_description?: string | null;
          body?: string | null;
          note?: string | null;
          image_urls?: string[] | null;
          ai_summary?: string | null;
          ai_summaries?: Record<string, string> | null;
          article_text?: string | null;
          tags?: string[] | null;
          promoted_discussion_id?: string | null;
          insight?: Insight | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shares"]["Insert"]>;
        Relationships: [];
      };
      discussions: {
        Row: {
          id: string;
          study_id: string;
          author_id: string | null;
          week_label: string;
          week_start: string;
          title: string;
          prompt: string | null;
          body: string | null;
          kind: DiscussionKind;
          url: string | null;
          source: string | null;
          og_image: string | null;
          og_description: string | null;
          article_text: string | null;
          is_active: boolean;
          conclusion_comment_id: string | null;
          ai_summary: string | null;
          ai_summaries: Record<string, string> | null;
          tags: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          study_id: string;
          author_id?: string | null;
          week_label: string;
          week_start: string;
          title: string;
          prompt?: string | null;
          body?: string | null;
          kind?: DiscussionKind;
          url?: string | null;
          source?: string | null;
          og_image?: string | null;
          og_description?: string | null;
          article_text?: string | null;
          is_active?: boolean;
          conclusion_comment_id?: string | null;
          ai_summary?: string | null;
          ai_summaries?: Record<string, string> | null;
          tags?: string[] | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["discussions"]["Insert"]>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          study_id: string;
          target_type: CommentTarget;
          target_id: string;
          parent_id: string | null;
          author_id: string | null;
          text: string;
          quote: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          study_id: string;
          target_type: CommentTarget;
          target_id: string;
          parent_id?: string | null;
          author_id?: string | null;
          text: string;
          quote?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [];
      };
      likes: {
        Row: {
          user_id: string;
          study_id: string;
          target_type: LikeTarget;
          target_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          study_id: string;
          target_type: LikeTarget;
          target_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["likes"]["Insert"]>;
        Relationships: [];
      };
      discuss_votes: {
        Row: {
          user_id: string;
          study_id: string;
          share_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          study_id: string;
          share_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["discuss_votes"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          study_id: string | null;
          ref_id: string | null;
          text: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          study_id?: string | null;
          ref_id?: string | null;
          text: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      highlights: {
        Row: {
          id: string;
          share_id: string;
          study_id: string;
          author_id: string | null;
          sentence_index: number;
          quote: string | null;
          color: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          share_id: string;
          study_id: string;
          author_id?: string | null;
          sentence_index: number;
          quote?: string | null;
          color?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["highlights"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_study: {
        Args: { _name: string; _description: string | null; _cadence: string };
        Returns: string; // 생성된 study id (uuid)
      };
      join_by_code: {
        Args: { _code: string };
        Returns: { status: "joined" | "already_member"; study_id: string };
      };
      delegate_owner: {
        Args: { _study: string; _target: string };
        Returns: undefined;
      };
      leave_study: {
        Args: { _study: string };
        Returns: undefined;
      };
      regenerate_invite_code: {
        Args: { _study: string };
        Returns: string; // 새 코드
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
