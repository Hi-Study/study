import { useRef, useState, type ReactNode } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onPress: () => void;
}

interface Anchor {
  top?: number;
  bottom?: number;
  right: number;
}

/**
 * 트리거(children)에 앵커되는 드롭다운 메뉴. 네이티브 Alert 대신 사용.
 * 트리거를 화면 좌표로 측정해 바로 아래(공간 부족 시 위)로 펼친다.
 */
export function Menu({
  items,
  children,
  style,
}: {
  items: MenuItem[];
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const ref = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor>({ top: 0, right: 12 });

  function toggle() {
    ref.current?.measureInWindow((x, y, w, h) => {
      const { width: sw, height: sh } = Dimensions.get("window");
      const right = Math.max(8, sw - (x + w));
      const menuH = items.length * 46 + 8;
      // 화면 하단 영역(플로팅 버튼/입력바 ≈ 200px)에 걸리면 트리거 "위"로 펼친다.
      const BOTTOM_SAFE = 200;
      if (y + h + menuH > sh - BOTTOM_SAFE) setAnchor({ bottom: sh - y + 4, right });
      else setAnchor({ top: y + h + 4, right });
      setOpen(true);
    });
  }

  return (
    <View ref={ref} collapsable={false} style={style}>
      <Pressable onPress={toggle} hitSlop={8}>
        {children}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.menu,
              {
                top: anchor.top,
                bottom: anchor.bottom,
                right: anchor.right,
                backgroundColor: c.surfaceCard,
                borderColor: c.hairline,
              },
            ]}
          >
            {items.map((it, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  setOpen(false);
                  it.onPress();
                }}
                style={({ pressed }) => [
                  styles.item,
                  i > 0 && { borderTopWidth: 1, borderTopColor: c.dividerSoft },
                  pressed && { backgroundColor: c.canvasParchment },
                ]}
              >
                {it.icon}
                <Text style={[styles.label, { color: it.destructive ? "#c0392b" : c.textPrimary }]}>
                  {it.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  menu: {
    position: "absolute",
    minWidth: 148,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 16 },
  label: { fontSize: 14.5, fontWeight: "600" },
});
