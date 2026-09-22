// distill 아티클 표현 컴포넌트 — 서비스 로고 · 주제칩 · 가로 캐러셀 카드 · 리스트 행 · 피처드.
// DESIGN_GUIDE §6.5(아티클 카드)·§6.6(서비스 로고칩)·§6.7(주제칩) 기준.
import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Bookmark, Check, Eye, MessageSquare, Users } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { JOB_ROLE_META, TOPIC_META, dtype , PRETENDARD} from "@/theme";
import { ArticleThumb } from "./ArticleThumb";
import { ServiceLogo } from "./ServiceLogo";
import { safeImageUri } from "@/lib/image";
import { useAllTopReaderRoles, useArchivedIds, useReadIds } from "@/data";
import { ArchivePickerSheet } from "./ArchivePickerSheet";
import { LevelBadge } from "./LevelBadge";
import type { ArticleWithBlog } from "@/data/articles";
import type { Topic } from "@/types/database";

/**
 * 큰 수 축약(1200 → 1.2k). **0 이면 null** 을 돌려준다.
 * 갓 수집된 글은 조회·인사이트가 전부 0 이라, 카드마다 "👁 0  💬 0" 이 붙어
 * 아무도 안 본 글처럼 보였다. 숫자가 없을 땐 아이콘째 빼는 게 맞다.
 */
function fmtCount(n: number | null | undefined): string | null {
  const v = n ?? 0;
  if (v <= 0) return null;
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v);
}

// 조회수·인사이트 수 (카드 지표). — DESIGN_SYSTEM §5 카드
function CardStats({ article }: { article: ArticleWithBlog }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const views = fmtCount(article.view_count);
  const opinions = fmtCount(article.opinion_count);
  if (!views && !opinions) return null;
  return (
    // ⚠️ 조회·인사이트 수는 **줄의 맨 오른쪽**에 붙는다. 가운데 끼면 출처·날짜와
    //    뒤엉켜 어느 게 무슨 숫자인지 안 읽힌다.
    <View style={[styles.statsRow, { marginLeft: "auto" }]}>
      {views ? (
        <>
          <Eye size={13} color={c.textMuted} />
          <Text style={[styles.statText, { color: c.textMuted }]}>{views}</Text>
        </>
      ) : null}
      {opinions ? (
        <>
          <MessageSquare size={13} color={c.textMuted} style={views ? { marginLeft: 8 } : undefined} />
          <Text style={[styles.statText, { color: c.textMuted }]}>{opinions}</Text>
        </>
      ) : null}
    </View>
  );
}

/**
 * 카드 담기 버튼 — 누르면 아카이브 선택 시트가 열린다.
 *
 * 예전엔 북마크(저장)와 아카이브(분류)가 따로였다. 버튼 두 개가 나란히 있으면
 * "둘이 뭐가 다르지"를 매번 생각해야 해서, 담기 하나로 합쳤다.
 * ⚠️ "담겼나"는 카드마다 묻지 않는다 — 목록 전체 id 를 한 번에 받아 Set 으로 본다.
 */
