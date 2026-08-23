-- RSS 자동 수집(PRD v0.2 4.11) — 자동 수집 글은 등록자가 없어 독후감을 나중에 채운다.

alter table public.articles alter column impressive_part drop not null;
alter table public.articles alter column apply_idea drop not null;
alter table public.articles alter column discussion_question drop not null;

alter table public.articles add column source_type text not null default 'manual'
  check (source_type in ('manual', 'auto'));
alter table public.articles add column note_author uuid references auth.users(id);

-- 기존 글은 모두 수동 등록 + 등록자가 곧 노트 작성자였다.
update public.articles set note_author = created_by where note_author is null;
