import { getCompanyBrand } from "@/lib/companies/brand";
import { cn } from "@/lib/utils";

// 기술 블로그 자체 썸네일이 있으면 그대로 쓰고, 없으면 브랜드 컬러 배경 위에 로고를 얹는다.
export function ArticleThumbnail({
  thumbnailUrl,
  company,
  className,
}: {
  thumbnailUrl: string | null;
  company: string;
  className?: string;
}) {
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumbnailUrl} alt="" className={cn("h-full w-full object-cover", className)} />
    );
  }

  const brand = getCompanyBrand(company);
  return (
    <div
      className={cn("flex h-full w-full items-center justify-center", className)}
      style={{ backgroundColor: brand.color }}
    >
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt={company} className="h-1/2 w-1/2 object-contain" />
      ) : (
        <span className="text-lg font-bold text-white">{company.slice(0, 1)}</span>
      )}
    </div>
  );
}
