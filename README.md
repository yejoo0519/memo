# 친구코드 기록부

친구코드를 조회하면 등록된 이력(계정회수 / 버그악용제재 / 기타메모)을 볼 수 있고,
관리자 코드를 아는 사람만 새 기록을 추가할 수 있는 정적 사이트입니다.

## 구조
- `index.html` — 페이지 뼈대
- `style.css` — 디자인 (인덱스카드 + 도장 컨셉)
- `app.js` — Supabase 연동 로직 (조회 / 관리자 코드 확인 / 등록)
- `schema.sql` — Supabase에 만들 테이블 + 보안 정책 + 관리자 코드 검증 함수

## 어떻게 안전한가
관리자 코드는 브라우저 JS 안에 있지 않고, 서버(Supabase)의 `admin_secret` 테이블에 **해시로만** 저장됩니다.
사용자가 코드를 입력하면 매 요청마다 `x-admin-code` 헤더로 실려가고, Postgres 함수 `is_admin_request()`가
그 값을 해시와 비교해서 맞을 때만 등록/수정/삭제를 허용합니다 (RLS 정책). 코드가 틀리면 실제로 DB에 쓰기 자체가 막힙니다.
(단, 로그인 계정 시스템처럼 사용자별 구분은 없고 "코드를 아는 사람 = 관리자" 방식입니다. 코드가 유출되면 새 코드로 교체하세요.)

## 1. Supabase 프로젝트 준비
1. https://supabase.com 에서 새 프로젝트 생성 (기존 dogam 프로젝트를 같이 써도 되고, 새로 만들어도 됩니다)
2. 좌측 메뉴 `SQL Editor` → `schema.sql` 열어서 **`CHANGE-THIS-CODE` 부분을 실제 원하는 관리자 코드로 수정**한 뒤 실행
3. 좌측 메뉴 `Project Settings → API`에서 `Project URL`과 `anon public` 키를 복사

## 2. 코드에 키 입력
`app.js` 맨 위 두 줄을 본인 값으로 교체:

```js
const SUPABASE_URL = "https://YOUR-PROJECT-ref.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
```

anon key는 공개되어도 괜찮은 키입니다 (실제 쓰기 권한은 RLS + 관리자 코드가 통제합니다).

## 3. 배포 (GitHub Pages 기준)
1. 새 저장소 생성 후 이 폴더의 파일들을 그대로 push
2. 저장소 `Settings → Pages`에서 브랜치를 `main`, 폴더를 `/ (root)`로 설정
3. 몇 분 후 `https://아이디.github.io/저장소이름` 에서 접속 가능

## 4. 사용 방법
- 아무나 친구코드를 입력하면 등록된 이력이 있는지 조회할 수 있습니다.
- 이력이 없으면 초록색 "이상 없음" 도장, 있으면 빨간색 "제재 이력 있음" 도장이 표시됩니다.
- 우측 상단 `관리자` 버튼을 누르고 관리자 코드를 입력하면, 조회 중인 코드에 메모(분류 + 내용)를 등록할 수 있습니다.
- 코드는 세션에만 저장되며(브라우저 탭 닫으면 사라짐), 매 등록 요청마다 서버에서 다시 검증됩니다.

## 관리자 코드를 바꾸고 싶을 때
Supabase SQL Editor에서 아래를 새 코드로 실행하면 됩니다:

```sql
insert into admin_secret (id, code_hash)
values (1, crypt('새로운코드', gen_salt('bf')))
on conflict (id) do update set code_hash = excluded.code_hash;
```

## 나중에 더 추가하고 싶다면
- 최근 등록된 기록 전체 목록 페이지
- 메모 수정/삭제 버튼 (현재는 등록만 구현됨)
- 친구코드 형식 검증 (자릿수 등 게임에 맞게)
