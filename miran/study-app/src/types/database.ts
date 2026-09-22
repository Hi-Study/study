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
/**
 * 주제 대분류 — **결론이 무엇인가**로 나눈다(docs/분류-기준-v1.md).
 *
 * 옛 분류(dev/product/design/planning/data_ai/infra/career/marketing)는 개발자 언어였다.
 * "인프라", "데이터/AI" 같은 칸은 비개발자가 무엇이 들어 있는지 짐작할 수 없다.
 * 판단 순서가 정해져 있고(품질·위험 → AI → 제품 → 데이터 → 사용자 → 사업 → 협업),
 * 위에서부터 처음 "예"가 나오는 칸이 대분류다.
 */
export type Topic =
  | "quality_risk"
  | "ai_use"
  | "product_plan"
  | "data_exp"
  | "user_exp"
  | "biz_brand"
  | "collab";
/**
 * 기획자용 대분류 — **DB(`articles.planner_category`)에 한글 라벨 그대로** 저장돼 있다.
 * `Topic`(영문 키)과 같은 7개를 가리킨다. 지금은 두 표현이 병존한다:
 *   · `planner_category` — 기준 v1로 분류한 245건이 실제로 채워져 있다(마이그레이션 0015)
 *   · `topic`            — 코드가 쓰는 영문 키. 운영 DB에는 아직 옛 값(dev/product/…)이 남아 있다
 * 하나로 합치는 건 별도 마이그레이션(0016)에서 한다 — 그때까지 읽는 쪽이 둘 다 받아야 한다.
 */
export type PlannerCategory =
  | "품질·위험 관리"
  | "AI 활용"
  | "제품·서비스 기획"
  | "데이터·실험"
  | "사용자 이해·경험"
  | "사업·브랜드"
  | "협업·프로세스";
/** 검색·필터용 태그 묶음(기준 v1 4단계). 대분류 판단에는 쓰지 않는다. */
export interface PlannerTags {
  purpose?: string;
  methods?: string[];
  contexts?: string[];
  tech?: string[];
}
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

/**
 * 리드 — 글을 **세 가지 질문**으로 먼저 세운다.
 *
 * 시간순 나열을 버린 이유: "원천 데이터에 메타데이터를 붙여 임베딩을 만든다" 같은 줄이
 * 순서대로 쌓이면, 그건 **개발자가 한 일의 순서**지 비개발자가 알아야 할 내용이 아니다.
 * 읽는 사람이 실제로 묻는 건 늘 셋뿐이다 — 무슨 일인가, 왜 했나, 그래서 뭐가 달라졌나.
 */
export interface GuideLead {
  /** 어떤 문제가 있었어요? — 무엇이 반복됐고, 왜 그대로 두기 어려웠나 */
  what: string;
  /** 왜 풀어야 했대요? — 안 풀면 무엇이 더 나빠졌나 */
  why: string;
  /**
   * 뭘 했대요? — 그 문제를 **어떻게 풀었나**.
   *
   * 예전엔 세 칸(문제·이유·결과)뿐이라 **방법이 통째로 빠졌다.** 그러면 "문제가 있었고
   * 좋아졌대요"로 끝나서, 정작 기획자가 가져갈 것(어떻게 풀었는지)이 남지 않는다.
   */
  how: string;
  /** 그래서 뭐가 달라졌어요? — 결과와 남은 것 */
  soWhat: string;
}

/**
 * 더 들어가는 칸 — **질문형 소제목** 하나 + 그 답 문단들.
 *
 * ⚠️ 소제목은 반드시 리드에서 **이미 나온 이야기를 파고드는 질문**이어야 한다.
 *    "컨텍스트 엔지니어링" 같은 새 개념이 갑자기 소제목으로 올라오면,
 *    원문을 안 본 사람은 거기서 길을 잃는다(실제로 그랬다).
 * `blocks` 는 이 칸의 근거가 있는 원문 덩어리들(눌러서 확인할 수 있게).
 * ⚠️ **여러 개**다. 한 개만 저장했더니, 답은 글 곳곳에서 모아 썼는데 근거로는 문단 하나만
 *    떠서 "이 정보로 저 답을 어떻게 썼지?"처럼 보였다. 근거는 답이 선 만큼 있어야 한다.
 */
export interface GuideSection {
  question: string;
  /**
   * 이 칸이 다루는 **문제** 한 문장.
   *
   * 예전엔 문제와 해결을 `paras` 한 배열에 섞어 담고 "첫 문단은 문제로 시작하라"고
   * 프롬프트로 부탁했다. 절반쯤만 먹었다 — 감사에서 "해결부터 시작한 칸"이 계속 나왔다.
   * 순서를 지시로 맡기지 않고 **칸을 나눠 구조로 못 박는다.** 비어 있으면 그 줄만 안 보인다.
   */
  problem: string;
  /** 어떻게 풀었는지 — 문제는 위 `problem` 이 맡으므로 여기는 해결만 담는다. */
  paras: string[];
  /**
   * 그래서 어떻게 됐어요? — **이 칸 하나만의 결말.**
   *
   * 예전엔 칸이 "질문 + 문단 두 개"에서 끝났다. 문제를 설명하다 말고 다음 칸으로 넘어가니
   * 읽고 나도 "그래서 이건 어떻게 됐는데"가 남았다. 위 `lead.soWhat` 은 **글 전체**의 결말이라
   * 칸 하나하나에는 답이 되지 않는다. 칸마다 자기 결말을 갖는다.
   */
  outcome: string;
  blocks: number[];
  terms: string[];
}

