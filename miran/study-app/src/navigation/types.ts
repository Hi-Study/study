import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { Topic } from "@/types/database";
import type { ServiceKind } from "@/lib/serviceKind";

export type DistillTabParamList = {
  Home: undefined;
  /** 홈의 대분류·목적 태그·서비스 종류를 누르면 그게 켜진 채로 열린다. */
  Feed: { topic?: Topic; purpose?: string; service?: ServiceKind } | undefined;
  Archive: undefined;
  MyPage: undefined;
};

export type RootStackParamList = {
  ProfileEdit: undefined;
  DisplaySettings: undefined;

  // ===== distill =====
  DistillTabs: NavigatorScreenParams<DistillTabParamList> | undefined;
  ArticleDetail: { articleId: string; focusOpinionId?: string };
  BlogArticles: { blogId: string; blogName: string };
  //   질문은 CreateOpinionScreen 이 글의 decision 을 읽어 스스로 조립한다(param 으로 안 넘긴다).
  CreateOpinion: { articleId: string };
  // 인사이트 상세는 없앴다 — 인사이트는 **글 상세의 인사이트 시트**에서만 오간다.
  //   (마이·그날 활동에서 누르면 ArticleDetail 의 focusOpinionId 로 그 자리까지 스크롤)
  DayActivity: { date: string }; // 'YYYY-MM-DD' — 마이 활동 캘린더에서 날짜 탭
  /** 원문 보기 — 앱 안 웹뷰(§33). 밖으로 나가지 않는다. */
  ArticleWebView: { url: string; title?: string | null };
  /** 아카이브 상세 — archiveId 가 null 이면 '모든 저장글'(북마크 전체). */
  ArchiveDetail: { archiveId: string | null; name: string };
  /** 아카이브 만들기/수정 — archiveId 가 있으면 수정 모드. */
  CreateArchive: { archiveId?: string } | undefined;
  Search: { q?: string } | undefined;
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;

/** 타입이 붙은 네비게이션 훅. */
export function useRootNav(): RootNav {
  return useNavigation<RootNav>();
}
