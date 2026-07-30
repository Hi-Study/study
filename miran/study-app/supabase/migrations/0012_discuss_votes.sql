-- ============================================================
-- 0012 · "토론해요" 투표 + 주간 최다 글 자동 승격(토론 복사)
--   · discuss_votes : 공유 글에 "토론해요" 투표(유저당 1표)
--   · shares.promoted_discussion_id : 승격되어 만들어진 토론 id(중복 승격 방지)
--   · promote_top_shares() : 지난 주 최다 득표 글(동률이면 전부)을 토론으로 복사
--     → generate_scheduled_notifications() 안에서 매일 호출(멱등)
-- ============================================================

create table if not exists public.discuss_votes (
  user_id uuid not null references public.users(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  share_id uuid not null references public.shares(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, share_id)
);
create index if not exists idx_discuss_votes_share on public.discuss_votes(share_id);

alter table public.shares add column if not exists promoted_discussion_id uuid;

-- RLS: 멤버 조회, 본인 투표 insert/delete
alter table public.discuss_votes enable row level security;

drop policy if exists dv_select_member on public.discuss_votes;
create policy dv_select_member on public.discuss_votes
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists dv_insert_own on public.discuss_votes;
create policy dv_insert_own on public.discuss_votes
  for insert to authenticated
  with check (public.is_study_member(study_id) and user_id = auth.uid());

drop policy if exists dv_delete_own on public.discuss_votes;
create policy dv_delete_own on public.discuss_votes
  for delete to authenticated using (user_id = auth.uid());

-- 지난 주(월~일) 최다 "토론해요" 득표 공유 글을 토론으로 복사.
-- 동률이면 전부 복사. 이미 승격된 글(promoted_discussion_id)은 건너뜀(멱등).
create or replace function public.promote_top_shares()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_end   date := date_trunc('week', now())::date - 1;      -- 지난 일요일
  v_start date := date_trunc('week', now())::date - 7;       -- 지난 월요일
  v_label text := (extract(month from v_start))::int || '월 '
                  || (ceil(extract(day from v_start)::numeric / 7))::int || '째 주';
  r record;
  v_disc uuid;
begin
  for r in
    with wv as (
      select s.*, count(dv.user_id) as votes
      from public.shares s
      left join public.discuss_votes dv on dv.share_id = s.id
      where s.shared_date between v_start and v_end
        and s.promoted_discussion_id is null
      group by s.id
    ),
    mx as (
      select study_id, max(votes) as v from wv where votes > 0 group by study_id
    )
    select wv.* from wv join mx on mx.study_id = wv.study_id and wv.votes = mx.v
  loop
    insert into public.discussions
      (study_id, author_id, week_label, week_start, title, prompt, body, kind,
       url, source, og_image, og_description, article_text, tags)
    values
      (r.study_id, r.author_id, v_label, v_start, r.title,
       '이번 주 「토론해요」가 가장 많았던 공유 글이에요. 함께 이야기해요!',
       coalesce(nullif(r.note, ''), r.body),
       case when r.url is not null then 'link' else 'text' end,
       r.url, r.source, r.og_image, r.og_description, r.article_text, coalesce(r.tags, '{}'))
    returning id into v_disc;

    update public.shares set promoted_discussion_id = v_disc where id = r.id;
  end loop;
end;
$$;

grant execute on function public.promote_top_shares() to authenticated;
