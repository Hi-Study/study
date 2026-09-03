// 카드 썸네일 — **로딩에 실패해도 빈 박스를 남기지 않는다.**
//
// 예전에는 `og_image` 가 null 일 때만 브랜드 로고로 대체했다. 그런데 URL 이 있어도
// 실제로 못 불러오는 경우가 있다(핫링크 차단·DNS 실패·만료된 CDN 경로).
// 실측: 배달의민족 이미지 도메인이 응답하지 않아 카드가 회색 박스로 남았다.
// 그래서 onError 를 잡아 **같은 폴백**으로 떨어뜨린다.
import React, { useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { safeImageUri } from "@/lib/image";
import { ServiceLogo } from "./ServiceLogo";
import type { ArticleWithBlog } from "@/data/articles";

interface Props {
  article: ArticleWithBlog;
  /** 폴백 로고 크기 */
  logoSize?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode; // 북마크 오버레이 등
}

export function ArticleThumb({ article, logoSize = 34, style, children }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [failed, setFailed] = useState(false);

  const uri = article.og_image ? safeImageUri(article.og_image) : undefined;
  const showImage = Boolean(uri) && !failed;

  return (
    <View style={[styles.wrap, { backgroundColor: c.surfaceSunken }, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={styles.img}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ServiceLogo
          name={article.blog?.name ?? "?"}
          brandColor={article.blog?.brand_color}
          homepage={article.blog?.homepage}
          blogKey={article.blog?.key}
          size={logoSize}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  img: { width: "100%", height: "100%" },
});