function CardArchive({ articleId }: { articleId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const archived = useArchivedIds();
  const [open, setOpen] = useState(false);
  const on = (archived.data ?? []).includes(articleId);
  return (
    <>
    <ArchivePickerSheet articleId={articleId} visible={open} onClose={() => setOpen(false)} />
    <Pressable
      onPress={() => setOpen(true)}
      hitSlop={8}
      style={styles.bmBtn}
    >
      <Bookmark size={18} color={on ? c.primary : c.textMuted} fill={on ? c.primary : "transparent"} />
    </Pressable>
    </>
  );
}

// ---- 유틸 ----
/**
 * 글이 **쓰인 날짜** — 그대로 적는다(2026.09.21).
 *
 * "3개월 전" 같은 상대 표기는 SNS 처럼 방금 올라온 것이 중요한 곳에 맞다.
 * 기술 글은 다르다 — 2년 전 글인지 지난달 글인지가 **읽을지 말지를 가르는 정보**이고,
 * "1년 전"으로는 그 판단이 안 된다. 같은 이유로 올해 글도 연도를 줄이지 않는다.
 */
export function postedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/** 상대 표기 — 내가 쓴 인사이트·댓글처럼 **방금 여부**가 중요한 곳에만 쓴다. */
export function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

// ---- 서비스 로고칩 — 브랜드 파비콘(기업 아이콘), 없거나 실패 시 브랜드색+이니셜 ----
// blogKey 로 브랜드 도메인을 우선 해석(네이버 계열 통일·Medium 호스팅 보정). brandIcon.ts 참고.
export { ServiceLogo };

// ---- 주제칩 ----
export function TopicChip({ topic }: { topic: Topic }) {
  const meta = TOPIC_META[topic];
  if (!meta) return null;
  return (
    <View style={[styles.topicChip, { backgroundColor: meta.tint }]}>
      <Text style={[styles.topicText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

// 카드 한 줄 — 주제 · 난이도 · 읽는 시간.
//   "이 글이 내가 읽을 만한지"를 목록에서 바로 판단하게 한다.
//
//   ⚠️ **이 줄에서 색을 갖는 건 주제 칩 하나뿐이다.** 난이도까지 파스텔을 주면
//      두 칩이 같은 팔레트로 나란히 서서 어느 색이 무슨 뜻인지 알 수 없어진다.
//      "무엇을 개선했나"는 카드에서 뺐다 — 있는 글과 없는 글이 갈려 높이가 제각각이 됐다.
/**
 * 이 글을 읽었나 — 목록에서 **이미 본 글을 지나칠 수 있어야** 한다.
 * 읽음 기록은 글 전체를 한 번에 받아 캐시한 걸 꺼내 쓴다(카드마다 조회하지 않는다).
 */
function useIsRead(articleId: string): boolean {
  const { data } = useReadIds();
  return !!data?.includes(articleId);
}

/**
 * 읽음 배지 — 칩 줄에 붙는다.
 *
 * 카드를 통째로 흐리게 만들지 않는다. 흐린 카드는 "읽었다"가 아니라 "못 누른다"로 읽히고,
 * 읽은 글을 다시 찾으러 온 사람에게는 오히려 방해가 된다. 제목은 그대로 두고 **표시만** 붙인다.
 */
function ReadBadge({ articleId }: { articleId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const read = useIsRead(articleId);
  if (!read) return null;
  return (
    // 난이도 배지와 같은 이유로 hairline 을 쓴다 — surfaceSunken 은 페이지 바탕에 묻힌다.
    <View style={[styles.readChip, { backgroundColor: c.hairline }]}>
      <Check size={10} color={c.textMuted} strokeWidth={3} />
      <Text style={[styles.readText, { color: c.textMuted }]}>읽음</Text>
    </View>
  );
}

function CardChips({ article }: { article: ArticleWithBlog }) {
  return (
    <View style={styles.chipRow}>
      {article.topic != null ? <TopicChip topic={article.topic} /> : null}
      <LevelBadge level={article.level} />
      <ReadBadge articleId={article.id} />
    </View>
  );
}

/**
 * "기획자 3명이 읽었어요" — **목록 카드에도** 붙인다.
 *
 * ⚠️ 문구는 **"읽었어요"** 다. 예전엔 "읽고 있어요"였는데 이 수치는 글을 **끝까지
 *    (스크롤 90%) 읽은 사람 수**라 시제가 안 맞았다. 지금 읽는 중인 사람 수가 아니다.
 *    수치와 문구가 어긋나면 다른 숫자도 못 믿게 된다.
 *
 * 상세에만 있으면 정작 들어갈 글을 고르는 목록에서 이 신호를 못 쓴다. 비개발자가
 * 남을지 말지는 목록에서 갈린다 — 개발자 글만 보이면 그 자리에서 나간다.
 *
 * ⚠️ 카드마다 조회하지 않는다. 글 전체의 1등 직군을 **한 번에** 받아 캐시한 걸 꺼내 쓴다
 *    (useAllTopReaderRoles). 아직 읽은 사람이 없는 글엔 아무것도 안 그린다.
 */
function ReaderHint({ articleId }: { articleId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const top = useAllTopReaderRoles().data?.[articleId];
  if (!top) return null;
  const meta = JOB_ROLE_META[top.jobRole];
  if (!meta) return null;
  return (
    <View style={styles.readerRow}>
      <Users size={11} color={c.textMuted} strokeWidth={2} />
      <Text style={[styles.readerText, { color: c.textMuted }]} numberOfLines={1}>
        {meta.plural} {top.count}
      </Text>
    </View>
  );
}

// ---- 출처 로고칩 + 이름 + 날짜 메타 라인 ----
function MetaLine({ article }: { article: ArticleWithBlog }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.metaRow}>
      <ServiceLogo
        name={article.blog?.name ?? "?"}
        brandColor={article.blog?.brand_color}
        homepage={article.blog?.homepage}
        blogKey={article.blog?.key}
        size={18}
      />
      <Text style={[styles.metaText, { color: c.textMuted }]} numberOfLines={1}>
        {article.blog?.name ?? ""}
        {article.published_at ? ` · ${postedDate(article.published_at)}` : ""}
      </Text>
      {/* "기획자 N" — 예전엔 제목 아래 **독립된 줄**이었다. 있는 글과 없는 글이 섞여서
          카드 높이가 들쭉날쭉했고, 그게 목록을 어지럽게 만들었다.
          늘 있는 메타 줄 안으로 들여보내면 있든 없든 높이가 변하지 않는다. */}
      <ReaderHint articleId={article.id} />
      <CardStats article={article} />
    </View>
  );
}

// ---- 가로 캐러셀 카드(이미지 상단 + 제목/메타) — §6.5 ----
export function ArticleCardH({
  article,
  onPress,
  width = 260,
}: {
  article: ArticleWithBlog;
  onPress: () => void;
  width?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardH,
        { width, backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <ArticleThumb article={article} large style={styles.thumbH}>
        <View style={[styles.bmOverlay, { backgroundColor: c.surfaceCard }]}>
          <CardArchive articleId={article.id} />
        </View>
      </ArticleThumb>
      <View style={styles.cardHBody}>
        <CardChips article={article} />
        <CardTitle article={article} style={styles.cardTitle} />
        <MetaLine article={article} />
      </View>
    </Pressable>
  );
}

/**
 * 제목 — **기획자용 제목 한 줄 + 원문 제목 한 줄(작게).**
 *
 * 원문 제목은 "MATCH란 무엇인가" 처럼 내용을 안 알려주는 것이 많다. 목록에서 고르는 사람은
 * 제목만 보고 판단하므로 기획자가 읽고 싶은 각도로 다시 쓴 제목을 위에 둔다.
 * 원문 제목을 지우지는 않는다 — 출처를 대조하고 검색으로 찾아온 사람이 확인해야 한다.
 *
 * 둘 다 **한 줄**이고 넘치면 말줄임이다. 제목이 두 줄, 원문이 두 줄이면 카드가 글자로 꽉 차서
 * 목록을 훑을 수 없다.
 */
function CardTitle({
  article,
  style,
}: {
  article: ArticleWithBlog;
  style: object;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const planner = (article.planner_title ?? "").trim();
  return (
    <View style={styles.titleWrap}>
      <Text style={[style, { color: c.textPrimary }]} numberOfLines={1}>
        {planner || article.title}
      </Text>
      {planner ? (
        <Text style={[styles.originTitle, { color: c.textMuted }]} numberOfLines={1}>
          {article.title}
        </Text>
      ) : null}
    </View>
  );
}

// ---- 리스트 행 — §6.5 ----
/**
 * 리스트 행 썸네일 크기. **모든 행이 같아야** 목록이 훑어진다.
 * 3:2 가로형 — 기술 블로그 대표 이미지는 거의 다 가로형이라, 정사각으로 담으면 양옆이 잘린다.
 */
const ROW_THUMB_W = 156;
const ROW_THUMB_H = 104;

/**
 * `thumbFirst` 면 썸네일이 **왼쪽**으로 간다(아카이브 목록).
 * 피드는 글을 훑는 곳이라 제목이 왼쪽에 서야 스캔이 빠르고,
 * 보관함은 이미 아는 글을 다시 찾는 곳이라 **그림이 먼저** 눈에 걸리는 편이 낫다.
 */
export function ArticleRow({
  article,
  onPress,
  thumbFirst = false,
}: {
  article: ArticleWithBlog;
  onPress: () => void;
  thumbFirst?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const thumb = (
    <ArticleThumb article={article} style={styles.thumbRow}>
      <View style={[styles.bmOverlay, { backgroundColor: c.surfaceCard }]}>
        <CardArchive articleId={article.id} />
      </View>
    </ArticleThumb>
  );
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.9 : 1 }]}
    >
      {thumbFirst ? thumb : null}
      {/* 글 블록 높이를 썸네일과 똑같이 **고정**한다(ROW_H).
          제목이 한 줄인 글과 두 줄인 글이 섞여도 행 크기가 흔들리지 않는다 —
          목록은 크기가 같아야 훑어진다. 남는 자리는 space-between 이 메타 줄을 바닥에 붙인다. */}
      <View style={styles.rowText}>
        <CardChips article={article} />
        <CardTitle article={article} style={styles.rowTitle} />
        <MetaLine article={article} />
      </View>
      {thumbFirst ? null : thumb}
    </Pressable>
  );
}

// ---- 피처드(대형 히어로) — 홈 상단 대표글 ----
export function FeaturedCard({
  article,
  onPress,
}: {
  article: ArticleWithBlog;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.featured,
        { backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <ArticleThumb article={article} large style={styles.featuredThumb}>
        <View style={[styles.bmOverlay, { backgroundColor: c.surfaceCard }]}>
          <CardArchive articleId={article.id} />
        </View>
      </ArticleThumb>
      <View style={styles.featuredBody}>
        <CardChips article={article} />
        <CardTitle article={article} style={styles.featuredTitle} />
        <MetaLine article={article} />
      </View>
    </Pressable>
  );
}

// ---- 그리드 카드(2열) — 썸네일 상단 + 제목/메타. 썸네일 없으면 브랜드 로고로 채워 빈칸 방지 ----
export function ArticleGridCard({
  article,
  onPress,
  width,
}: {
  article: ArticleWithBlog;
  onPress: () => void;
  width: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.gridCard,
        { width, backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <ArticleThumb article={article} style={styles.gridThumb}>
        <View style={[styles.bmOverlay, { backgroundColor: c.surfaceCard }]}>
          <CardArchive articleId={article.id} />
        </View>
      </ArticleThumb>
      <View style={styles.gridBody}>
        <CardChips article={article} />
        <CardTitle article={article} style={styles.gridTitle} />
        <MetaLine article={article} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 제목 묶음 — 기획자 제목 + 원문 제목(작게). 간격은 2, 둘 다 한 줄.
  titleWrap: { gap: 2 },
  originTitle: { ...dtype.meta, fontSize: 11.5, lineHeight: 16 },

  logo: { alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontWeight: "800", fontFamily: PRETENDARD["800"] },
  favicon: { alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", overflow: "hidden" },

  topicChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  topicText: { ...dtype.label },

  chipRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  readerRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  readerText: { ...dtype.meta, fontSize: 11 },
  // 읽음 배지 — 칩/배지 규격(§3: radius 999).
  readChip: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  readText: { ...dtype.label, fontSize: 11 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  metaText: { ...dtype.meta, flex: 1 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { ...dtype.meta, fontWeight: "600", fontFamily: PRETENDARD["600"] },

  bmBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  bmOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 999,
    opacity: 0.94,
  },

  cardH: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  thumbH: { width: "100%", aspectRatio: 3 / 2 },
  thumbImg: { width: "100%", height: "100%" },
  cardHBody: { padding: 12, gap: 8 },
  // ⚠️ 제목은 **2줄 자리를 늘 차지한다**(minHeight). numberOfLines 만 주면 한 줄짜리 글에서
  //    카드가 한 줄만큼 짧아져, 나란히 놓인 카드들의 아래 줄이 안 맞는다.
  cardTitle: { ...dtype.cardTitle, minHeight: 23 * 2 },

  // 위아래 16 — 12 였을 때 행 사이가 24px 밖에 안 떠서 목록이 촘촘하게 뭉쳐 보였다.
  // 썸네일과 글 사이 20 — 12·16 에서는 그림과 글이 붙어 한 덩어리로 읽혔다.
  // 특히 아래 메타 줄(로고+출처)이 썸네일 옆에 바싹 붙어 보였다.
  row: { flexDirection: "row", gap: 20, paddingVertical: 16, alignItems: "center" },
  // 글 블록도 썸네일과 같은 높이로 못 박는다 — 제목 줄 수에 따라 행이 들쭉날쭉하지 않게.
  rowText: { flex: 1, height: ROW_THUMB_H, justifyContent: "space-between" },
  rowTitle: { ...dtype.cardTitle, minHeight: 23 * 2 },
  // 리스트 행 썸네일 — **가로가 긴 3:2**. 정사각이면 기사 사진이 양옆으로 잘려 나간다.
  // 크기를 고정해야 모든 행이 같은 크기가 된다(§4.3).
  thumbRow: { width: ROW_THUMB_W, height: ROW_THUMB_H, borderRadius: 12, overflow: "hidden" },

  featured: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  // 네 형태 모두 **3:2 가로형**으로 맞춘다 — 카드마다 비율이 다르면 목록을 섞어 놓았을 때
  // 같은 글이 다른 크기로 보여 어느 게 중요한 건지 헷갈린다.
  featuredThumb: { width: "100%", aspectRatio: 3 / 2 },
  featuredBody: { padding: 16, gap: 8 },
  featuredTitle: { ...dtype.titleL, minHeight: 30 * 2 },

  gridCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  gridThumb: { width: "100%", aspectRatio: 3 / 2, alignItems: "center", justifyContent: "center" },
  gridBody: { padding: 10, gap: 8 },
  gridTitle: { ...dtype.cardTitle, fontSize: 14, lineHeight: 21, minHeight: 21 * 2 },
});
