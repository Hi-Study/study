-- 010: 즐겨찾기 기업 새 글 알림  [v3.0]
-- 글이 추가되면 그 기업을 즐겨찾기한 유저에게 new_post 알림을 자동 생성한다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.

create or replace function public.notify_favorites_new_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.company_id is not null then
    insert into public.notifications (user_id, type, title, body, post_id)
    select f.user_id, 'new_post', c.name || '에 새 글이 올라왔어요', new.title, new.id
    from public.favorites f
    join public.companies c on c.id = new.company_id
    where f.company_id = new.company_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_favorites_new_post on public.posts;
create trigger trg_notify_favorites_new_post
  after insert on public.posts
  for each row execute function public.notify_favorites_new_post();

-- (선택) 이미 수집된 글에 대해, 즐겨찾기 기업별 최근 3개를 알림으로 백필 (한 번만)
insert into public.notifications (user_id, type, title, body, post_id, created_at)
select x.user_id, 'new_post', x.cname || '에 새 글이 올라왔어요', x.title, x.id, x.published_at
from (
  select f.user_id, p.id, p.title, p.published_at, c.name as cname,
         row_number() over (partition by f.user_id, p.company_id order by p.published_at desc) as rn
  from public.favorites f
  join public.posts p     on p.company_id = f.company_id
  join public.companies c on c.id = p.company_id
) x
where x.rn <= 3
  and not exists (
    select 1 from public.notifications n
    where n.user_id = x.user_id and n.post_id = x.id and n.type = 'new_post'
  );
