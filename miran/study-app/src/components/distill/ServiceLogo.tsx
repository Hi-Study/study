// 출처(기업) 로고칩 — DESIGN_GUIDE §6.6.
//   파비콘을 우선 쓰고, 못 불러오면 브랜드색 타일 + 이름 첫 글자로 떨어진다.
//
// ArticleCards 안에 있던 것을 여기로 뺐다. 썸네일 폴백(ArticleThumb)이 이걸 쓰는데
// 같은 파일에 두면 순환 참조가 된다. ArticleCards 는 호환을 위해 재수출한다.
import React, { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { faviconDomain, faviconUrl } from "@/lib/brandIcon";

export function ServiceLogo({
  name,
  brandColor,
  size = 44,
  homepage,
  blogKey,
}: {
  name: string;
  brandColor?: string | null;
  size?: number;
  homepage?: string | null;
  blogKey?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const domain = useMemo(() => faviconDomain(blogKey, homepage), [blogKey, homepage]);

  if (domain && !failed) {
    return (
      <View style={[styles.favicon, { width: size, height: size, borderRadius: size * 0.28 }]}>
        <Image
          source={{ uri: faviconUrl(domain) }}
          style={{ width: size * 0.66, height: size * 0.66 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  const bg = brandColor ?? "#4F46E5";
  return (
    <View
      style={[
        styles.logo,
        { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.logoText, { fontSize: size * 0.4 }]}>{name.slice(0, 1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  favicon: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  logo: { alignItems: "center", justifyContent: "center" },
  logoText: { color: "#FFFFFF", fontWeight: "800" },
});
