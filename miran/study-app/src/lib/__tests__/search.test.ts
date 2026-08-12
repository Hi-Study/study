jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

import { topTags } from "@/lib/tags";
import { mergeRecent } from "@/lib/recentSearches";

describe("topTags (인기 키워드 집계)", () => {
  it("빈도순 상위 N개, 동률은 사전순", () => {
    const lists = [["a", "b"], ["a", "c"], ["a", "b"], null, ["d"]];
    expect(topTags(lists, 2)).toEqual(["a", "b"]);
  });
  it("공백 태그는 무시하고, 빈 입력은 빈 배열", () => {
    expect(topTags([["  ", ""], []])).toEqual([]);
    expect(topTags([])).toEqual([]);
  });
});

describe("mergeRecent (최근 검색어)", () => {
  it("term 을 맨 앞에 두고 중복 제거", () => {
    expect(mergeRecent(["b", "a"], "a")).toEqual(["a", "b"]);
  });
  it("최대 개수를 넘지 않는다", () => {
    expect(mergeRecent(["1", "2", "3"], "4", 3)).toEqual(["4", "1", "2"]);
  });
  it("공백/빈 term 은 무시하고 원본 유지", () => {
    expect(mergeRecent(["a"], "   ")).toEqual(["a"]);
  });
});
