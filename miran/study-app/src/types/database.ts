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
  | "career"
  | "marketing";
export type CollectMethod = "rss_full" | "rss_scrape" | "nuxt" | "listscrape";
/** 수집 소스 성격 — 개발 글 밖의 소스를 구분한다(홈 로고 그리드 묶음). */
export type BlogKind = "tech" | "design" | "product" | "culture";
/** 온보딩에서 받는 직무. 역할별 요약·직군 배지·단어장 개인화가 전부 이 값을 쓴다. */
export type JobRole = "planner" | "designer" | "marketer" | "dev" | "data" | "other";
/** 글 난이도 배지 — 사람을 등급 매기지 않고 '글의 성격'을 말한다. */
export type ArticleLevel = "easy" | "terms" | "code";
/** 원탭 스탬프 — 글을 다 읽고 버튼 하나만 누르는 반응. */
export type StampKind = "apply" | "reason" | "disagree" | "hard";

/**
 * 결정 카드 — "어떤 테크를 썼나"가 아니라 "어떤 문제를 어떻게 풀었나".
 * 수집 시 AI 배치가 채우고, 본문에 트레이드오프 서술이 없으면 null 로 둔다(억지로 만들지 않는다).
 */
export interface ArticleDecision {
  problem: string; // 무슨 문제를 만났나
  constraint: string; // 어떤 제약이 있었나
  chosen: string; // 선택한 방법
  rejected: string; // 버린 대안 ← 인사이트 질문 1개가 여기서 나온다
  metric: string; // 결과 지표(숫자가 있으면 숫자로)
}

/** 본문 용어 풀이 — 단어를 누른 것 자체가 '이 영역에 약하다'는 신호가 된다. */
export interface ArticleTerm {
  term: string; // 본문에 등장한 용어
  plain: string; // 한 줄 설명(1단)
  why: string; // 이 글에서 왜 중요한지
  domain: string; // dev/design/marketing/data/infra/product/biz
}
export type ReactionTarget = "opinion" | "comment" | "article" | "community";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          role_title: string | null;
          job_role: JobRole | null;
          onboarded_at: string | null;
          theme: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          role_title?: string | null;
          job_role?: JobRole | null;
          onboarded_at?: string | null;
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
          kind: BlogKind;
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
          kind?: BlogKind;
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
          level: ArticleLevel | null;
          read_minutes: number | null;
          decision: ArticleDecision | null;
          question: string | null;
          terms: ArticleTerm[];
          ai_summaries: Record<string, string>;
          like_count: number;
          view_count: number;
          opinion_count: number;
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
          level?: ArticleLevel | null;
          read_minutes?: number | null;
          decision?: ArticleDecision | null;
          question?: string | null;
          terms?: ArticleTerm[];
          ai_summaries?: Record<string, string>;
          like_count?: number;
          view_count?: number;
          opinion_count?: number;
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
      // 댓글 스레드 — 의견(opinion_id) 또는 커뮤니티 자유글(community_post_id) 중 하나에 달린다(스키마 §23).
      opinion_comments: {
        Row: {
          id: string;
          opinion_id: string | null;
          community_post_id: string | null;
          parent_id: string | null;
          author_id: string | null;
          text: string;
          quote: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          opinion_id?: string | null;
          community_post_id?: string | null;
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
          easy_definition: string | null;
          context: string | null;
          domain: string | null;
          job_role: JobRole | null;
          hit_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          article_id?: string | null;
          term: string;
          reading?: string | null;
          definition?: string | null;
          easy_definition?: string | null;
          context?: string | null;
          domain?: string | null;
          job_role?: JobRole | null;
          hit_count?: number;
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
      // ---- distill: 기업(블로그) 즐겨찾기 ----
      user_blog_favorites: {
        Row: { user_id: string; blog_id: string; created_at: string };
        Insert: { user_id: string; blog_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["user_blog_favorites"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 알림 ----
      app_notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: "new_article" | "comment" | "reply" | "follow_opinion";
          actor_id: string | null;
          article_id: string | null;
          opinion_id: string | null;
          title: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: "new_article" | "comment" | "reply" | "follow_opinion";
          actor_id?: string | null;
          article_id?: string | null;
          opinion_id?: string | null;
          title?: string;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_notifications"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 읽은 아티클 ----
      article_reads: {
        Row: { user_id: string; article_id: string; created_at: string };
        Insert: { user_id: string; article_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["article_reads"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 원탭 스탬프(글 다 읽고 누르는 반응) ----
      article_stamps: {
        Row: { user_id: string; article_id: string; kind: StampKind; created_at: string };
        Insert: { user_id: string; article_id: string; kind: StampKind; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["article_stamps"]["Insert"]>;
        Relationships: [];
      };
      community_posts: {
        Row: {
          id: string;
          author_id: string | null;
          title: string;
          body: string;
          insight: Record<string, unknown>;
          like_count: number;
          comment_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string | null;
          title: string;
          body: string;
          insight?: Record<string, unknown>;
          like_count?: number;
          comment_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_posts"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 의견(독후감) 임시저장 ----
      opinion_drafts: {
        Row: {
          id: string;
          user_id: string;
          article_id: string;
          insight: Insight;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          article_id: string;
          insight?: Insight;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["opinion_drafts"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 팔로우 ----
      user_follows: {
        Row: { follower_id: string; following_id: string; created_at: string };
        Insert: { follower_id: string; following_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["user_follows"]["Insert"]>;
        Relationships: [];
      };
      // ---- distill: 검색어 로깅(급상승 검색어) ----
      search_logs: {
        Row: { id: string; term: string; user_id: string | null; created_at: string };
        Insert: { id?: string; term: string; user_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["search_logs"]["Insert"]>;
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
      trending_searches: {
        Args: { lim?: number };
        Returns: { term: string; cnt: number }[];
      };
      increment_article_view: {
        Args: { aid: string };
        Returns: undefined;
      };
      // 글별 원탭 스탬프 집계(카드/상세의 "💡 12").
      article_stamp_counts: {
        Args: { p_article_ids: string[] };
        Returns: { article_id: string; kind: StampKind; cnt: number }[];
      };
      // 연속 읽기(벌칙 없음) + 이번 달 누적. streak 이 0 이면 화면에서 숨긴다.
      my_reading_stats: {
        Args: { p_user_id: string };
        Returns: {
          streak_days: number;
          month_days: number;
          month_reads: number;
          month_opinions: number;
        }[];
      };
      // "기획자 12명이 이 글을 읽었어요" — 직군 배지.
      article_reader_roles: {
        Args: { p_article_id: string };
        Returns: { job_role: JobRole; cnt: number }[];
      };
      // 목록 카드용 — 글마다 1등 직군 하나만, 한 번에(§31).
      all_top_reader_roles: {
        Args: Record<string, never>;
        Returns: { article_id: string; job_role: JobRole; cnt: number }[];
      };
      // 내가 자주 막히는 영역 — 단어 클릭 수를 도메인별로 합친 것.
      my_weak_domains: {
        Args: { p_user_id: string };
        Returns: { domain: string; cnt: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
