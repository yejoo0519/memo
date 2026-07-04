/* ====== 여기 두 값만 본인 Supabase 프로젝트 값으로 바꾸면 됩니다 ====== */
const SUPABASE_URL = "https://YOUR-PROJECT-ref.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
/* ================================================================== */

const ADMIN_CODE_KEY = "friendcode_admin_code"; // 브라우저 세션에만 저장, 새로고침 시 유지

if (!window.supabase) {
  document.body.innerHTML =
    '<p style="padding:40px;font-family:sans-serif;color:#E8E4D9;background:#12161F;">' +
    "Supabase 라이브러리를 불러오지 못했습니다. 인터넷 연결이나 광고 차단기 설정을 확인한 뒤 새로고침 해주세요. " +
    "(개발자 도구 Console에 자세한 에러가 표시됩니다.)</p>";
  throw new Error("supabase-js failed to load: window.supabase is undefined");
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const codeInput = document.getElementById("codeInput");
const searchBtn = document.getElementById("searchBtn");
const searchHint = document.getElementById("searchHint");

const resultArea = document.getElementById("resultArea");
const cardCode = document.getElementById("cardCode");
const cardTab = document.getElementById("cardTab");
const stampSlot = document.getElementById("stampSlot");
const recordList = document.getElementById("recordList");
const emptyState = document.getElementById("emptyState");

const adminToggle = document.getElementById("adminToggle");
const adminPanel = document.getElementById("adminPanel");
const categorySelect = document.getElementById("categorySelect");
const contentInput = document.getElementById("contentInput");
const addBtn = document.getElementById("addBtn");
const addStatus = document.getElementById("addStatus");

const loginOverlay = document.getElementById("loginOverlay");
const codeSecretInput = document.getElementById("codeSecretInput");
const loginSubmit = document.getElementById("loginSubmit");
const loginCancel = document.getElementById("loginCancel");
const loginStatus = document.getElementById("loginStatus");

let currentCode = null;
let isAdmin = false;
let adminClient = null; // 관리자 코드가 헤더로 실리는 전용 클라이언트

/* ---------- 관리자 클라이언트 생성 ---------- */
function buildAdminClient(code) {
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { "x-admin-code": code } },
  });
}

/* 저장된 코드가 실제로 유효한지 서버에 확인 (is_admin_request RPC) */
async function verifyAndSetAdmin(code) {
  const client = buildAdminClient(code);
  const { data, error } = await client.rpc("is_admin_request");
  if (error || !data) {
    return false;
  }
  adminClient = client;
  isAdmin = true;
  sessionStorage.setItem(ADMIN_CODE_KEY, code);
  return true;
}

function clearAdmin() {
  isAdmin = false;
  adminClient = null;
  sessionStorage.removeItem(ADMIN_CODE_KEY);
}

function updateAdminUI() {
  adminToggle.textContent = isAdmin ? "로그아웃" : "관리자";
  adminPanel.hidden = !(isAdmin && currentCode);
}

/* ---------- 조회 ---------- */
async function searchCode() {
  const code = codeInput.value.trim();
  if (!code) {
    searchHint.textContent = "친구코드를 입력해주세요.";
    searchHint.className = "hint error";
    return;
  }

  searchHint.textContent = "조회 중...";
  searchHint.className = "hint";

  const { data, error } = await supabase
    .from("sanction_records")
    .select("*")
    .eq("friend_code", code)
    .order("created_at", { ascending: false });

  if (error) {
    searchHint.textContent = "조회 중 오류가 발생했습니다: " + error.message;
    searchHint.className = "hint error";
    return;
  }

  currentCode = code;
  searchHint.textContent = "";
  renderCard(code, data || []);
  updateAdminUI();
}

function renderCard(code, records) {
  resultArea.hidden = false;
  cardCode.textContent = code;
  cardTab.textContent = "CASE FILE";
  recordList.innerHTML = "";
  stampSlot.innerHTML = "";

  if (records.length === 0) {
    emptyState.hidden = false;
    stampSlot.innerHTML = `<div class="stamp green">이상 없음</div>`;
    return;
  }

  emptyState.hidden = true;
  stampSlot.innerHTML = `<div class="stamp red">제재 이력 있음</div>`;

  for (const r of records) {
    const li = document.createElement("li");
    li.className = "record-item cat-" + r.category;
    const date = new Date(r.created_at).toLocaleString("ko-KR");
    li.innerHTML = `
      <div class="record-top">
        <span class="record-cat">${r.category}</span>
        <span>${date}</span>
      </div>
      <div class="record-body"></div>
    `;
    li.querySelector(".record-body").textContent = r.content;
    recordList.appendChild(li);
  }
}

/* ---------- 메모 등록 ---------- */
async function addRecord() {
  if (!currentCode || !adminClient) return;
  const category = categorySelect.value;
  const content = contentInput.value.trim();

  if (!content) {
    addStatus.textContent = "내용을 입력해주세요.";
    addStatus.className = "hint error";
    return;
  }

  addStatus.textContent = "등록 중...";
  addStatus.className = "hint";

  const { error } = await adminClient.from("sanction_records").insert({
    friend_code: currentCode,
    category,
    content,
  });

  if (error) {
    addStatus.textContent = "등록 실패 (코드가 만료됐을 수 있어요): " + error.message;
    addStatus.className = "hint error";
    return;
  }

  contentInput.value = "";
  addStatus.textContent = "등록되었습니다.";
  addStatus.className = "hint ok";
  searchCode(); // 최신 목록 새로고침
}

/* ---------- 로그인 / 로그아웃 ---------- */
function openLogin() {
  loginStatus.textContent = "";
  codeSecretInput.value = "";
  loginOverlay.hidden = false;
}

function closeLogin() {
  loginOverlay.hidden = true;
}

async function submitLogin() {
  const code = codeSecretInput.value;
  if (!code) {
    loginStatus.textContent = "코드를 입력해주세요.";
    loginStatus.className = "hint error";
    return;
  }

  loginStatus.textContent = "확인 중...";
  loginStatus.className = "hint";

  const ok = await verifyAndSetAdmin(code);
  if (!ok) {
    loginStatus.textContent = "코드가 올바르지 않습니다.";
    loginStatus.className = "hint error";
    return;
  }

  closeLogin();
  updateAdminUI();
}

function logout() {
  clearAdmin();
  updateAdminUI();
}

/* ---------- 이벤트 바인딩 ---------- */
searchBtn.addEventListener("click", searchCode);
codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchCode();
});

addBtn.addEventListener("click", addRecord);

adminToggle.addEventListener("click", () => {
  if (isAdmin) {
    logout();
  } else {
    openLogin();
  }
});
loginCancel.addEventListener("click", closeLogin);
loginSubmit.addEventListener("click", submitLogin);
codeSecretInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitLogin();
});

/* ---------- 초기화: 세션에 저장된 코드가 있으면 재검증 ---------- */
(async function init() {
  const savedCode = sessionStorage.getItem(ADMIN_CODE_KEY);
  if (savedCode) {
    await verifyAndSetAdmin(savedCode);
  }
  updateAdminUI();
})();
