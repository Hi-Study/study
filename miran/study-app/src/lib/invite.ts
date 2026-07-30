/**
 * 초대 코드 입력 정제: 대문자화 → 영숫자만 → 최대 6자.
 * (JoinStudy 입력, dev/api.md §2 "참여 시 대문자화·6자 검증")
 */
export function sanitizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
