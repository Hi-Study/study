import { useFonts } from "expo-font";

/**
 * Pretendard 로딩 훅 (dev/README §2).
 *
 * ⚠️ **React Native 에서 커스텀 폰트는 `fontWeight` 에 반응하지 않는다.**
 *    시스템 폰트는 "Pretendard" 하나에 fontWeight:700 을 주면 굵어지지만, expo-font 로
 *    등록한 폰트는 **굵기마다 별개의 패밀리**다. 그래서 아래처럼 굵기별로 따로 등록하고,
 *    스타일에서는 `pretendard(weight)`(theme/tokens.ts)로 패밀리를 골라 써야 한다.
 *    "Pretendard" 하나만 등록하고 fontWeight 를 그대로 두면 **전부 Regular 로 납작해진다.**
 *
 * 번들 크기: 굵기당 약 2.7MB(한글 전체 자족). 실제로 쓰는 5개만 넣었다.
 *   · 900(Black)은 사용처가 2곳뿐이라 ExtraBold 로 매핑하고 파일을 넣지 않았다.
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    "Pretendard-Regular": require("../../assets/fonts/Pretendard-Regular.ttf"),
    "Pretendard-Medium": require("../../assets/fonts/Pretendard-Medium.ttf"),
    "Pretendard-SemiBold": require("../../assets/fonts/Pretendard-SemiBold.ttf"),
    "Pretendard-Bold": require("../../assets/fonts/Pretendard-Bold.ttf"),
    "Pretendard-ExtraBold": require("../../assets/fonts/Pretendard-ExtraBold.ttf"),
  });
  return loaded;
}
