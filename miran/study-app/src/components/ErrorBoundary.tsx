import { Component, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { PRETENDARD } from "@/theme";

interface State {
  error: Error | null;
}

/**
 * 최상위 에러 경계 — 렌더 중 크래시를 잡아 "실제 에러 메시지+스택"을 화면에 표시.
 * (개발 중 원인 파악용. selectable 이라 길게 눌러 복사 가능)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // 터미널(Metro)에도 남김
    console.error("[ErrorBoundary]", error);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <ScrollView
          style={styles.bg}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.title}>앱 오류가 발생했어요</Text>
          <Text selectable style={styles.msg}>
            {error.message}
          </Text>
          <Text selectable style={styles.stack}>
            {error.stack}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, paddingTop: 72 },
  title: { fontSize: 18, fontWeight: "700", fontFamily: PRETENDARD["700"], color: "#c0392b", marginBottom: 14 },
  msg: { fontSize: 14, color: "#1d1d1d", lineHeight: 20 },
  stack: { fontSize: 11, color: "#888", marginTop: 16, lineHeight: 16 },
});
