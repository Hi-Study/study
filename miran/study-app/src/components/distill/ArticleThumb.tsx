// 카드 썸네일 — **비어 보이지 않게** 한다.
//
// 이미지가 없거나 못 불러오면 예전엔 회색 바탕에 작은 로고만 떴다. 그러면 사용자는
// "이미지를 못 가져왔다"고 느낀다. 그래서 폴백을 **브랜드 색으로 채운 기본 이미지**로
// 만든다 — 출처 색 배경 + 로고 + 글 제목 첫 줄. 카드가 비어 보이지 않는다.
//
// 폴백이 도는 경우는 둘 다다:
//   · og_image 가 아예 없을 때
//   · URL 은 있는데 로딩에 실패할 때(핫링크 차단·만료된 CDN 경로 등) — onError 로 잡는다
import React, { useState } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { safeImageUri } from "@/lib/image";
import { dtype } from "@/theme";
import { ServiceLogo } from "./ServiceLogo";
import type { ArticleWithBlog } from "@/data/articles";

interface Props {
  article: ArticleWithBlog;
  logoSize?: number;
  /** 제목까지 넣을 공간이 있는 큰 썸네일인지(가로 카드·히어로). */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * 브랜드 색을 옅게 깐다 — 원색 그대로면 글자가 안 읽힌다.
 * 폴백(강조색)은 **인자로 받는다** — 이 함수는 모듈 최상위라 테마를 못 읽고,
 *   하드코딩한 #4F46E5 는 다크모드에서 틀린 색이 된다(DESIGN_SYSTEM §6).
 */
function tintOf(hex: string | null | undefined, fallback: string): string {
  const base = hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
  return base + "1A"; // 약 10% 불투명도
}

export function ArticleThumb({ article, logoSize = 34, large = false, style, children }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [failed, setFailed] = useState(false);

  const uri = article.og_image ? safeImageUri(article.og_image) : undefined;
  const showImage = Boolean(uri) && !failed;
  const brand = article.blog?.brand_color;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: showImage ? c.surfaceSunken : tintOf(brand, c.primary) },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.img}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.fallback}>
          <ServiceLogo
            name={article.blog?.name ?? "?"}
            brandColor={brand}
            homepage={article.blog?.homepage}
            blogKey={article.blog?.key}
            size={large ? 40 : logoSize}
          />
          {large ? (
            <Text style={[styles.fbTitle, { color: c.textSecondary }]} numberOfLines={2}>
              {article.title}
            </Text>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  img: { width: "100%", height: "100%" },
  fallback: { alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16 },
  fbTitle: { ...dtype.bodyS, fontSize: 13, lineHeight: 18, textAlign: "center" },
});
