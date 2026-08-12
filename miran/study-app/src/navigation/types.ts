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
  Discuss: undefined;
  Search: undefined;
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
  ArticleDetail: { articleId: string };
  BlogArticles: { blogId: string; blogName: string };
  CreateOpinion: { articleId: string };
  OpinionDetail: { opinionId: string };
  CreateArticle: undefined;
  DistillNotifications: undefined;
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;

/** 타입이 붙은 네비게이션 훅. */
export function useRootNav(): RootNav {
  return useNavigation<RootNav>();
}
