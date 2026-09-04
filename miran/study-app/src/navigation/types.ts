import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

export type StudyTabParamList = {
  Home: undefined;
  Search: undefined;
  MyPage: undefined;
};

export type DistillTabParamList = {
  Home: undefined;
  Feed: undefined;
  Insight: undefined;
  MyPage: undefined;
};

export type RootStackParamList = {
  MyStudies: undefined;
  CreateStudy: undefined;
  JoinStudy: undefined;
  Notifications: undefined;
  Study: { studyId: string; screen?: keyof StudyTabParamList } & Partial<
    NavigatorScreenParams<StudyTabParamList>
  >;
  ShareDetail: { studyId: string; shareId: string };
  CreateShare: { studyId: string; defaultDay?: number; editShareId?: string };
  DiscussionDetail: { studyId: string; discussionId: string };
  CreateDiscussion: { studyId: string; editDiscussionId?: string };
  Members: { studyId: string };
  StudyManage: undefined;
  StudyEdit: { studyId: string };
  ActivityList: { kind: "study" | "share" | "comment" | "pending" };
  ProfileEdit: undefined;
  DisplaySettings: undefined;

  // ===== distill =====
  DistillTabs: NavigatorScreenParams<DistillTabParamList> | undefined;
  ArticleDetail: { articleId: string; focusOpinionId?: string };
  BlogArticles: { blogId: string; blogName: string };
  //   질문은 CreateOpinionScreen 이 글의 decision 을 읽어 스스로 조립한다(param 으로 안 넘긴다).
  /** fromRegister: URL 로 방금 등록한 글 — 감상문을 써야 등록이 끝난다(3칸 전부 필수). */
  CreateOpinion: { articleId: string; fromRegister?: boolean };
  OpinionDetail: { opinionId: string };
  CreateArticle: undefined;
  CreateCommunityPost: undefined;
  CommunityPostDetail: { postId: string };
  DistillNotifications: undefined;
  InsighterProfile: { userId: string };
  DayActivity: { date: string }; // 'YYYY-MM-DD' — 마이 활동 캘린더에서 날짜 탭
  Search: { q?: string } | undefined;
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;

/** 타입이 붙은 네비게이션 훅. */
export function useRootNav(): RootNav {
  return useNavigation<RootNav>();
}
