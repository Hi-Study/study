import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { RouteProp } from "@react-navigation/native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import {
  useCreateDiscussion,
  useDiscussion,
  useUpdateDiscussion,
} from "@/data/discussions";
import { weekOptions } from "@/lib/date";
import { Screen, ScreenHeader } from "@/components/Chrome";
import { Loading, PillButton, TagInput, TextField } from "@/components";
import { PRETENDARD } from "@/theme";

type R = RouteProp<RootStackParamList, "CreateDiscussion">;

function parseDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function CreateDiscussionScreen({ route }: { route: R }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const { studyId, editDiscussionId } = route.params;
  const editing = Boolean(editDiscussionId);
  const create = useCreateDiscussion(studyId);
  const existing = useDiscussion(editDiscussionId ?? "");
  const update = useUpdateDiscussion(studyId, editDiscussionId ?? "");

  const weeks = useMemo(() => weekOptions(new Date()), []);
  const [mode, setMode] = useState<"link" | "text">("link");
  const [weekIdx, setWeekIdx] = useState(2); // 이번 주
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(!editing);

  useEffect(() => {
    if (editing && existing.data && !ready) {
      const d = existing.data;
      setMode(d.kind);
      setTitle(d.title ?? "");
      setContent(d.body ?? d.prompt ?? "");
      setTags(d.tags ?? []);
      if (d.url) setUrl(d.url);
      setReady(true);
    }
  }, [editing, existing.data, ready]);

  const domain = parseDomain(url);
  // 앱 '공유'로 복사되는 단축주소 — 본문이 없어 원문 추출 불가. 원문 주소 유도.
  const isShortLink =
    /(?:^|\.)(?:naver\.me|me2\.do|bit\.ly|han\.gl|kko\.to|url\.kr|buly\.kr|vo\.la|goo\.gl|t\.co)$/i.test(domain);
  const canSubmit = editing
    ? title.trim() !== "" && !submitting
    : title.trim() !== "" && (mode === "link" ? !!domain : true) && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const prompt =
        content.trim() || (mode === "link" ? "이 글을 함께 읽고 토론해요." : "함께 이야기해봐요.");

      if (editing) {
        await update.mutateAsync({
          title: title.trim(),
          prompt,
          body: content.trim() || prompt,
          tags,
        });
        nav.goBack();
        return;
      }

      const week = weeks[weekIdx];
      const row = await create.mutateAsync({
        title: title.trim(),
        weekLabel: week.label,
        weekStart: week.weekStartISO,
        kind: mode,
        prompt,
        body: content.trim() || prompt,
        url: mode === "link" ? url.trim() : undefined,
        tags,
      });
      nav.replace("DiscussionDetail", { studyId, discussionId: row.id });
    } catch (e) {
      Alert.alert("토론 등록 실패", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      header={<ScreenHeader title={editing ? "토론 수정" : "토론 만들기"} onBack={() => nav.goBack()} />}
      keyboardAvoiding
      contentStyle={styles.content}
    >
      {editing && !ready ? <Loading /> : null}

      {ready && !editing ? (
        <>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            외부 글을 걸거나 직접 주제를 쓸 수 있어요.
          </Text>

          {/* 모드 토글 */}
          <View style={[styles.segment, { backgroundColor: c.canvasParchment }]}>
            {(["link", "text"] as const).map((k) => {
              const on = mode === k;
              return (
                <Pressable key={k} onPress={() => setMode(k)} style={[styles.seg, on && { backgroundColor: c.surfaceCard }]}>
                  <Text style={[styles.segText, { color: on ? c.textPrimary : c.textMuted }]}>
                    {k === "link" ? "외부 글로 토론" : "직접 작성"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 주차 */}
          <Text style={[styles.label, { color: c.textPrimary }]}>주차</Text>
          <View style={styles.weekRow}>
            {weeks.map((w, i) => {
              const on = i === weekIdx;
              return (
                <Pressable
                  key={w.weekStartISO}
                  onPress={() => setWeekIdx(i)}
                  style={[
                    styles.weekChip,
                    { backgroundColor: c.surfaceCard, borderColor: on ? c.primaryFocus : c.hairline, borderWidth: on ? 2 : 1 },
                  ]}
                >
                  <Text style={{ color: on ? c.primary : c.textPrimary, fontSize: 13, fontWeight: "600", fontFamily: PRETENDARD["600"] }}>
                    {w.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

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
              ) : (
                <Text style={[styles.hint, { color: c.textMuted }]}>
                  링크를 넣으면 원문 본문을 자동으로 불러와 함께 보여드려요. 앱 공유로 복사한
                  단축주소 말고, 브라우저 주소창의 원문 URL을 넣어야 본문을 가져올 수 있어요.
                </Text>
              )}
            </>
          ) : null}
        </>
      ) : null}

      {ready ? (
        <>
          <TextField
            label="토론 주제"
            value={title}
            onChangeText={setTitle}
            placeholder="예: 좋은 온보딩의 조건은?"
          />
          <TextField
            label="여는 글 (선택)"
            value={content}
            onChangeText={setContent}
            placeholder={mode === "link" ? "이 글의 어떤 점을 함께 이야기하고 싶나요?" : "토론을 여는 배경이나 질문을 적어주세요"}
            multiline
          />

          <TagInput tags={tags} onChange={setTags} />

          <View style={{ height: 12 }} />
          <PillButton
            label={editing ? "수정 완료" : "토론 등록"}
            onPress={submit}
            disabled={!canSubmit}
            loading={submitting}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  subtitle: { fontSize: 13.5, marginTop: -4 },
  segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 8 },
  seg: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  segText: { fontSize: 14, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  label: { fontSize: 13, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  weekRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  weekChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 90 },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: -6 },
});
