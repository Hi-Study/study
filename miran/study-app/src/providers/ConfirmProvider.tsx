import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/** 네이티브 Alert 대신 앱 디자인에 맞춘 확인 모달. `useConfirm()` 로 Promise<boolean> 반환. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );

  function close(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  const o = state?.opts;
  const destructive = o?.destructive;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable style={styles.backdrop} onPress={() => close(false)}>
          {/* 카드 내부 탭이 백드롭으로 새지 않도록 */}
          <Pressable style={[styles.card, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
            <Text style={[styles.title, { color: c.textPrimary }]}>{o?.title}</Text>
            {o?.message ? (
              <Text style={[styles.message, { color: c.textSecondary }]}>{o.message}</Text>
            ) : null}
            <View style={styles.row}>
              <Pressable
                onPress={() => close(false)}
                style={({ pressed }) => [
                  styles.btn,
                  styles.cancelBtn,
                  { borderColor: c.hairline, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.btnText, { color: c.textPrimary }]}>
                  {o?.cancelText ?? "취소"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => close(true)}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: pressed || destructive ? c.primaryPress : c.primary },
                ]}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>
                  {o?.confirmText ?? "확인"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  message: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  row: { flexDirection: "row", gap: 10, marginTop: 20 },
  btn: { flex: 1, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cancelBtn: { borderWidth: 1, backgroundColor: "transparent" },
  btnText: { fontSize: 15, fontWeight: "700" },
});
