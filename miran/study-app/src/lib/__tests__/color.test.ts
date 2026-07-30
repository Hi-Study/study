import { nameHashColor, initial } from "../color";

describe("nameHashColor", () => {
  it("같은 이름은 항상 같은 색을 반환한다(결정적)", () => {
    expect(nameHashColor("김기획")).toBe(nameHashColor("김기획"));
  });

  it("hsl(h,34%,44%) 형식이며 h 는 0~359 범위", () => {
    const m = nameHashColor("박리서치").match(/^hsl\((\d+), 34%, 44%\)$/);
    expect(m).not.toBeNull();
    const h = Number(m![1]);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });

  it("다른 이름은(대개) 다른 색", () => {
    expect(nameHashColor("김기획")).not.toBe(nameHashColor("이지표"));
  });
});

describe("initial", () => {
  it("이름 첫 글자를 반환", () => {
    expect(initial("김기획")).toBe("김");
  });
  it("공백을 다듬는다", () => {
    expect(initial("  홍길동")).toBe("홍");
  });
  it("비었으면 '?'", () => {
    expect(initial("")).toBe("?");
    expect(initial(null)).toBe("?");
    expect(initial(undefined)).toBe("?");
  });
});