/**
 * 읽기 가이드 — 글을 1분 안에 파악하게 만드는 층.
 * 전부 선택적으로 소비한다: 어느 칸이 비어도 그 칸만 숨기고 나머지는 그대로 보여준다.
 */
export interface ReadingGuide {
  summary: string; // 제목 아래 요약 한두 문장
  terms: { term: string; plain: string }[]; // 알아두면 편해요 (최대 8)
  lead: GuideLead; // 한눈에 — 무슨 일 / 왜 / 그래서
  /**
   * 기획 포인트 — **기획자가 이 글을 어떤 눈으로 볼 것인가.**
   *
   * `lead.soWhat` 은 *그 팀에게* 뭐가 달라졌는지를 말한다. 읽는 사람에게 뭐가 달라지는지는
   * 아무도 말해 주지 않았다. "파악했다"와 "내 일에 쓸 수 있다" 사이가 이 한 칸이다.
   *
   * ⚠️ AI 가 가장 지어내기 쉬운 칸이다. 원문에 판단·비교·트레이드오프 서술이 없으면
   *    **빈 문자열로 둔다.** 없는 교훈을 꾸며내면 서비스 전체를 못 믿게 된다.
   */
  plannerPoint: string;
  sections: GuideSection[]; // 더 들어가 볼까요 — 질문형 소제목
}

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
          /**
           * 이 블로그를 아이프레임 안에 띄울 수 있나(스키마 §39).
           * null = 아직 확인 안 함 → 앱은 **새 탭으로 보낸다**(모르는 채로 iframe 을 걸면
           * 빈 화면이 나오는데, 그건 "안 열린다"보다 나쁘다).
           */
          frameable: boolean | null;
          frameable_checked_at: string | null;
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
          frameable?: boolean | null;
          frameable_checked_at?: string | null;
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
          /** 접목 질문(§32) — "우리 제품 어디에 먼저 적용해볼까요?" */
          apply_question: string | null;
          /**
           * 기획자용 제목(마이그레이션 0017) — 관형절+명사, 18~28자.
           * null 이면 화면은 원문 title 을 쓴다. 원문 제목은 카드 아래 회색 한 줄로 남는다.
           */
          planner_title: string | null;
          /**
           * 가설 질문(마이그레이션 0016) — "왜 그 방법이면 풀린다고 봤을까요?"
           * ⚠️ 원인을 묻는 칸이 아니다(원인은 요약에 있다). 서버 게이트가 원인 되묻기를 거른다.
           */
          hypothesis_question: string | null;
          terms: ArticleTerm[];
          /** 대표 태그 — 목적 하나(기준 v1 4단계). 세부 태그는 tags 에 담긴다. */
          reading_guide: ReadingGuide | null;
          /**
           * 기획자용 분류(기준 v1 · 마이그레이션 0015) — 운영 DB에 실제로 채워져 있는 값이다.
           * `topic`(옛 키워드 7주제)과 병행한다. 화면 전환이 끝나면 옛 컬럼을 정리한다.
           */
          planner_included: boolean | null;
          planner_category: PlannerCategory | null;
          planner_tags: PlannerTags;
          planner_summary: string | null;
          planner_evidence: string | null;
          planner_votes: string | null;
          planner_version: string | null;
          planner_at: string | null;
          /** 시리즈 이름 — 같은 블로그 안에서 이 값이 같으면 한 묶음(§40). */
          series_key: string | null;
          /** 시리즈 안에서의 회차. */
          series_no: number | null;
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
          apply_question?: string | null;
          hypothesis_question?: string | null;
          planner_title?: string | null;
          terms?: ArticleTerm[];
          reading_guide?: ReadingGuide | null;
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
      // ---- distill: 아카이브(사용자 보관함) ----
      archives: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          icon: string;
          sort: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          icon?: string;
          sort?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["archives"]["Insert"]>;
        Relationships: [];
      };
      archive_articles: {
        Row: { archive_id: string; article_id: string; created_at: string };
        Insert: { archive_id: string; article_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["archive_articles"]["Insert"]>;
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
      // 아카이브별 글 개수(§34) — 타일마다 목록을 받아오면 쿼리가 타일 수만큼 늘어난다.
      my_archive_counts: {
        Args: { p_user_id: string };
        Returns: { archive_id: string; cnt: number }[];
      };
      // 완독률(§34) — 저장한 글 중 읽음 처리된 비율. 분모는 '읽으려고 담아둔 글'.
      my_read_rate: {
        Args: { p_user_id: string };
        Returns: { saved: number; finished: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
