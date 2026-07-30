import { useFonts } from "expo-font";

/**
 * Pretendard 로딩 훅 (dev/README §2).
 *
 * ⚠️ 폰트 파일을 아직 넣지 않았으므로 지금은 **시스템 폰트로 폴백**하도록
 *    비활성 상태입니다(빌드가 깨지지 않게). 폰트를 켜는 방법:
 *
 *   1) assets/fonts/ 에 Pretendard TTF/OTF 를 넣습니다.
 *        assets/fonts/Pretendard-Regular.otf
 *        assets/fonts/Pretendard-SemiBold.otf  (선택)
 *        assets/fonts/Pretendard-Bold.otf      (선택)
 *   2) 아래 useFonts 의 주석을 해제하고 require 경로를 맞춥니다.
 *   3) theme/tokens.ts 의 fontFamily 값("Pretendard")과 키를 일치시킵니다.
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    // "Pretendard": require("../../assets/fonts/Pretendard-Regular.otf"),
    // "Pretendard-SemiBold": require("../../assets/fonts/Pretendard-SemiBold.otf"),
    // "Pretendard-Bold": require("../../assets/fonts/Pretendard-Bold.otf"),
  });
  return loaded;
}
