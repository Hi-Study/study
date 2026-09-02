import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { RouteProp } from "@react-navigation/native";
import { ImagePlus, Plus, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useUid } from "@/auth/AuthProvider";
import { useCreateShare, useShareDetail, useUpdateShare } from "@/data/shares";
import { uploadShareImages } from "@/lib/storage";
import { currentWeekDates, toISODate } from "@/lib/date";
import { EMPTY_INSIGHT, cleanInsight, toInsight, type Insight } from "@/lib/insight";
import { Screen, ScreenHeader } from "@/components/Chrome";
import { Loading, PillButton, TagInput, TextField } from "@/components";
import { PRETENDARD } from "@/theme";

type R = RouteProp<RootStackParamList, "CreateShare">;

const DAYS: [number, string][] = [
  [0, "월"],
  [1, "화"],
  [2, "수"],
  [3, "목"],
  [4, "금"],
];

function parseDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function CreateShareScreen({ route }: { route: R }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const uid = useUid();
  const { studyId, defaultDay, editShareId } = route.params;
  const editing = Boolean(editShareId);
  const create = useCreateShare(studyId);
  const existing = useShareDetail(editShareId ?? "");
  const update = useUpdateShare(studyId, editShareId ?? "");

  const initialDay = defaultDay != null && defaultDay >= 0 && defaultDay <= 4 ? defaultDay : 0;
  const [mode, setMode] = useState<"link" | "text">("link");
  const [day, setDay] = useState(initialDay);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [insight, setInsight] = useState<Insight>(EMPTY_INSIGHT);
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(!editing);

  // 편집 모드: 기존 글 값으로 1회 프리필
  useEffect(() => {
    if (editing && existing.data && !ready) {
      const s = existing.data;
      setMode(s.kind);
      setTitle(s.title ?? "");
      // 옛 글(자유 메모만 있는)도 편집 시 핵심 인사이트로 옮겨 담는다.
      const pre = toInsight(s.insight);
      if (!pre.core) pre.core = s.note ?? s.body ?? "";
      setInsight(pre);
      setTags(s.tags ?? []);
      if (s.url) setUrl(s.url);
      setReady(true);
    }
  }, [editing, existing.data, ready]);

  const setField = (k: keyof Insight, v: string) => setInsight((p) => ({ ...p, [k]: v }));
  const addQuestion = () => setInsight((p) => ({ ...p, questions: [...p.questions, ""] }));
  const setQuestion = (i: number, v: string) =>
    setInsight((p) => ({ ...p, questions: p.questions.map((q, idx) => (idx === i ? v : q)) }));
  const removeQuestion = (i: number) =>
    setInsight((p) => ({ ...p, questions: p.questions.filter((_, idx) => idx !== i) }));

  const domain = parseDomain(url);
  // 앱 '공유'로 복사되는 단축주소 — 본문이 없어 원문 추출 불가. 원문 주소 유도.
  const isShortLink =
    /(?:^|\.)(?:naver\.me|me2\.do|bit\.ly|han\.gl|kko\.to|url\.kr|buly\.kr|vo\.la|goo\.gl|t\.co)$/i.test(domain);
  // 편집 중 URL 을 바꿨는지(바꿨으면 저장 시 원문/요약 재수집)
  const urlChanged =
    editing && mode === "link" && url.trim() !== "" && url.trim() !== (existing.data?.url ?? "");
  // 필수: 핵심 인사이트(core). 링크는 URL, 직접작성은 제목도 필요.
  const coreOk = insight.core.trim() !== "";
  const canSubmit = editing
    ? coreOk &&
      (mode === "link" ? !urlChanged || !!domain : title.trim() !== "") &&
      !submitting
    : (mode === "link" ? !!domain : title.trim() !== "") && coreOk && !submitting;

  const sharedDate = useMemo(() => toISODate(currentWeekDates(new Date())[day]), [day]);

  async function pickImages() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!res.canceled) setImages(res.assets.map((a) => a.uri));
  }

  async function submit() {
    if (!canSubmit) return;
    const clean = cleanInsight(insight);
    if (!clean) return; // core 필수(가드)
    setSubmitting(true);
    try {
      // 편집 모드: 제목 + 인사이트만 수정(note/body 에 core 를 넣어 미리보기·검색 호환)
      if (editing) {
        await update.mutateAsync(
          mode === "link"
            ? {
                title: title.trim() || domain,
                note: clean.core,
                insight: clean,
                tags,
                ...(urlChanged ? { url: url.trim() } : {}),
              }
            : { title: title.trim(), body: clean.core, insight: clean, tags },
        );
        nav.goBack();
        return;
      }
      let row;
      if (mode === "link") {
        row = await create.link.mutateAsync({
          url: url.trim(),
          note: clean.core,
          insight: clean,
          title: title.trim() || domain,
          dayOfWeek: day,
          sharedDate,
          tags,
        });
      } else {
        let imageUrls: string[] | undefined;
        if (images.length > 0) imageUrls = await uploadShareImages(uid, images);
        row = await create.text.mutateAsync({
          title: title.trim(),
          body: clean.core,
          insight: clean,
          dayOfWeek: day,
          sharedDate,
          imageUrls,
          tags,
        });
      }
      nav.replace("ShareDetail", { studyId, shareId: row.id });
    } catch (e) {
      Alert.alert("공유 실패", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      header={<ScreenHeader title={editing ? "글 수정" : "글 공유하기"} onBack={() => nav.goBack()} />}
      keyboardAvoiding
      contentStyle={styles.content}
    >
      {editing && !ready ? <Loading /> : null}

      {/* 모드 토글 (편집 시 숨김) */}
      {ready && !editing ? (
      <View style={[styles.segment, { backgroundColor: c.canvasParchment }]}>
        {(["link", "text"] as const).map((k) => {
          const on = mode === k;
          return (
            <Pressable
              key={k}
              onPress={() => setMode(k)}
              style={[styles.seg, on && { backgroundColor: c.surfaceCard }]}
            >
              <Text style={[styles.segText, { color: on ? c.textPrimary : c.textMuted }]}>
                {k === "link" ? "링크 공유" : "직접 작성"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      ) : null}

      {/* 요일 (편집 시 숨김) */}
      {ready && !editing ? (
        <>
      <Text style={[styles.label, { color: c.textPrimary }]}>어느 요일에 공유할까요?</Text>
      <View style={styles.dayRow}>
        {DAYS.map(([k, l]) => {
          const on = k === day;
          return (
            <Pressable
              key={k}
              onPress={() => setDay(k)}
              style={[
                styles.dayChip,
                {
                  backgroundColor: c.surfaceCard,
                  borderColor: on ? c.primaryFocus : c.hairline,
                  borderWidth: on ? 2 : 1,
                },
              ]}
            >
              <Text style={{ color: on ? c.primary : c.textPrimary, fontWeight: "600", fontFamily: PRETENDARD["600"] }}>{l}</Text>
            </Pressable>
          );
        })}
      </View>
        </>
      ) : null}

      {ready ? (
        <>
          {mode === "link" ? (
            <>
              <TextField
                label="글 URL"
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                inputMode="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {url.trim() && !domain ? (
                <Text style={{ color: c.error, fontSize: 12.5 }}>
                  올바른 URL을 입력하세요 (예: https://example.com/...)
                </Text>
              ) : isShortLink ? (
                <Text style={[styles.hint, { color: c.error }]}>
                  앱 공유로 복사한 단축주소(예: naver.me)는 본문을 불러올 수 없어요. 브라우저 주소창의
                  원문 주소를 붙여넣어 주세요.
                </Text>
              ) : editing ? (
                <Text style={[styles.hint, { color: c.textMuted }]}>
                  URL을 바꾸면 새 주소의 원문 본문과 요약을 다시 불러옵니다.
                </Text>
              ) : (
                <Text style={[styles.hint, { color: c.textMuted }]}>
                  링크를 넣으면 원문 본문을 자동으로 불러와 함께 보여드려요. 앱 공유로 복사한
                  단축주소 말고, 브라우저 주소창의 원문 URL을 넣어야 본문을 가져올 수 있어요.
                </Text>
              )}
              <TextField
                label="제목 (선택 · 비우면 원문 제목 사용)"
                value={title}
                onChangeText={setTitle}
                placeholder="예: 좋은 기획서의 조건"
              />
            </>
          ) : (
            <TextField label="제목" value={title} onChangeText={setTitle} placeholder="글 제목" />
          )}

          {/* 핵심 인사이트 양식(링크·직접작성 공통) */}
          <InsightFields
            insight={insight}
            onField={setField}
            onAddQuestion={addQuestion}
            onSetQuestion={setQuestion}
            onRemoveQuestion={removeQuestion}
          />

          {/* 이미지 첨부(직접 작성 글만, 편집 시 숨김) */}
          {mode === "text" && !editing ? (
            <>
              <Text style={[styles.label, { color: c.textPrimary }]}>사진 (선택)</Text>
              <View style={styles.imageRow}>
                {images.map((uri, i) => (
                  <View key={uri} style={styles.imageThumbWrap}>
                    <Image source={{ uri }} style={styles.imageThumb} />
                    <Pressable
                      onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      style={styles.imageRemove}
                      hitSlop={6}
                    >
                      <X size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  onPress={pickImages}
                  style={[styles.imageAdd, { borderColor: c.hairline }]}
                >
                  <ImagePlus size={22} color={c.textMuted} />
                </Pressable>
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {ready ? (
        <>
          <TagInput tags={tags} onChange={setTags} />
          <View style={{ height: 12 }} />
          <PillButton
            label={editing ? "수정 완료" : "공유하기"}
            onPress={submit}
            disabled={!canSubmit}
            loading={submitting}
          />
        </>
      ) : null}
    </Screen>
  );
}

/** 핵심 인사이트 구조화 입력(1.핵심 2.적용 3.사례 4.질문리스트). core 만 필수. */
function InsightFields({
  insight,
  onField,
  onAddQuestion,
  onSetQuestion,
  onRemoveQuestion,
}: {
  insight: Insight;
  onField: (k: keyof Insight, v: string) => void;
  onAddQuestion: () => void;
  onSetQuestion: (i: number, v: string) => void;
  onRemoveQuestion: (i: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={{ gap: 14 }}>
      {/* 1. 핵심 인사이트 (필수) */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>1. 핵심 인사이트</Text>
        <View style={[styles.reqBadge, { backgroundColor: c.tintLavender }]}>
          <Text style={[styles.reqText, { color: c.primary }]}>필수</Text>
        </View>
      </View>
      <TextField
        value={insight.core}
        onChangeText={(v) => onField("core", v)}
        placeholder="이 글에서 얻은 가장 중요한 인사이트는?"
        multiline
      />
      <TextField
        label="인상적인 문장"
        value={insight.quote}
        onChangeText={(v) => onField("quote", v)}
        placeholder="가장 인상 깊었던 문장을 옮겨 적어요 (선택)"
        multiline
      />
      <TextField
        label="인사이트 해석"
        value={insight.interpretation}
        onChangeText={(v) => onField("interpretation", v)}
        placeholder="그 인사이트를 내 언어로 풀어보면? (선택)"
        multiline
      />

      {/* 2. 적용 */}
      <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
        2. 내가 바로 적용할 수 있는 것
      </Text>
      <TextField
        value={insight.apply}
        onChangeText={(v) => onField("apply", v)}
        placeholder="지금 업무·기획에 바로 적용할 점 (선택)"
        multiline
      />

      {/* 3. 비슷한 사례 */}
      <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>3. 비슷한 사례</Text>
      <TextField
        value={insight.similar}
        onChangeText={(v) => onField("similar", v)}
        placeholder="떠오르는 비슷한 사례나 경험 (선택)"
        multiline
      />

      {/* 4. 질문 리스트 */}
      <View>
        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>4. 질문 리스트</Text>
        <Text style={[styles.sectionHint, { color: c.textMuted }]}>
          팀원들과 나누고 싶은 질문을 추가하세요 (선택)
        </Text>
      </View>
      {insight.questions.map((q, i) => (
        <View key={i} style={styles.qRow}>
          <TextField
            containerStyle={{ flex: 1 }}
            value={q}
            onChangeText={(v) => onSetQuestion(i, v)}
            placeholder={`질문 ${i + 1}`}
          />
          <Pressable onPress={() => onRemoveQuestion(i)} style={styles.qRemove} hitSlop={6}>
            <X size={18} color={c.textMuted} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={onAddQuestion} style={[styles.addQ, { borderColor: c.hairline }]}>
        <Plus size={16} color={c.primary} />
        <Text style={[styles.addQText, { color: c.primary }]}>질문 추가</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  sectionHint: { fontSize: 12.5, marginTop: 4 },
  reqBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 90 },
  reqText: { fontSize: 11, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  qRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qRemove: { padding: 4 },
  addQ: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  addQText: { fontSize: 13.5, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 8 },
  seg: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  segText: { fontSize: 14, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  label: { fontSize: 13, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  dayRow: { flexDirection: "row", gap: 8 },
  dayChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8 },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: -6 },
  imageRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  imageThumbWrap: { position: "relative" },
  imageThumb: { width: 72, height: 72, borderRadius: 8 },
  imageRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageAdd: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});
