// 로그인 — 구글 로그인만 지원(회의록 정책). 세션이 없을 때 게이트가 이 화면을 마운트.
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/providers/ThemeProvider";
import { signInWithGoogle } from "@/auth/googleSignIn";
import { dtype } from "@/theme";

export function LoginScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGoogle = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await signInWithGoogle();
      // 성공하면 onAuthStateChange → 게이트가 앱을 마운트. (여기서 네비게이션 불필요)
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했어요. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
      <View style={styles.body}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: c.primary }]}>
            <Text style={styles.logoMark}>d</Text>
          </View>
          <Text style={[styles.title, { color: c.textPrimary }]}>distill</Text>
          <Text style={[styles.tagline, { color: c.textMuted }]}>
            테크·기획 블로그의 좋은 글을{"\n"}읽고, 인사이트를 나누는 곳
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onGoogle}
            disabled={pending}
            style={[styles.googleBtn, { backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pending ? 0.7 : 1 }]}
          >
            {pending ? (
              <ActivityIndicator color={c.textPrimary} />
            ) : (
              <>
                <GoogleG />
                <Text style={[styles.googleText, { color: c.textPrimary }]}>구글로 계속하기</Text>
              </>
            )}
          </Pressable>

          {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

          <Text style={[styles.legal, { color: c.textMuted }]}>
            계속하면 서비스 이용에 동의하는 것으로 간주됩니다.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// 구글 'G' 마크 — 외부 이미지 없이 색 원형으로 간단 표현(브랜드 4색 대체).
function GoogleG() {
  return (
    <View style={styles.gWrap}>
      <Text style={styles.gText}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 28, justifyContent: "space-between", paddingVertical: 48 },

  brand: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  logo: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  logoMark: { color: "#fff", fontSize: 40, fontWeight: "900" },
  title: { ...dtype.display, fontSize: 30 },
  tagline: { ...dtype.body, textAlign: "center", lineHeight: 23 },

  actions: { gap: 14 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
  },
  gWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e2e2e2" },
  gText: { color: "#4285F4", fontSize: 15, fontWeight: "900" },
  googleText: { ...dtype.cardTitle, fontSize: 16 },
  error: { ...dtype.bodyS, textAlign: "center" },
  legal: { ...dtype.meta, textAlign: "center" },
});
