/**
 * 원문 보기 — 앱 안에서 원문 페이지를 그대로 띄운다(밖으로 나가지 않는다).
 *
 * 왜 웹뷰인가:
 *   · 앱에서 아이프레임은 동작하지 않고, 웹에서도 많은 블로그가 프레임 삽입을 막는다.
 *   · 웹뷰는 브라우저처럼 페이지를 직접 여는 것이라 그 제약을 받지 않는다.
 *   · 이미지·표·코드 서식이 원본 그대로 보인다 — 우리가 뽑아둔 본문이 못 살리는 부분이다.
 *
 * 밑줄·용어 풀이는 여기서 안 된다(남의 페이지라 우리가 손댈 수 없다).
 * 그건 상세 화면의 '흐름'이 맡는다 — 둘은 대체가 아니라 역할 분담이다.
 *
 * ⚠️ react-native-webview 는 웹(react-native-web)에 대응 컴포넌트가 없다.
 *    그래서 웹에서는 iframe 으로 그리고, 막힌 사이트를 대비해 새 탭 링크를 같이 둔다.
 */
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, ExternalLink, RotateCw } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { dtype } from "@/theme";
import { domainOf } from "@/lib/text";

type Props = NativeStackScreenProps<RootStackParamList, "ArticleWebView">;

export function ArticleWebViewScreen({ route }: Props) {
  const { url, title } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const reloadRef = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => {
    reloadRef.current += 1;
    setFailed(false);
    setLoading(true);
    setReloadKey(reloadRef.current);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top"]}>
      <View style={[styles.bar, { borderBottomColor: c.hairline, backgroundColor: c.surfaceCard }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <ChevronLeft size={22} color={c.textPrimary} />
        </Pressable>
        <View style={styles.barTitle}>
          <Text style={[styles.barName, { color: c.textPrimary }]} numberOfLines={1}>
            {title ?? domainOf(url)}
          </Text>
          <Text style={[styles.barUrl, { color: c.textMuted }]} numberOfLines={1}>
            {domainOf(url)}
          </Text>
        </View>
        <Pressable onPress={reload} hitSlop={8} style={styles.iconBtn}>
          <RotateCw size={18} color={c.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(url).catch(() => undefined)}
          hitSlop={8}
          style={styles.iconBtn}
        >
          <ExternalLink size={18} color={c.textMuted} />
        </Pressable>
      </View>

      <View style={styles.fill}>
        <WebFrame
          key={reloadKey}
          url={url}
          onLoaded={() => setLoading(false)}
          onFailed={() => {
            setLoading(false);
            setFailed(true);
          }}
        />

        {loading && !failed ? (
          <View style={[styles.overlay, { backgroundColor: c.surfacePage }]}>
            <ActivityIndicator color={c.primary} />
            <Text style={[styles.overlayText, { color: c.textMuted }]}>원문을 불러오는 중…</Text>
          </View>
        ) : null}

        {failed ? (
          <View style={[styles.overlay, { backgroundColor: c.surfacePage }]}>
            <Text style={[styles.failTitle, { color: c.textPrimary }]}>
              이 블로그는 앱 안에서 열 수 없어요
            </Text>
            <Text style={[styles.overlayText, { color: c.textMuted }]}>
              브라우저에서 열면 정상적으로 보입니다.
            </Text>
            <Pressable
              style={[styles.failBtn, { backgroundColor: c.primary }]}
              onPress={() => Linking.openURL(url).catch(() => undefined)}
            >
              <Text style={[styles.failBtnText, { color: c.actionOn }]}>브라우저로 열기</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/**
 * 플랫폼별 알맹이.
 * require 를 조건부로 쓰는 이유: 웹 번들에 react-native-webview 가 들어가면
 * 모듈 해석 단계에서 터진다(웹 구현이 없다). import 문은 조건을 못 쓴다.
 */
function WebFrame({
  url,
  onLoaded,
  onFailed,
}: {
  url: string;
  onLoaded: () => void;
  onFailed: () => void;
}) {
  if (Platform.OS === "web") {
    // react-native-web 은 DOM 으로 그려지므로 iframe 을 그대로 쓸 수 있다.
    // 프레임 삽입을 막는 사이트는 onLoad 가 와도 빈 화면이라, 사용자가 위 ↗ 버튼으로 나갈 수 있게 둔다.
    return (
      <iframe
        src={url}
        title="원문"
        onLoad={onLoaded}
        onError={onFailed}
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require("react-native-webview") as typeof import("react-native-webview");
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1 }}
      onLoadEnd={onLoaded}
      onError={onFailed}
      onHttpError={onFailed}
      startInLoadingState={false}
      allowsBackForwardNavigationGestures
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  barTitle: { flex: 1, paddingHorizontal: 4 },
  barName: { ...dtype.cardTitle, fontSize: 15 },
  barUrl: { ...dtype.meta },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  overlayText: { ...dtype.bodyS, textAlign: "center" },
  failTitle: { ...dtype.title, textAlign: "center" },
  failBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 6 },
  failBtnText: { ...dtype.cardTitle },
});
