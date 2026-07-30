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
