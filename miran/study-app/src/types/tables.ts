import type { Database } from "./database";

type T = Database["public"]["Tables"];

export type UserRow = T["users"]["Row"];
export type StudyRow = T["studies"]["Row"];
export type StudyMemberRow = T["study_members"]["Row"];
export type ShareRow = T["shares"]["Row"];
export type DiscussionRow = T["discussions"]["Row"];
export type CommentRow = T["comments"]["Row"];
export type LikeRow = T["likes"]["Row"];
export type NotificationRow = T["notifications"]["Row"];

export type ShareInsert = T["shares"]["Insert"];
export type DiscussionInsert = T["discussions"]["Insert"];
export type CommentInsert = T["comments"]["Insert"];

// ===== distill =====
export type BlogRow = T["blogs"]["Row"];
export type ArticleRow = T["articles"]["Row"];
export type OpinionRow = T["opinions"]["Row"];
export type OpinionCommentRow = T["opinion_comments"]["Row"];
export type ArticleHighlightRow = T["article_highlights"]["Row"];
export type UserTopicRow = T["user_topics"]["Row"];
export type ArticleStampRow = T["article_stamps"]["Row"];

export type OpinionInsert = T["opinions"]["Insert"];
export type OpinionCommentInsert = T["opinion_comments"]["Insert"];
export type ArticleHighlightInsert = T["article_highlights"]["Insert"];
