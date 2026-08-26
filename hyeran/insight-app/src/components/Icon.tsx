const PATHS: Record<string, string> = {
  bell: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
  home: '<path d="M3 10l9-7 9 7"/><path d="M5 9v11h14V9"/>',
  feed: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  insight: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0012 2z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  bookmark: '<path d="M6 3h12a1 1 0 011 1v17l-7-4.2L5 21V4a1 1 0 011-1z"/>',
  comment: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
  review: '<path d="M5 4a1 1 0 011-1h12v18H6a1 1 0 01-1-1z"/><path d="M9 7.5h6M9 11h6"/>',
  ext: '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/>',
  star: '<path d="M12 2l3 6.5 7 .8-5 4.6 1.4 6.9L12 17l-6.4 3.8L7 13.9 2 9.3l7-.8z"/>',
  sparkle: '<path d="M12 3l1.8 4.9L18.7 9l-4.9 1.8L12 15l-1.8-4.9L5.3 9l4.9-1.8z"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6"/>',
  memo: '<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12.5h5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  dots: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  heart: '<path d="M12 20s-6.5-4.2-9-8C1.3 9.3 2.6 5.8 6 5.8c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3.4 0 4.7 3.5 3 6.2-2.5 3.8-9 8-9 8z"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 5v14"/>',
};

export default function Icon({ name, size = "" }: { name: string; size?: "sm" | "lg" | "" }) {
  return (
    <svg className={`i ${size}`} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: PATHS[name] ?? "" }} />
  );
}
