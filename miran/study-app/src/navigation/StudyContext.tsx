import { createContext, useContext, type ReactNode } from "react";

/** 스터디 내부 탭 화면들이 공통으로 참조하는 현재 studyId. */
const StudyContext = createContext<string | null>(null);

export function StudyProvider({
  studyId,
  children,
}: {
  studyId: string;
  children: ReactNode;
}) {
  return (
    <StudyContext.Provider value={studyId}>{children}</StudyContext.Provider>
  );
}

export function useStudyId(): string {
  const id = useContext(StudyContext);
  if (!id) throw new Error("useStudyId 는 StudyProvider 내부에서만 사용하세요.");
  return id;
}
