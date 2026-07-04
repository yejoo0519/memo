-- Supabase SQL Editor에서 그대로 실행하세요.
-- 기존 schema.sql을 이미 실행했다면, 이 파일을 실행하기 전에 아래를 먼저 실행해서 정리하세요:
--   drop policy if exists "admin insert" on sanction_records;
--   drop policy if exists "admin update" on sanction_records;
--   drop policy if exists "admin delete" on sanction_records;

create extension if not exists pgcrypto;

create table if not exists sanction_records (
  id uuid primary key default gen_random_uuid(),
  friend_code text not null,
  category text not null check (category in ('계정회수', '버그악용제재', '기타메모')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sanction_records_friend_code
  on sanction_records (friend_code);

alter table sanction_records enable row level security;

-- 누구나 조회 가능
drop policy if exists "public read" on sanction_records;
create policy "public read"
  on sanction_records for select
  using (true);

-- 관리자 코드를 저장할 테이블 (해시로만 저장, REST API로는 노출되지 않음)
create table if not exists admin_secret (
  id int primary key default 1,
  code_hash text not null,
  constraint single_row check (id = 1)
);

-- 실제 관리자 코드로 아래 'CHANGE-THIS-CODE' 부분을 바꿔서 한 번만 실행하세요.
insert into admin_secret (id, code_hash)
values (1, crypt('dv20260704', gen_salt('bf')))
on conflict (id) do update set code_hash = excluded.code_hash;

-- admin_secret은 RLS를 켜두고 아무 정책도 만들지 않아 REST로는 완전히 비공개입니다.
alter table admin_secret enable row level security;

-- 요청 헤더(x-admin-code)로 들어온 값을 해시와 비교하는 함수.
-- security definer로 admin_secret에 접근 (호출자 권한과 무관하게 동작).
create or replace function is_admin_request()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from admin_secret
    where code_hash = crypt(
      coalesce(
        (current_setting('request.headers', true)::json ->> 'x-admin-code'),
        ''
      ),
      code_hash
    )
  );
$$;

revoke all on function is_admin_request() from public;
grant execute on function is_admin_request() to anon, authenticated;

-- 헤더의 코드가 맞을 때만 등록/수정/삭제 허용
drop policy if exists "admin insert" on sanction_records;
create policy "admin insert"
  on sanction_records for insert
  to anon, authenticated
  with check (is_admin_request());

drop policy if exists "admin update" on sanction_records;
create policy "admin update"
  on sanction_records for update
  to anon, authenticated
  using (is_admin_request());

drop policy if exists "admin delete" on sanction_records;
create policy "admin delete"
  on sanction_records for delete
  to anon, authenticated
  using (is_admin_request());
