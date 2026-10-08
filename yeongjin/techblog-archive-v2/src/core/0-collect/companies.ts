/** 0단계 — 수집 대상 블로그 목록. 기준 문서: docs/01_분류기준.md 0단계 */
import type { Company } from "../shared/types";

/** 수집 대상 블로그. feedUrl 이 없으면 `npm run add-url` 로만 추가한다. */
export const COMPANIES: Company[] = [
  { id: "toss", name: "토스", color: "#0064FF", blogUrl: "https://toss.tech", feedUrl: "https://toss.tech/rss.xml" },
  { id: "woowahan", name: "우아한형제들", color: "#2AC1BC", blogUrl: "https://techblog.woowahan.com", feedUrl: "https://techblog.woowahan.com/feed/" },
  { id: "kakao", name: "카카오", color: "#E0B800", blogUrl: "https://tech.kakao.com", feedUrl: "https://tech.kakao.com/feed/" },
  { id: "naver", name: "네이버 D2", color: "#03C75A", blogUrl: "https://d2.naver.com", feedUrl: "https://d2.naver.com/d2.atom" },
  { id: "daangn", name: "당근", color: "#FF6F0F", blogUrl: "https://medium.com/daangn", feedUrl: "https://medium.com/feed/daangn", homeUrl: "https://www.daangn.com" },
  { id: "ly", name: "LY Corp", color: "#06C755", blogUrl: "https://techblog.lycorp.co.jp/ko", feedUrl: "https://techblog.lycorp.co.jp/ko/feed/index.xml" },
  { id: "banksalad", name: "뱅크샐러드", color: "#00C68E", blogUrl: "https://blog.banksalad.com", feedUrl: "https://blog.banksalad.com/rss.xml" },
  { id: "socar", name: "쏘카", color: "#00B8FF", blogUrl: "https://tech.socarcorp.kr", feedUrl: "https://tech.socarcorp.kr/rss.xml" },
  { id: "channel", name: "채널톡", color: "#5E56F0", blogUrl: "https://tech.channel.io/kr", feedUrl: "https://tech.channel.io/kr/rss.xml" },
  {
    id: "bucketplace",
    name: "오늘의집",
    color: "#35C5F0",
    blogUrl: "https://www.bucketplace.com/culture/Tech/",
    feedUrl: null,
    // RSS 가 없어 목록 페이지의 글 링크를 직접 따라간다
    listPage: { url: "https://www.bucketplace.com/culture/Tech/", linkPattern: "^/post/" },
  },
  { id: "kurly", name: "컬리", color: "#5F0080", blogUrl: "https://helloworld.kurly.com", feedUrl: "https://helloworld.kurly.com/rss.xml" },
  {
    id: "gangnamunni",
    name: "강남언니",
    color: "#FF5A5F",
    blogUrl: "https://blog.gangnamunni.com",
    // /feed.xml 은 2019년 글 5개에서 멈춰 있다(2026-10-08 확인) — 목록 페이지의 발행일(JSON-LD)로 최신 글을 고른다
    feedUrl: null,
    listPage: { url: "https://blog.gangnamunni.com/", linkPattern: "^/post/" },
  },
  { id: "hwahae", name: "화해", color: "#14C38E", blogUrl: "https://blog.hwahae.co.kr", feedUrl: "https://blog.hwahae.co.kr/rss.xml" },
  { id: "oliveyoung", name: "올리브영", color: "#9ACD32", blogUrl: "https://oliveyoung.tech", feedUrl: "https://oliveyoung.tech/rss.xml" },
  { id: "hyperconnect", name: "하이퍼커넥트", color: "#FF3E6C", blogUrl: "https://hyperconnect.github.io", feedUrl: "https://hyperconnect.github.io/feed.xml" },
  { id: "musinsa", name: "무신사", color: "#111111", blogUrl: "https://medium.com/musinsa-tech", feedUrl: "https://medium.com/feed/musinsa-tech", homeUrl: "https://www.musinsa.com" },
  { id: "gccompany", name: "여기어때", color: "#E2215B", blogUrl: "https://techblog.gccompany.co.kr", feedUrl: "https://techblog.gccompany.co.kr/feed", homeUrl: "https://www.yeogi.com" },
  { id: "gmarket", name: "G마켓", color: "#00A650", blogUrl: "https://dev.gmarket.com", feedUrl: "https://dev.gmarket.com/feed" },
  { id: "kakaopay", name: "카카오페이", color: "#FFCD00", blogUrl: "https://tech.kakaopay.com", feedUrl: "https://tech.kakaopay.com/rss" },
];

export function companyById(id: string): Company {
  return COMPANIES.find((c) => c.id === id) ?? { id, name: id, color: "#64748B", blogUrl: "", feedUrl: null };
}
