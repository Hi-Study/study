/**
 * distill 글 상세 — **읽고 이해하는 화면**(PRODUCT.md §2.1).
 *
 * 화면 순서:
 *   ① 히어로(대표 이미지 위에 제목 + 요약)
 *   ② 메타 줄 — 게시일 · 기업 · 담기 · 공유 · 글자 크기
 *   ③ 알아두면 편해요 — 이 글에서 막힐 개발 용어
 *   ④ 한눈에 — 무슨 일 / 왜 했나 / 그래서 뭐가 달라졌나 (1분 파악)
 *   ⑤ 더 들어가 볼까요 — 질문형 소제목 + 답 문단
 *   ⑥ 원문 읽으며 밑줄 긋기 — 접이식. 문장 탭 → 밑줄+메모(나만 보기)
 *        하단 플로팅 "원문"을 누르면 이 칸으로 스크롤되며 펼쳐진다.
 *        본문을 못 뽑은 글에서만 웹뷰로 보낸다("원문을 보러 가볼까요?" 카드는 그때만 뜬다).
 *        웹뷰는 남의 페이지라 밑줄을 그을 수 없어서, 앱에서 읽을 수 있으면 앱에서 읽힌다.
 *   ⑦ 이어지는 이야기 — 시리즈가 있을 때만(§40)
 *   ⑧ 생각해볼 질문
 *   ⑧ 인사이트 남기기 + 남들의 인사이트
 *   ⑨ "다 읽으셨네요, 어떠셨어요?" — 스탬프
 *   + 플로팅: 인사이트 · 원문 · 다음 글
 *
 * ⚠️ v1 은 원문을 단계로 쪼개 접었다 펴는 구조였다. 버렸다 — 자르기만 해서는 안 쉬워진다.
 *    어려운 건 문단 길이가 아니라 문장 자체였고, 열면 결국 원문 그대로라 제자리였다.
 *    v2 는 "시간순 한 줄씩"이었는데 그것도 버렸다 — 나온 줄이 "메타데이터를 붙여 임베딩을
 *    만든다" 같은 **개발자가 한 일의 순서**였다. 지금은 읽는 사람이 실제로 묻는 세 질문
 *    (무슨 일 / 왜 / 그래서)으로 세우고, 더 파고드는 칸은 **질문형 소제목**으로만 연다.
 *    지금은 **AI 가 다시 쓴 요약이 본체**이고 원문은 따로 보러 간다.
 *    대신 사실이 틀리면 그대로 전달되므로, 서버 게이트가 숫자·고유명사를 원문과 대조한다.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowRight, Bookmark, Check, ChevronDown, ChevronLeft, ChevronUp, ExternalLink, Highlighter, MessageSquare, Share2, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { dtype, reading, PRETENDARD } from "@/theme";
import { isUsableQuestion, questionFromDecision } from "@/lib/decision";
import { fallbackQuestion } from "@/lib/improvement";
import { hasLead, toReadingGuide } from "@/lib/guide";
import { openOriginal, opensInNewTab } from "@/lib/openOriginal";
import { summaryLine } from "@/lib/summaryLine";
import { cleanBody } from "@/lib/text";
import { FONT_SCALES, useReadingFontScale } from "@/lib/readingPrefs";
import {
  useArticle,
  useOpinions,
  useSeriesArticles,
  useRequestReadingGuide,
  useArchivedIds,
  useMarkArticleRead,
  useReadIds,
  incrementArticleView,
  useProfile,
  useRecommendedArticles,
} from "@/data";
import { ServiceLogo, postedDate } from "@/components/distill/ArticleCards";
import { ArticleThumb } from "@/components/distill/ArticleThumb";
import { LevelBadge } from "@/components/distill/LevelBadge";
import { StampBar } from "@/components/distill/StampBar";
import { ReaderRoles } from "@/components/distill/ReaderRoles";
import { OpinionThread } from "@/components/distill/OpinionThread";
import { InsightBody } from "@/components/distill/InsightBody";
import { ArticleHighlightSection } from "@/components/distill/ArticleHighlightSection";
import { ReadingDigest } from "@/components/distill/ReadingDigest";
import { ArchivePickerSheet } from "@/components/distill/ArchivePickerSheet";
import { Avatar } from "@/components/Avatar";
import { Loading, ErrorState, SeriesCard } from "@/components";


type Props = NativeStackScreenProps<RootStackParamList, "ArticleDetail">;

export function ArticleDetailScreen({ route }: Props) {
  const { articleId, focusOpinionId } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useArticle(articleId);
  // ⚠️ 훅은 early return 앞에서 무조건 호출 (React 훅 규칙 — 렌더마다 개수 동일).
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [opinionsOpen, setOpinionsOpen] = useState(false);
  /**
   * 원문 밑줄 — 기본은 접어 둔다. 요약이 본체인 화면에서 원문을 펼쳐 두면
   * 스크롤이 길어져 아래 질문·인사이트까지 못 내려간다. 밑줄을 그을 사람만 연다.
   */
  const [underlineOpen, setUnderlineOpen] = useState(false);
  const profile = useProfile();
  const archivedIds = useArchivedIds();
  const markRead = useMarkArticleRead(articleId);
  const requestGuide = useRequestReadingGuide(articleId);
  const recommended = useRecommendedArticles(6);
  // 시리즈 — 글이 시리즈에 속할 때만 받아온다(§40). 아니면 훅이 쉰다.
  const series = useSeriesArticles(q.data?.blog_id, q.data?.series_key);
  const readMarked = useRef(false);
  /**
   * 읽음 표시 — 저장된 기록과 **이번 화면에서 방금 읽음 처리된 것**을 함께 본다.
   * 기록만 보면 스크롤을 끝까지 내린 직후에도 배지가 안 뜬다(쿼리가 아직 갱신 전).
   */
  const readIds = useReadIds().data;
  const isRead = readMarked.current || !!readIds?.includes(articleId);
  const guideAsked = useRef(false);
  const { scale, step } = useReadingFontScale();
  const scrollRef = useRef<ScrollView>(null);
  /**
   * 밑줄 섹션의 y — 플로팅 "원문"을 누르면 여기로 스크롤한다.
   * ⚠️ 훅은 **아래 로딩·에러 분기보다 먼저** 불러야 한다. 분기 뒤에 두면 로딩 중일 때와
   *    본문이 뜬 뒤의 훅 개수가 달라져 "Rendered more hooks than during the previous render"
   *    로 화면이 통째로 죽는다(이 파일에서 두 번째로 냈다).
   */
  const underlineY = useRef(0);

  const guide = useMemo(() => toReadingGuide(q.data?.reading_guide), [q.data?.reading_guide]);

  /**
   * 히어로는 16:9. 창 폭을 따라가야 웹에서 창을 좁혔을 때 비율이 안 깨진다.
   * ⚠️ 훅은 **아래 로딩·에러 분기보다 먼저** 불러야 한다. 분기 뒤에 두면 로딩 중일 때와
   *    본문이 뜬 뒤의 훅 개수가 달라져서 "Rendered more hooks than during the previous
   *    render" 로 화면이 통째로 죽는다(실제로 그렇게 냈다).
   */
  const heroH = Math.round(useWindowDimensions().width * (9 / 16));

  useEffect(() => {
    incrementArticleView(articleId).catch(() => undefined);
  }, [articleId]);

  /**
   * 쓸 수 있는 가이드가 없으면 여는 김에 한 번 만든다.
   *
   * ⚠️ "칸이 비었나"가 아니라 **"읽을 수 있나"**로 판단한다. 예전엔 `reading_guide` 가
   *    null 인지만 봤는데, 옛 형식(v1 steps)으로 저장된 글은 값이 있으니 건너뛰고,
   *    화면은 그 값을 못 읽어 "요약을 만들지 못했어요"에서 영영 멈췄다.
   *    형식이 바뀌면 저장된 값이 있어도 다시 만들어야 한다.
   * 한 화면에서 **한 번만** 시도한다 — 게이트에 걸리는 글은 다시 불러도 계속 걸린다.
   */
  useEffect(() => {
    if (guideAsked.current) return;
    if (q.isLoading || !q.data) return;
    if (toReadingGuide(q.data.reading_guide)) return; // 이미 읽을 수 있는 가이드가 있다
    if (!q.data.body || q.data.body.length < 400) return;
    guideAsked.current = true;
    requestGuide.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.isLoading, q.data?.id, q.data?.reading_guide]);

  // 인사이트 카드로 들어온 경우 — 시트를 바로 연다(안에서 그 인사이트까지 스크롤한다).
  useEffect(() => {
    if (focusOpinionId) setOpinionsOpen(true);
  }, [focusOpinionId]);

  /**
   * 시트 안 스크롤 — 마이·그날 활동에서 인사이트를 누르면 **그 인사이트 자리**로 내려간다.
   * 인사이트는 글 상세 안에서만 오간다(PRODUCT.md §4) — 따로 상세 화면으로 빼지 않는다.
   * 한 번만 옮긴다: 시트를 닫았다 다시 열 때까지 또 끌고 가면 읽던 자리를 뺏는다.
   */
  const sheetScrollRef = useRef<ScrollView>(null);
  const focusDone = useRef(false);
  useEffect(() => {
    if (!opinionsOpen) focusDone.current = false;
  }, [opinionsOpen]);

  if (q.isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <Loading label="불러오는 중…" />
      </SafeAreaView>
    );
  }
  if (q.isError || !q.data) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <ErrorState onRetry={() => q.refetch()} />
      </SafeAreaView>
    );
  }

  const a = q.data;
  // 원문이 새 탭에서 열리는가 — 웹에서 프레임 삽입을 막는 블로그가 19곳 중 7곳이다(§39).
  const newTab = a ? opensInNewTab(a) : false;
  /**
   * 앱 안에서 원문을 읽을 수 있나 — 추출한 본문이 쓸 만한 길이인가로 판단한다.
   * 있으면 밑줄 섹션이 원문 자리를 대신하고, 없으면(짧거나 막힌 사이트) 웹뷰로 보낸다.
   */
  const hasBody = !!a?.body && cleanBody(a.body).length >= 200;
  const atMaxFont = scale >= FONT_SCALES[FONT_SCALES.length - 1];
  const atMinFont = scale <= FONT_SCALES[0];
  const goOriginal = () => {
    if (!a) return;
    if (!hasBody) {
      openOriginal(nav, a); // 앱에서 읽을 본문이 없으면 원본 페이지로
      return;
    }
    setUnderlineOpen(true);
    // 헤더 위치는 펼침과 무관하므로 바로 스크롤해도 어긋나지 않는다.
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: Math.max(0, underlineY.current - 12), animated: true }),
    );
  };
  const archived = (archivedIds.data ?? []).includes(a.id);

  /**
   * 히어로 한 줄 요약 — **비워두지 않는다.** 세 단계로 내려간다.
   *   ① AI 가 쓴 요약(가이드)
   *   ② 수집 때 받아둔 원문 요약(RSS·og:description)
   *   ③ **본문 첫 문장들** ← 수집기가 본문을 통째로 저장해 두는데 안 쓰고 있었다
   *
   * ②가 비는 블로그가 꽤 있다. 목록 스크랩 방식(당근·카카오 등)은 RSS 요약 자체가 없어서,
   * ②까지만 보면 그 블로그 글은 전부 제목만 남았다. 본문이 있는데 안 쓸 이유가 없다.
   * ③도 원문 문장 그대로라 ②와 마찬가지로 틀릴 위험이 없다.
   */
  const heroSummary = (
    guide?.summary ||
    summaryLine(a.summary) ||
    summaryLine(cleanBody(a.body).slice(0, 400))
  ).trim();
  const ready = hasLead(guide);
  const next = (recommended.data ?? []).find((r) => r.id !== a.id) ?? null;

  /**
   * 생각해볼 질문 — **항상 하나는 있다.**
   *   ① enrich 가 저장하고 서버 게이트를 통과한 질문 ② 결정 카드로 조립 ③ 개선 유형 템플릿
   * 예전엔 ②만 써서, 대조쌍이 있는 15건 말고는 질문 카드가 통째로 사라졌다.
   */
  const question =
    (isUsableQuestion(a.question) ? a.question : null) ??
    questionFromDecision(a.decision, a.blog?.name) ??
    fallbackQuestion({ decision: a.decision, title: a.title, tags: a.tags });

  return (
    <View style={[styles.screen, { backgroundColor: c.surfacePage }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={200}
        onScroll={(e) => {
          if (readMarked.current) return;
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
          if (
            contentSize.height > 0 &&
            (contentOffset.y + layoutMeasurement.height) / contentSize.height >= 0.9
          ) {
            readMarked.current = true;
            markRead.mutate();
          }
        }}
      >
        {/* ① 히어로 — 이미지 위에 제목과 요약을 얹는다. 스크롤 없이 "무슨 글인지"가 보여야 한다. */}
        <View style={[styles.hero, { height: heroH }]}>
          <ArticleThumb article={a} large style={styles.heroImg} />
          <View style={styles.heroScrim} />
          <View style={styles.heroText}>
            {/* 기획자용 제목이 있으면 그것이 제목이고, 원문 제목은 아래 작은 줄로 남는다
                (목록과 같은 규칙 — components/distill/ArticleCards.CardTitle). */}
            <Text style={styles.heroTitle} numberOfLines={3}>
              {(a.planner_title ?? "").trim() || a.title}
            </Text>
            {(a.planner_title ?? "").trim() ? (
              <Text style={styles.heroOrigin} numberOfLines={2}>
                원문 ｜ {a.title}
              </Text>
            ) : null}
            {heroSummary ? (
              <Text style={styles.heroSummary} numberOfLines={3}>
                {heroSummary}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          {/* ② 메타 줄 — 게시일 · 기업 · 담기 · 공유 · 글자 크기 */}
          <View style={styles.metaRow}>
            <Pressable
              style={styles.source}
              onPress={() =>
                a.blog
                  ? nav.navigate("BlogArticles", { blogId: a.blog_id, blogName: a.blog.name })
                  : undefined
              }
              disabled={!a.blog}
            >
              <ServiceLogo
                name={a.blog?.name ?? "?"}
                brandColor={a.blog?.brand_color}
                homepage={a.blog?.homepage}
                blogKey={a.blog?.key}
                size={22}
              />
              <Text style={[styles.sourceText, { color: c.textSecondary }]} numberOfLines={1}>
                {a.blog?.name ?? ""}
                {a.published_at ? ` · ${postedDate(a.published_at)}` : ""}
              </Text>
            </Pressable>

            <Pressable onPress={() => setArchiveOpen(true)} hitSlop={8} style={styles.iconBtn}>
              <Bookmark
                size={18}
                color={archived ? c.primary : c.textMuted}
                fill={archived ? c.primary : "transparent"}
              />
            </Pressable>
            <Pressable
              onPress={() => Share.share({ message: `${a.title}\n${a.url}` }).catch(() => undefined)}
              hitSlop={8}
              style={styles.iconBtn}
            >
              <Share2 size={18} color={c.textMuted} />
            </Pressable>
            {/* 글자 크기 — 더 키울/줄일 수 없으면 흐리게. 눌렀는데 아무 반응이 없으면
                "기능이 고장났다"로 읽힌다(단계는 4개뿐이다). */}
            <Pressable
              onPress={() => step(1)}
              disabled={atMaxFont}
              hitSlop={8}
              style={[styles.iconBtn, atMaxFont && styles.iconBtnOff]}
            >
              <Text style={[styles.fontIcon, { color: c.textMuted }]}>가</Text>
            </Pressable>
            <Pressable
              onPress={() => step(-1)}
              disabled={atMinFont}
              hitSlop={8}
              style={[styles.iconBtn, atMinFont && styles.iconBtnOff]}
            >
              <Text style={[styles.fontIconSm, { color: c.textMuted }]}>가</Text>
            </Pressable>
          </View>

          <View style={styles.chipRow}>
            <LevelBadge level={a.level} />
            {/* 읽음 — 목록 카드와 같은 배지(DESIGN_SYSTEM §4.3).
                다시 들어온 글이 "이미 읽은 글"인지 상세에서도 바로 알아야 한다. */}
            {isRead ? (
              <View style={[styles.readChip, { backgroundColor: c.surfaceSunken }]}>
                <Check size={10} color={c.textMuted} strokeWidth={3} />
                <Text style={[styles.readText, { color: c.textMuted }]}>읽음</Text>
              </View>
            ) : null}
            {/* 대표 태그(목적)를 먼저 — 혼자서도 뜻이 통하는 유일한 태그다. */}
            {a.planner_tags?.purpose ? (
              <View style={[styles.tagChip, { backgroundColor: c.primaryTint }]}>
                <Text style={[styles.tagText, { color: c.primary }]}>#{a.planner_tags.purpose}</Text>
              </View>
            ) : null}
            {a.tags?.slice(0, 3).map((t) => (
              <View key={t} style={[styles.tagChip, { backgroundColor: c.surfaceSunken }]}>
                <Text style={[styles.tagText, { color: c.textSecondary }]}>#{t}</Text>
              </View>
            ))}
          </View>

          {/* ③④⑤ 알아두면 편해요 · 한눈에 · 더 들어가 볼까요 */}
          {ready && guide ? (
            <ReadingDigest guide={guide} body={a.body} fontScale={scale} />
          ) : requestGuide.isPending ? (
            <View style={[styles.pending, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
              <ActivityIndicator color={c.primary} />
              <Text style={[styles.pendingText, { color: c.textSecondary }]}>
                이 글을 1분 만에 읽을 수 있게 정리하고 있어요…
              </Text>
            </View>
          ) : (
            /* ⚠️ 실패를 조용히 숨기지 않는다. 예전엔 가이드가 없으면 아무 말 없이 예전 화면으로
                  내려갔는데, 그 탓에 "생성이 아예 안 되고 있다"는 사실을 오래 못 봤다. */
            <View style={[styles.pending, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
              <Text style={[styles.pendingText, { color: c.textSecondary }]}>
                이 글은 요약을 만들지 못했어요.{"\n"}아래에서 원문으로 읽어주세요.
              </Text>
              {/* 실패 이유를 작게 남긴다. 예전엔 조용히 넘어가서, 생성이 아예 안 되고 있다는
                  사실을 화면만 보고는 알 수 없었다(서버에 직접 물어봐야 했다). */}
              {requestGuide.data?.reason ? (
                <Text style={[styles.pendingWhy, { color: c.textMuted }]}>
                  {requestGuide.data.reason}
                </Text>
              ) : null}
              {/* 다시 시도 — 자동 시도는 화면당 한 번뿐이라, 실패 후에는 누를 수단이 있어야 한다.
                  (모델이 흔들려 한 번 더 하면 통과하는 경우가 실제로 있다) */}
              <Pressable
                style={[styles.retryBtn, { borderColor: c.hairline }]}
                onPress={() => requestGuide.mutate()}
                disabled={requestGuide.isPending}
              >
                <Text style={[styles.retryText, { color: c.primary }]}>다시 시도</Text>
              </Pressable>
            </View>
          )}

          {/* ⑥ 원문 — **앱 안에서 읽는다.** 밑줄이 여기서만 되기 때문이다(웹뷰는 남의 페이지라 손댈 수 없다).
                 그은 밑줄은 인사이트 쓰기의 초안 재료가 되고(PRODUCT.md §2.2),
                 마이 > 그날 활동의 레퍼런스 문서로 함께 나간다.
                 예전엔 "원문을 보러 가볼까요?" 카드가 따로 있었다. 지웠다 —
                 앱에서 읽을 수 있는데 나가는 문을 크게 열어 두면, 밑줄도 기록도 남지 않는다.
                 원본 페이지는 아래 작은 링크로 남긴다(이미지·표가 많은 글은 원본이 낫다). */}
          {hasBody ? (
            <View
              style={[styles.underlineCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
              onLayout={(e) => {
                underlineY.current = e.nativeEvent.layout.y;
              }}
            >
              <Pressable
                style={styles.underlineHead}
                onPress={() => setUnderlineOpen((v) => !v)}
                hitSlop={6}
              >
                <Highlighter size={16} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.underlineTitle, { color: c.textPrimary }]}>
                    원문 읽으며 밑줄 긋기
                  </Text>
                  <Text style={[styles.underlineHint, { color: c.textMuted }]}>
                    문장을 누르면 밑줄과 메모를 남겨요 · 나만 보기
                  </Text>
                </View>
                {underlineOpen ? (
                  <ChevronUp size={18} color={c.textMuted} />
                ) : (
                  <ChevronDown size={18} color={c.textMuted} />
                )}
              </Pressable>
              {underlineOpen ? (
                <>
                  <ArticleHighlightSection articleId={a.id} text={a.body ?? ""} fontScale={scale} />
                  {/* 원본 페이지 — 표·도표가 많은 글은 원본이 낫다. 작게 둔다(주 경로가 아니다). */}
                  <Pressable style={styles.originLink} onPress={() => openOriginal(nav, a)} hitSlop={6}>
                    <ExternalLink size={13} color={c.textMuted} />
                    <Text style={[styles.originLinkText, { color: c.textMuted }]}>
                      {newTab ? "원본 페이지 열기 (새 탭)" : "원본 페이지로 열기"}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : (
            /* 본문을 못 뽑은 글(짧거나 막힌 사이트) — 이때만 웹뷰로 보낸다. */
            <View style={[styles.originCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
              <Text style={[styles.originTitle, { color: c.textPrimary }]}>원문을 보러 가볼까요?</Text>
              <Text style={[styles.originSub, { color: c.textMuted }]}>
                이 글은 앱에서 읽을 본문을 가져오지 못했어요.
                {newTab ? " 이 블로그는 새 탭에서 열려요." : ""}
              </Text>
              <Pressable
                style={[styles.originBtn, { backgroundColor: c.primary }]}
                onPress={() => openOriginal(nav, a)}
              >
                <ExternalLink size={16} color={c.actionOn} />
                <Text style={[styles.originBtnText, { color: c.actionOn }]}>
                  {newTab ? "새 탭에서 원문 보기" : "원문 보러가기"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ⑦ 이어지는 이야기 — 시리즈 중간편만 열면 맥락을 모른다. */}
          <SeriesCard
            items={series.data ?? []}
            currentId={a.id}
            onSelect={(id) => nav.push("ArticleDetail", { articleId: id })}
          />

          {/* ⑧ 생각해볼 질문 — 질문만. 답은 인사이트 쓰기에서 받는다. */}
          <View style={[styles.qCard, { backgroundColor: c.primaryTint, borderColor: c.accentTintBorder }]}>
            <Text style={[styles.qLabel, { color: c.primary }]}>생각해볼 질문</Text>
            <Text style={[styles.qText, { color: c.textPrimary }]}>{question}</Text>
          </View>

          {/* ⑨ 다 읽으셨네요 — 인사이트는 아래 플로팅에서 시트로 연다(본문에 깔지 않는다).
                 다 읽기도 전에 남의 감상문이 길게 깔리면 읽는 흐름이 끊긴다.
                 ⚠️ 제목은 **StampBar 안에만** 둔다. 예전엔 바깥에도 같은 문장을 적어서
                    "다 읽으셨네요, 어떠셨어요?"가 두 번 보였다(실측 화면). */}
          <View style={styles.block}>
            <StampBar articleId={a.id} finished={readMarked.current} />
            <ReaderRoles articleId={a.id} myRole={profile.data?.job_role} />
          </View>
        </View>
      </ScrollView>

      {/* 플로팅 뒤로가기 */}
      <SafeAreaView style={styles.backWrap} edges={["top"]} pointerEvents="box-none">
        <Pressable
          style={[styles.backBtn, { backgroundColor: "rgba(0,0,0,0.35)" }]}
          onPress={() => nav.goBack()}
          hitSlop={8}
        >
          <ChevronLeft size={22} color="#fff" />
        </Pressable>
      </SafeAreaView>

      {/* 하단 플로팅 — 인사이트 · 원문 · 다음 글.
          셋 다 "이 글을 다 본 다음"의 행동이라 한 줄에 모은다. */}
      <SafeAreaView style={styles.fabWrap} edges={["bottom"]} pointerEvents="box-none">
        <View style={[styles.fabBar, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
          <Pressable style={styles.fab} onPress={() => setOpinionsOpen(true)}>
            <MessageSquare size={19} color={c.textSecondary} />
            <Text style={[styles.fabText, { color: c.textSecondary }]}>
              인사이트{a.opinion_count > 0 ? ` ${a.opinion_count}` : ""}
            </Text>
          </Pressable>
          <View style={[styles.fabDivider, { backgroundColor: c.dividerSoft }]} />
          {/* 원문 — 앱에서 읽을 본문이 있으면 **밑줄 섹션으로 스크롤**하고 펼친다.
              없을 때만 웹뷰로 나간다(goOriginal). */}
          <Pressable style={styles.fab} onPress={goOriginal}>
            <ExternalLink size={19} color={c.textSecondary} />
            <Text style={[styles.fabText, { color: c.textSecondary }]}>원문</Text>
          </Pressable>
          <View style={[styles.fabDivider, { backgroundColor: c.dividerSoft }]} />
          <Pressable
            style={styles.fab}
            disabled={!next}
            onPress={() => next && nav.replace("ArticleDetail", { articleId: next.id })}
          >
            <ArrowRight size={19} color={next ? c.primary : c.textMuted} />
            <Text style={[styles.fabText, { color: next ? c.primary : c.textMuted }]}>다음 글</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ArchivePickerSheet
        articleId={a.id}
        visible={archiveOpen}
        onClose={() => setArchiveOpen(false)}
      />

      {/* 인사이트 시트 — 눌렀을 때만 아래에서 올라온다(DESIGN_SYSTEM §4.5). */}
      <Modal
        visible={opinionsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setOpinionsOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpinionsOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: c.surfaceCard }]}>
          <View style={[styles.grip, { backgroundColor: c.hairline }]} />
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: c.textPrimary }]}>인사이트</Text>
            <Pressable onPress={() => setOpinionsOpen(false)} hitSlop={8}>
              <X size={20} color={c.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            ref={sheetScrollRef}
            contentContainerStyle={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            <OpinionsSection
              articleId={a.id}
              focusId={focusOpinionId ?? null}
              onFocusLayout={(y) => {
                if (focusDone.current) return;
                focusDone.current = true;
                sheetScrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
              }}
            />
          </ScrollView>
          <Pressable
            style={[styles.writeBtn, { backgroundColor: c.textPrimary }]}
            onPress={() => {
              setOpinionsOpen(false);
              nav.navigate("CreateOpinion", { articleId: a.id });
            }}
          >
            <Text style={[styles.writeText, { color: c.surfaceCard }]}>인사이트 남기기</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// 이 글에 달린 인사이트 — 없으면 권유 한 줄만.
function OpinionsSection({
  articleId,
  focusId,
  onFocusLayout,
}: {
  articleId: string;
  /** 여기로 스크롤할 인사이트(마이·그날 활동에서 눌러 들어온 경우). */
  focusId?: string | null;
  onFocusLayout?: (y: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const q = useOpinions(articleId);
  const list = q.data ?? [];

  if (list.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: c.textMuted }]}>
        아직 남겨진 인사이트가 없어요. 첫 번째가 되어보세요.
      </Text>
    );
  }

  return (
    <View style={styles.opinions}>
      <Text style={[styles.opinionsTitle, { color: c.textPrimary }]}>
        다른 사람의 인사이트 {list.length}
      </Text>
      {list.map((o) => {
        const on = Boolean(focusId) && o.id === focusId;
        return (
        <View
          key={o.id}
          // 스크롤만 하면 "여기가 그거였나" 가 남는다 — 테두리로 한 번 짚어 준다.
          onLayout={on ? (e) => onFocusLayout?.(e.nativeEvent.layout.y) : undefined}
          style={[
            styles.opinionCard,
            { backgroundColor: c.surfaceCard, borderColor: on ? c.primary : c.hairline },
            on ? styles.opinionCardOn : null,
          ]}
        >
          <View style={styles.opinionHead}>
            <Avatar name={o.author?.name ?? "게스트"} size={28} />
            <Text style={[styles.opinionWho, { color: c.textPrimary }]}>
              {o.author?.name ?? "게스트"}
            </Text>
          </View>
          <InsightBody insight={o.insight} />
          <OpinionThread opinionId={o.id} />
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 110 },

  hero: { width: "100%", justifyContent: "flex-end" },
  heroImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  // 이미지 위 글자가 읽히려면 어두운 막이 필요하다 — 밝은 썸네일에서 제목이 사라진다.
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  heroText: { padding: 20, gap: 8 },
  heroTitle: { fontSize: 22, lineHeight: 30, fontWeight: "800", fontFamily: PRETENDARD["800"], color: "#fff" },
  // 원문 제목 — 히어로 이미지 위라 흰색을 낮춘 투명도로 쓴다(회색은 사진 위에서 안 읽힌다).
  heroOrigin: { fontSize: 12.5, lineHeight: 18, color: "rgba(255,255,255,0.75)", marginTop: 6 },
  heroSummary: { fontSize: 14, lineHeight: 21, fontFamily: PRETENDARD["400"], color: "rgba(255,255,255,0.88)" },

  body: { paddingHorizontal: reading.pagePadding, paddingTop: 16, gap: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  source: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  sourceText: { ...dtype.bodyS, flex: 1 },
  iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  iconBtnOff: { opacity: 0.3 },
  fontIcon: { fontSize: 17, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  fontIconSm: { fontSize: 12.5, fontWeight: "700", fontFamily: PRETENDARD["700"] },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  tagChip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { ...dtype.meta, fontWeight: "600", fontFamily: PRETENDARD["600"] },

  pending: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 10 },
  pendingText: { ...dtype.bodyS, textAlign: "center", lineHeight: 22 },
  pendingWhy: { ...dtype.meta, fontSize: 11, textAlign: "center" },
  retryBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginTop: 4 },
  retryText: { ...dtype.label, fontSize: 12.5 },

  originCard: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 6, alignItems: "center" },
  originTitle: { ...dtype.cardTitle },
  originSub: { ...dtype.bodyS, textAlign: "center" },
  originBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 6,
  },
  originBtnText: { ...dtype.cardTitle, fontSize: 14.5 },

  underlineCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12, gap: 10 },
  originLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8 },
  originLinkText: { ...dtype.meta },
  underlineHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  underlineTitle: { ...dtype.cardTitle, fontSize: 15 },
  underlineHint: { ...dtype.meta, marginTop: 1 },

  qCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  qLabel: { ...dtype.label, fontSize: 12 },
  readChip: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  readText: { ...dtype.label, fontSize: 11 },
  qText: { ...dtype.cardTitle, fontSize: 16, lineHeight: 25 },

  block: { gap: 12 },

  // 바텀시트 — DESIGN_SYSTEM §4.5 규격(상단만 radius 20, 그립 40×4, 백드롭 0.35).
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: "72%",
  },
  grip: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { ...dtype.title },
  sheetBody: { paddingVertical: 12 },
  writeBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  writeText: { ...dtype.cardTitle },
  doneTitle: { ...dtype.title },

  opinions: { gap: 12 },
  opinionsTitle: { ...dtype.title },
  opinionCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  /** 눌러 들어온 인사이트 — 테두리만 굵힌다(배경을 바꾸면 카드 종류가 하나 더 생긴다). */
  opinionCardOn: { borderWidth: 2 },
  opinionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  opinionWho: { ...dtype.cardTitle },
  emptyText: { ...dtype.bodyS, textAlign: "center", paddingVertical: 20 },

  backWrap: { position: "absolute", top: 0, left: 0, paddingHorizontal: 12, paddingTop: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

  fabWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 12 },
  fabBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  fab: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 2 },
  fabText: { ...dtype.meta, fontSize: 11 },
  fabDivider: { width: 1, height: 26 },
});
