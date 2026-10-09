# SYSTEM DETAIL — LUCKY HUB 2026

> Tài liệu theo dõi cấu trúc dự án + bản đồ hệ thống A.I hiện tại + danh sách điểm bất hợp lý, chuẩn bị cho việc **tái cấu trúc hệ thống A.I**.
> Ngày khảo sát: **2026-09-19** · Repo: `~/DATA/projects/lucky-hub-2026`
> Nguồn: quét trực tiếp file hệ thống (không chép từ tài liệu cũ). Mọi kết luận "bất hợp lý" đều kèm **bằng chứng file:line**.

---

## MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Cấu trúc thư mục đầy đủ](#2-cấu-trúc-thư-mục-đầy-đủ)
3. [Kiến trúc runtime & luồng khởi động](#3-kiến-trúc-runtime--luồng-khởi-động)
4. [Bản đồ hệ thống A.I hiện tại](#4-bản-đồ-hệ-thống-ai-hiện-tại)
5. [Hợp đồng API của gateway đích (đã test thực tế)](#5-hợp-đồng-api-của-gateway-đích-đã-test-thực-tế)
6. [Điểm bất hợp lý trong hệ thống A.I](#6-điểm-bất-hợp-lý-trong-hệ-thống-ai)
7. [Phương án tái cấu trúc hệ thống A.I](#7-phương-án-tái-cấu-trúc-hệ-thống-ai)
8. [Checklist hành động](#8-checklist-hành-động)
9. [Phụ lục: bằng chứng & lệnh kiểm chứng](#9-phụ-lục-bằng-chứng--lệnh-kiểm-chứng)

---

## 1. TỔNG QUAN DỰ ÁN

| Hạng mục | Giá trị |
|---|---|
| Tên | `lucky-hub-2026` — Lucky Hub Health Management Platform |
| Nền tảng | Full-stack 1 repo: **React 19 (esm.sh importmap, không bundler)** + **Express + MongoDB (Mongoose)** |
| Frontend entry | `index.html` → `index.tsx` → `App.tsx` |
| Backend entry (thật) | `server/index.ts` (271 dòng) — chạy qua `run.js` (`npx tsx server/index.ts`) |
| Backend legacy | `server.ts` (2.363 dòng) — **không còn được import ở đâu** (dead code, xem §6.14) |
| Node engine | `>=20.0.0` (môi trường hiện tại: v22.23.2) |
| Scripts | `start` = `node run.js` · `dev` = `tsx watch server/index.ts` · `build` = *no-op* · `lint` = `tsc --noEmit` |
| DB | MongoDB Atlas (`MONGODB_URI`) + fallback local `mongodb://127.0.0.1:27017/lucky_hub` |
| Deploy | GitHub Actions → force-push sang Hugging Face Spaces (Docker) · phụ: Render |
| Tổng mã nguồn | **~29.381 dòng** TS/TSX (không tính `node_modules`) |
| Tổng file (không tính node_modules/.git) | **198 file** |
| Git remote | `https://github.com/zzvenuszz/lucky-hub-2026.git` (branch `main`, commit mới nhất `6c4e22a`) |
| Trạng thái git khi khảo sát | ` D .clinerules` (file rules cũ bị xoá, thư mục `.clinerules/01-web-dev-vn.md` chưa add) |

### Phân bổ mã nguồn theo khu vực

| Khu vực | Số dòng | Ghi chú |
|---|---|---|
| `components/**` | 15.237 | React components (chia theo feature) |
| `server/**` + `server.ts` | 8.041 | Express: routes/models/services/websocket |
| `services/**` (root) | 1.476 | db client, gemini client, email, ws, validation |
| `magic_mirror_module/**` | 915 | Module MagicMirror (JS + Python face-recognition) |
| `utils/**` (root) | 524 | cache, formatter, performance, permissions |
| `src/**` | 249 | logger, tts, config, migration, crypto |

---

## 2. CẤU TRÚC THƯ MỤC ĐẦY ĐỦ

Ký hiệu: `(n)` = số dòng. ⚠️ = dấu hiệu cần xử lý. (Không liệt kê chi tiết favicon/img.)

```
lucky-hub-2026/
├── .clinerules/01-web-dev-vn.md          (107)  # workspace rules (xem §6.0)
├── .env                                          # secrets (Gemini keys, Mongo, mail, imgbb)
├── .github/workflows/deploy.yml                  # CI: force-push sang Hugging Face Spaces
├── AGENTS.md                             (303)  # rule cross-tool
├── App.tsx                               (642)  # root React component
├── App.tsx.bak                           (465)  # ⚠️ backup lẫn trong repo
├── Dockerfile                            (19)   # node:20-alpine, PORT=7860 (HF)
├── index.html                            (188)  # importmap esm.sh + tailwind CDN
├── index.tsx                             (55)   # React root + window.debugLog bridge
├── run.js                                (26)   # spawn `npx tsx server/index.ts`
├── server.ts                             (2363) # ⚠️ DEAD CODE (không nơi nào import)
├── tsconfig.json                         (21)   # strict:false, moduleResolution:Bundler
├── vite.config.ts                        (23)   # ⚠️ vite không có trong devDependencies
│
├── components/
│   ├── AdminPanel.tsx                    (109)  # ⚠️ trùng components/admin/AdminPanel.tsx
│   ├── Layout.tsx                        (142)  # ⚠️ trùng components/system/Layout.tsx
│   ├── MetricsManagement.tsx             (145)  # ⚠️ trùng components/dashboard/MetricsManagement.tsx
│   ├── Profile.tsx                       (160)  # ⚠️ trùng components/profile/Profile.tsx
│   ├── admin/
│   │   ├── AdminPanel.tsx                (147)  # panel đang dùng (App.tsx import)
│   │   ├── AITraining.tsx                (27)   # gom Knowledge/Rule/TestLab
│   │   ├── AuditLogs.tsx (24) · MetricAdmin.tsx (262) + .bak ⚠️ · SystemDiagnostics.tsx (162)
│   │   ├── UserManagement.tsx (486) + .bak ⚠️
│   │   ├── ai/
│   │   │   ├── AIConfigPanel.tsx         (408)  # chọn provider gemini|cline
│   │   │   ├── AITestLab.tsx (61) · KnowledgeManager.tsx (58) · RuleManager.tsx (57)
│   │   │   └── GeminiKeyManager.tsx      (302)  # CRUD key gemini|cline trong DB
│   │   ├── audit/{LogFilters,LogTable}.tsx (29/124)
│   │   ├── groups/GroupManager.tsx (428) + .bak ⚠️
│   │   └── nutrition/{BranchManager(354)+.bak, ChatGroupManager(215), NutritionGroupManager(383)}
│   ├── auth/{AuthContainer,AvatarUpload,EmailVerification,ForgotPasswordForm,Login,Register,RegistrationSuccess,ResetPasswordForm}.tsx
│   ├── chat/
│   │   ├── ChatProvider.tsx              (727)  # ⚠️ file lớn nhất FE, gọi AI coach
│   │   ├── index.tsx
│   │   └── components/{ChatToggle,ChatWindow,ContactList,MessageBubble,MessageInput}.tsx
│   ├── dashboard/{BodyCompositionPie,Dashboard,MetricForm(505),MetricsManagement(689),StatCards,TrendChart}.tsx
│   ├── goals/GoalTracking.tsx (467) · ndd/{NDDDashboard(535),MemberMetricsManager(305)}.tsx
│   ├── newsfeed/{CommentForm,CommentItem,CommentSection,NewsFeed,PostCreator,PostDetail,PostEditor,PostItem}.tsx
│   ├── notification/{NotificationBell,NotificationPanel}.tsx
│   ├── profile/{AvatarEditor,Profile,ProfileForm}.tsx
│   └── system/{BadgeCongratulation,BadgeDisplay,ErrorBoundary,Layout,LoadingButton,ModalManager,SystemLog,ToastProvider}.tsx
│
├── server/
│   ├── index.ts                          (271)  # ENTRY POINT thật
│   ├── config/permissions.ts             (97)   # RESOURCES.* — quyền AI: ai:manage / ai:view
│   ├── middleware/{authMiddleware(160),requirePermission(67)}.ts
│   ├── models/                           # 18 schema Mongoose
│   │   ├── AIConfig.ts                   (59)   # key/value: active_provider = gemini|cline
│   │   ├── GeminiKey.ts                  (15)   # keyType enum ['gemini','cline'] + healthStatus + cooldownUntil
│   │   ├── Knowledge.ts (22) · Rule.ts (6) · User.ts (28) · Metric.ts (16) · Goal.ts (18)
│   │   ├── Chat.ts (42) · ChatGroup.ts (26) · Group.ts (19) · Post.ts (44)
│   │   ├── Notification.ts (15) · AuditLog.ts (12) · ActiveSession.ts (11) · LoginAttempt.ts (9)
│   │   ── NutritionBranch.ts (25) · NutritionGroup.ts (17) · PasswordResetToken.ts (10)
│   ├── routes/                           # 16 router
│   │   ├── ai.routes.ts                  (283)  # /verify-avatar /extract /bulk-extract /analyze-food /suggest-meal /coach
│   │   ├── admin.routes.ts               (255)  # /env-keys /gemini-keys /ai-config /ai/test-vision
│   │   ├── mirror.routes.ts              # /MM/* yêu cầu Magic Mirror token
│   │   ├── nutritionGroup.routes.ts      (581)  # ⚠️ lớn nhất, trộn nhiều trách nhiệm
│   │   ├── auth.routes.ts (461) · post.routes.ts (466) · metric.routes.ts (321) · user.routes.ts (288)
│   │   ├── nutritionBranch.routes.ts (213) · group.routes.ts (204) · goal.routes.ts (185)
│   │   └── chat.routes.ts (126) · chatGroup.routes.ts (124) · notification.routes.ts (66)
│   │       · rule.routes.ts (44) · knowledge.routes.ts (32)
│   ├── services/
│   │   ├── aiService.ts                  (743)  # ⭐ AI ROUTER trung tâm
│   │   ├── aiService.ts.bak              (344)  # ⚠️ bản cũ còn trong repo
│   │   ├── clineService.ts               (313)  # ️ gọi Cline gateway (hard-code URL)
│   │   ├── foodAnalysisService.ts        (626)  # phân tích ảnh món ăn + gợi ý thực đơn
│   │   ├── userContextService.ts (356) · knowledgeService.ts (214) · chatPermissionService.ts (223)
│   │   └── permissionService.ts (60) + .bak ⚠️
│   ├── utils/imageUtils.ts               (20)
│   ── websocket/chatSocket.ts           (366)
│
├── services/                             # ⚠️ TRÙNG TÊN với server/services (khác vai trò)
│   ├── database.ts                       (214)  # FE API client (API_BASE='/api')
│   ├── gemini.ts                         (189)  # ⚠️ tên sai: thực chất gọi /api/ai/*
│   ├── emailService.ts (537) · wsService.ts (276) · validationService.ts (241)
│   ── logger.ts                         (19)   # ️ logger thứ 2 (khác src/utils/logger.ts)
│
├── src/
│   ├── services/
│   │   ├── ttsService.ts                 (104)  # Google TTS qua Gemini, hard-code danh sách model
│   │   ├── migrationService.ts (36) · configService.ts  # cấu hình không bí mật cho Magic Mirror
│   │   ├── magicMirrorToken.routes.ts · MagicMirrorToken.ts # quản lý token Magic Mirror trong admin
│   └── utils/{logger.ts (21), audioUtils.ts (42), cryptoUtils.ts (17), puter.v2.js}
│
├── utils/{cacheManager.ts(120), performanceMonitor.ts(311), imageUtils.ts(37), formatters.ts(37), permissions.ts(19)}
├── scripts/{fix-admin-permissions.js(72), fix-admin-group.js(76)}
├── magic_mirror_module/
│   ├── MMM-LuckyHub/{MMM-LuckyHub.js(320), MMM-LuckyHub.css(176)}
│   └── MMM-LuckyHub-FaceSync/{node_helper.js(386), recognize.py(119), tts_helper.js(46), MMM-LuckyHub-FaceSync.js(40)}
├── favicon/ (28 file) · img/weighing-64.png
└── migrated_prompt_history/prompt_2026-02-14T04:16:37.214Z.json   # ⚠️ 24MB, ĐANG được git track
```

---

## 3. KIẾN TRÚC RUNTIME & LUỒNG KHỞI ĐỘNG

### 3.1 Frontend — KHÔNG có bundler

`index.html` nạp `react`, `react-dom`, `recharts`, `@google/genai`, `react-easy-crop`... **trực tiếp từ `esm.sh`** qua `<script type="importmap">` (index.html:162-183). Không có bước build.

- `server/index.ts` tự transpile `.ts/.tsx` **on-the-fly bằng Sucrase** khi được request (server/index.ts:159-176) → mỗi lần load trang là một lần transpile.
- Điều này giải thích `npm run build` = `echo 'No build step needed'` (package.json) và `vite.config.ts` tồn tại nhưng **vite không có trong devDependencies**.

### 3.2 Backend — luồng khởi động (`server/index.ts`)

```
run.js  →  npx tsx server/index.ts
   ├─ dotenv.config()                              (line 45)
   ├─ express + http + WebSocketServer             (line 47-50)
   ├─ Middleware: cors(*), json 50mb               (line 55-56)
   ├─ Rate limit: global 500/15m, auth 10/15m, AI 30/1m, write 20/1m  (line 59-101)
   ├─ Mount routers                                (line 120-147)
   │     /api → authRoutes        /api/users /api/metrics /api/posts /api/chats
   │     /api/goals /api/notifications /api/admin /api/knowledge /api/rules
   │     /api/admin/groups /api/ai /api/nutrition-groups /api/nutrition-branches
   │     /api/chat-groups        /MM → mirrorRoutes (KHÔNG auth)
   ├─ /api/health, /api/audit-logs (legacy, KHÔNG auth — xem §6.15)
   ├─ Static + transpile-on-request + SPA fallback  (line 158-177)
   ├─ initDB() → MongoDB (fallback local)          (line 194-219)
   ├─ initEmailService() → Brevo/SendGrid          (line 221-229)
   ├─ initChatWebSocket(wss)                       (line 234)
   └─ server.listen(PORT=3000) → in banner "CLINE SERVICE" + discoverAvailableModels() (line 236-265)
```

### 3.3 Các nguồn cấu hình hiện tại

| Biến | Nơi đọc | Ghi chú |
|---|---|---|
| `API_KEY`, `API_KEY_2`, `API_KEY_3`, `GEMINI_API_KEY` | `aiService.ts:7-12`, `server.ts:533+` | 4 biến cho cùng 1 mục đích = 3 key Gemini + 1 alias |
| `GEMINI_PROXY_URL` | `aiService.ts:15`, `quickKeyHealthCheck`, `callAIWithRetry` | proxy tuỳ chọn cho Gemini |
| `MONGODB_URI` | `server/index.ts:192` | |
| `PORT` | `server/index.ts:191` (mặc định 3000) | Docker ép `PORT=7860` |
| `IMGBB_API_KEY` | `server/utils/imageUtils.ts` | upload ảnh |
| `BREVO_API_KEY`, `SENDGRID_API_KEY`, `EMAIL_FROM*` | `services/emailService.ts` | |
| `FRONTEND_URL` | email links | |
| **`AI_GATEWAY_URL` / `AI_API_KEY` / `AI_MODEL`** | **chưa tồn tại** |  sẽ phải thêm khi tái cấu trúc |

> `.env` hiện KHÔNG có `GEMINI_PROXY_URL`, không có biến nào trỏ tới gateway `mc.luckyhub.io.vn:20128`.

---

## 4. BẢN ĐỒ HỆ THỐNG A.I HIỆN TẠI

### 4.1 Sơ đồ luồng (as-is)

```
FRONTEND                                       BACKEND                                   UPSTREAM
────────────────────────────────────────────   ───────────────────────────────────────   ─────────────────────────
services/gemini.ts ─ /api/ai/extract ─────┐
services/gemini.ts ─ /api/ai/coach ───────┤    server/routes/ai.routes.ts (283 dòng)
AvatarUpload.tsx  ─ verify-avatar ────────┤     │
MetricForm.tsx    ─ bulk-extract ─────────┤     ├─ callAI(taskType, payload)   ⭐ AI ROUTER
(+2 endpoint CHƯA có UI: analyze-food,     │     │      server/services/aiService.ts (743 dòng)
 suggest-meal)                             │     │       │
                                           │     │       ├─ provider = DB AIConfig.active_provider (cache 60s)
src/services/ttsService.ts ─ /MM/tts/greeting──┐ │       │   ├─ "cline"  → clineService.ts
                                           │   │       │   │      ├─ POST https://api.cline.bot/api/v1/chat/completions
admin UI (AIConfigPanel/GeminiKeyManager)  │   │       │   │      │   (URL HARD-CODE ở clineService.ts:9)
 ─ /api/admin/ai-config, /gemini-keys ─────┘   │       │   │      ├─ model text:   deepseek/deepseek-chat
                                               │       │   │      └─ model vision: google/gemini-2.5-flash
                                               │       │   └─ "gemini" → callAIWithRetry()
                                               │       │          ├─ GoogleGenAI (@google/genai) hoặc
                                               │       │          ├─ GEMINI_PROXY_URL + /v1beta/models/{m}
                                               │       │          └─ key: ENV_API_KEYS + GeminiKey(keyType=gemini)
                                               └───────┘
                                                       └─ fallback: hết Cline key → luôn rơi về Gemini (aiService.ts:262, 349)
```

### 4.2 Các thành phần A.I (file → trách nhiệm)

| File | Dòng | Trách nhiệm |
|---|---|---|
| `server/services/aiService.ts` | 743 | **Router trung tâm**: `getActiveProvider`, `callAI`, `callAIWithRetry`, `selectModelForTask`, `discoverAvailableModels`, health-check, cooldown key |
| `server/services/clineService.ts` | 313 | Gọi gateway Cline: `testClineKey`, `callCline`, `callClineVision`, `CLINE_VISION_MODELS`; **hard-code** `CLINE_API_URL` |
| `server/services/foodAnalysisService.ts` | 626 | Prompt phân tích ảnh món ăn + gợi ý thực đơn, dùng `callAI(..., 'food' \| 'meal-plan')` |
| `server/services/userContextService.ts` | 356 | Build system prompt context dinh dưỡng người dùng |
| `server/services/knowledgeService.ts` | 214 | Tìm knowledge theo keyword/category, dựng context |
| `server/routes/ai.routes.ts` | 283 | 6 endpoint AI: verify-avatar, extract, bulk-extract, analyze-food, suggest-meal, coach |
| `server/routes/admin.routes.ts` | 255 | Quản trị key (`/gemini-keys`), chọn provider (`/ai-config`), test vision, `/env-keys` |
| `server/models/AIConfig.ts` | 59 | Config DB `key/value`; `CONFIG_KEYS.ACTIVE_PROVIDER`; `AI_PROVIDERS = {GEMINI,CLINE}` |
| `server/models/GeminiKey.ts` | 15 | Key: `key`, `label`, **`keyType: 'gemini'\|'cline'`**, `isActive`, `failCount`, `cooldownUntil`, `workingModels`, `healthStatus` |
| `services/gemini.ts` (FE) | 189 | `extractMetricsFromImage`, `getAICoachResponse` → gọi `/api/ai/*` |
| `components/admin/ai/AIConfigPanel.tsx` | 408 | UI chọn provider + test vision model |
| `components/admin/ai/GeminiKeyManager.tsx` | 302 | UI CRUD key (dùng chung gemini/cline) |
| `src/services/ttsService.ts` | 104 | TTS qua Gemini, danh sách model hard-code, dùng `callAIWithRetry` |
| `src/services/configService.ts` | `getMirrorConfig()` trả thiết lập TTS không bí mật |
| `server/routes/mirror.routes.ts` | `/MM/*` yêu cầu token được quản lý từ trang cài đặt admin |

### 4.3 Nhiệm vụ A.I (AITaskType) → model hiện tại

| Task | Nguồn | Model khi provider=cline | Model khi provider=gemini |
|---|---|---|---|
| `vision` (extract, bulk-extract) | ai.routes.ts:96,144 | `google/gemini-2.5-flash` (hard-code aiService.ts:298) | `MODEL_RECOMMENDATIONS.vision` |
| `verify` (verify-avatar) | ai.routes.ts:30 | `google/gemini-2.5-flash` | gemini-1.5-flash… |
| `coach` (text) | ai.routes.ts:263 | `deepseek/deepseek-chat` (clineService.ts:143) | gemini-2.0-flash… |
| `food` / `meal-plan` | foodAnalysisService.ts:164,410,604 | `deepseek/deepseek-chat` | gemini… |
| TTS (mirror) | mirror.routes.ts:73 | **không qua provider router** — luôn Gemini | gemini-1.5-flash-latest… |

### 4.4 Danh sách endpoint A.I (đầy đủ)

| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| POST | `/api/ai/verify-avatar` | ⚠️ không auth | ai.routes.ts:30 |
| POST | `/api/ai/extract` | optionalAuth | ai.routes.ts:96 |
| POST | `/api/ai/bulk-extract` | optionalAuth | ai.routes.ts:144 |
| POST | `/api/ai/analyze-food` | login (trong handler) | ai.routes.ts:200 |
| POST | `/api/ai/suggest-meal` | login | ai.routes.ts:234 |
| POST | `/api/ai/coach` | optionalAuth | ai.routes.ts:263 |
| GET | `/api/admin/env-keys` | auth + `ai:manage` | admin.routes.ts:23 |
| CRUD | `/api/admin/gemini-keys[...]` | auth + `ai:manage` | admin.routes.ts:37-84 |
| POST | `/api/admin/gemini-keys/check` | auth + `ai:manage` | admin.routes.ts:144 |
| GET/PUT | `/api/admin/ai-config` | GET: auth; PUT: `ai:manage` | admin.routes.ts:186,209 |
| POST | `/api/admin/ai/test-vision` | auth + `ai:manage` | admin.routes.ts:232 |
| GET | `/MM/config` | token Magic Mirror | chỉ trả thiết lập TTS không bí mật |

---

## 5. HỢP ĐỒNG API CỦA GATEWAY ĐÍCH (ĐÃ TEST THỰC TẾ)

Cấu hình mục tiêu: `provider = openai-compatible`, `baseUrl = http://mc.luckyhub.io.vn:20128/v1`, `model = Cline`, API key cấu hình trong `.env`.

### 5.1 Kết quả test (ngày 2026-09-19)

| Test | Kết quả |
|---|---|
| `GET http://localhost:20128/v1/models` (không key) | 200 — danh sách model có `"id":"Cline"`, `"owned_by":"combo"` |
| `GET http://mc.luckyhub.io.vn:20128/v1/models` (không key) | **401** `{"error":"API key required for remote API access"}` |
| `GET https://mc.luckyhub.io.vn:20128/v1/models` | ❌ HTTPS **không** hoạt động (HTTP=000) → chỉ dùng **http** |
| `POST .../v1/chat/completions` model=`Cline` (có key) | 200 — nhưng xem §5.2 (shape đặc biệt) |

### 5.2 Hình dạng response — 3 điểm phải xử lý trong code

**(a) Response bọc trong `{"data": {...}, "success": true}` và kèm đuôi SSE:**

```
{"data":{"choices":[{"finish_reason":"stop","index":0,
   "message":{"content":"OK","reasoning":null,"refusal":null,"role":"assistant"},
   "native_finish_reason":"STOP"}],
 "created":1789800297,"id":"gen-...","model":"google/gemma-4-26b-a4b-it:free",
 "object":"chat.completion","provider":"Google AI Studio",
 "usage":{"completion_tokens":1,"prompt_tokens":4,"total_tokens":5,"cost":0},
 "success":true}
data: [DONE]
```

- ❌ `JSON.parse(response)` → **FAIL** (`Unexpected non-whitespace character after JSON at position 815`).
- ✅ Phải strip hậu tố `data: [DONE]` trước khi parse (đã kiểm chứng: `t.replace(/\n?data: \[DONE\]\s*$/,'')` → parse OK).
- ✅ Đường dẫn text là `json.data.choices[0].message.content` — **trùng khớp** với code hiện tại trong `clineService.ts:83, 275` (đây là điểm may mắn, không cần sửa).
- ⚠️ `content_type` trả về là `text/event-stream` **ngay cả khi `stream:false`** → không nên dựa vào header để quyết định cách đọc.

**(b) Không tôn trọng chặt `stream` / `max_tokens`:**

| Request | Thực tế |
|---|---|
| `stream:false` + `max_tokens:5` | body vẫn là JSON + đuôi `data: [DONE]` |
| `stream:true` | trả đúng SSE chunks (`data: {...chat.completion.chunk...}`) |

**(c) Model `Cline` là một COMBO round-robin — không phải 1 model cụ thể:**

- `GET /v1/models` → `{"id":"Cline","owned_by":"combo"}`.
- 2 request giống nhau cho ra `model` khác nhau: `google/gemma-4-26b-a4b-it:free` và `deepseek/deepseek-v4.1-flash`.
- DS combo (từ 9router, cùng máy): `cl/deepseek/deepseek-v4.1-flash`, `cl/poolside/laguna-s-2.1:free`, `cl/z-ai/glm-5.2:free`, `cl/nvidia/nemotron-3-*:free`, `oc/ling-3.0-flash-fin-free`, `openrouter/poolside/laguna-xs-2.1:free`… (~29 model free).
- ⚠️ **Không được hard-code model con** (`deepseek/deepseek-chat`, `google/gemini-2.5-flash`… sẽ lỗi nếu không có trong combo) — luôn dùng `model: "Cline"`.
- ⚠️ Vì là round-robin các model **free**, khả năng **model không có vision** là rất cao → phải có bước kiểm tra capability trước khi ném ảnh.

### 5.3 Khuyến nghị interface client

```ts
// Gọi
POST {AI_GATEWAY_URL}/chat/completions      // AI_GATEWAY_URL = http://mc.luckyhub.io.vn:20128/v1
Headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' }
Body:    { model: AI_MODEL /* "Cline" */, messages: [...], stream: false }

// Đọc kết quả — CHUẨN HOÁ 2 shape
function readGatewayText(raw: string): string {
  const trimmed = raw.trim().replace(/\n?data:\s*\[DONE\]\s*$/, '');
  const json = JSON.parse(trimmed);                 // bọc JSON
  const root = json.data ?? json;                   // chấp nhận cả 2
  return root?.choices?.[0]?.message?.content ?? '';
}

// Nếu server luôn trả SSE (shape spec chuẩn OpenAI), dùng:
function readSSEText(raw: string): string {
  return raw.split(/\r?\n/)
    .filter(l => l.startsWith('data: '))
    .map(l => l.slice(6).trim())
    .filter(l => l && l !== '[DONE]')
    .map(l => JSON.parse(l))
    .map(c => c.choices?.[0]?.delta?.content ?? (c.data ?? c).choices?.[0]?.message?.content ?? '')
    .join('');
}
```

---

## 6. ĐIỂM BẤT HỢP LÝ TRONG HỆ THỐNG A.I

Xếp theo mức độ ưu tiên cho việc tái cấu trúc. Mọi mục đều kèm bằng chứng file:line đã kiểm chứng.

### 6.0 Ngoài phạm vi A.I nhưng ảnh hưởng trực tiếp

| # | Vấn đề | Bằng chứng |
|---|---|---|
| 6.0.1 | `.clinerules` (file cũ) bị xoá, thay bằng thư mục chưa `git add` → rules mới không được version hoá | `git status` → ` D .clinerules` + `?? .clinerules/01-web-dev-vn.md` |
| 6.0.2 | Repo chứa **24MB** `migrated_prompt_history` và **đang được git track** | `git ls-files migrated_prompt_history` → có; `.gitignore` không chặn |
| 6.0.3 | 7 file `.bak` nằm trong repo | `App.tsx.bak`, `aiService.ts.bak`, `permissionService.ts.bak`, `UserManagement.tsx.bak`, `MetricAdmin.tsx.bak`, `GroupManager.tsx.bak`, `BranchManager.tsx.bak` |

### 6.1 [CAO] Provider Cline không dùng cấu hình openai-compatible + chưa trỏ gateway

- `clineService.ts:9` hard-code:
  ```ts
  const CLINE_API_URL = 'https://api.cline.bot/api/v1/chat/completions';
  ```
  → **không thể** đổi sang `http://mc.luckyhub.io.vn:20128/v1` bằng `.env`.
- Không tồn tại biến `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` nào trong code hoặc `.env`. Grep toàn repo chỉ có: `API_KEY`, `API_KEY_2`, `API_KEY_3`, `GEMINI_API_KEY`, `GEMINI_PROXY_URL`.
- Key của "provider Cline" hiện **phải nhập tay qua UI** vào Mongo (`/api/admin/gemini-keys` với `keyType='cline'`) — trái yêu cầu "api key sẽ cấu hình trong `.env`".

### 6.2 [CAO] Model bị hard-code ở 6 nơi, mâu thuẫn với combo `Cline`

| Vị trí | Giá trị hard-code |
|---|---|
| `clineService.ts:52` (test key) | `deepseek/deepseek-chat` |
| `clineService.ts:90` (models trả về) | `['deepseek/deepseek-chat', 'deepseek/deepseek-v3']` |
| `clineService.ts:138` (`callCline` default) | `deepseek/deepseek-chat` |
| `aiService.ts:298` (vision) | `google/gemini-2.5-flash` |
| `clineService.ts:209-214` (`CLINE_VISION_MODELS`) | `google/gemini-2.5-flash`, `openai/gpt-4o-mini`, `qwen/qwen-2.5-vl`, `meta-llama/llama-3.2-11b-vision-instruct` |
| `server/index.ts:245` (banner khởi động) | `deepseek/deepseek-chat → deepseek/deepseek-v3` |

→ Gateway chỉ expose model `Cline` (combo). Phải thay bằng **1 hằng số duy nhất** lấy từ `.env`.

### 6.3 [CAO] Fallback "gemini" không kiểm soát được, không có cờ tắt

- `aiService.ts:262` — không có Cline key → tự động gọi Gemini.
- `aiService.ts:349` — thử hết Cline key → tự động gọi Gemini.
- Provider được chọn từ **DB** (`AIConfig.active_provider` qua `getConfigValue`, cache 60s), không phải `.env` → sau tái cấu trúc, cơ chế này thành **mã chết nguy hiểm**: có thể âm thầm gửi prompt sang Google kèm key Gemini cũ.

### 6.4 [CAO] Parse response sẽ vỡ ngay với gateway mới

- `clineService.ts:148` (`callCline`) và `:273` (`callClineVision`) gọi `await response.json()` trực tiếp.
- Gateway 9router trả JSON **cộng thêm** dòng `data: [DONE]` → `response.json()` **throw** (đã test: `JSON.parse FAIL: Unexpected non-whitespace character after JSON at position 815`).
- Cần hàm `readGatewayText()` (§5.3) — hiện **chưa tồn tại**.
- Thêm nữa header trả về là `content-type: text/event-stream` **kể cả khi `stream:false`** → không được dựa vào header.

### 6.5 [CAO] Vision không có bước kiểm tra capability

- `aiService.ts:278-301`: task `vision`/`verify` **luôn** gọi `callClineVision` với model hard-code `google/gemini-2.5-flash`.
- Combo `Cline` xoay vòng ~29 model free, phần lớn **không có vision** (trường `capabilities.vision` trong catalog).
- Hệ quả: request ảnh thất bại ngẫu nhiên theo round-robin; lỗi rơi vào `catch` → `cooldownClineKey()` → **đốt sạch key** của người dùng.

### 6.6 [CAO] Trùng lặp & mâu thuẫn trong quản lý key

| Vấn đề | Bằng chứng |
|---|---|
| 4 biến ENV cho cùng mục đích Gemini | `aiService.ts:7-12` (API_KEY, API_KEY_2, API_KEY_3, GEMINI_API_KEY) |
| Model `GeminiKey` tên sai: chứa cả key Cline | `GeminiKey.ts:6` → `keyType: enum ['gemini','cline']` |
| Key Cline **không** đọc từ `.env` (chỉ ENV cho Gemini) | `admin.routes.ts:24-28` chỉ liệt kê 3 biến `API_KEY` |
| Nhận diện loại key bằng tiền tố `sk_` | `admin.routes.ts:149` → `key?.startsWith('sk_')` — dễ nhận diện sai |
| `aiService.ts.bak` (344 dòng) chứa logic cũ, dễ lẫn khi đọc code | `server/services/aiService.ts.bak` |

### 6.7 [ĐÃ XỬ LÝ 2026-10-09] API key và dữ liệu Magic Mirror

- `GET /MM/config` không còn trả Gemini API key; TTS được gọi qua server.
- Tất cả route `/MM` yêu cầu token Magic Mirror đang bật và chưa hết hạn; token được quản lý trong **Cài đặt Hệ thống → CẤU HÌNH MAGIC MIRROR**, lưu mã hóa kèm hash xác thực.
- Hồ sơ chỉ trả trường cần hiển thị và truy vấn chỉ số bị giới hạn tối đa 30 bản ghi.
- Cách tạo token và cấu hình hai module Magic Mirror được hướng dẫn trong `README.md`.
- Route `/api/admin/env-keys` nêu trong bản rà soát cũ không có trong source hiện tại.

### 6.8 [TB] TTS đi đường vòng, không qua AI router

- `mirror.routes.ts:73-75` gọi trực tiếp `ttsService.generateGreeting(..., callAIWithRetry)`.
- `src/services/ttsService.ts:41-47` hard-code 5 model Gemini cho audio.
- → Khi chuyển sang gateway openai-compatible, TTS **không đổi theo** (vẫn gọi Gemini trực tiếp). Cần quyết định: giữ riêng (vì Magic Mirror cần modality AUDIO) hay gộp vào hệ A.I chung.

### 6.9 [TB] `/api/admin/ai-config` không reset cache sau khi đổi provider

- `admin.routes.ts:217` gọi `setConfigValue(...)`.
- `admin.routes.ts:220` → `const { getActiveProvider } = await import('../services/aiService.ts');` — **lấy hàm nhưng không dùng**, cũng không gọi `resetProviderCache()`.
- Cả `resetProviderCache` (`aiService.ts:72`) và `resetClineKeysCache` (`aiService.ts:150`) **không được gọi ở bất kỳ đâu** trong repo → đổi provider xong phải chờ tới 60s mới có hiệu lực.

### 6.10 [TB] Health-check/`discoverAvailableModels` chỉ hiểu Gemini

- `aiService.ts:485-600`: gộp kết quả Gemini (`quickKeyHealthCheck`) + Cline (`testClineKey`) vào **một mảng `discoveredModels`**.
- `selectModelForTask` (`:381`) chỉ so khớp với `MODEL_RECOMMENDATIONS` toàn tên Gemini → khi provider = cline, model như `deepseek/deepseek-chat` **không bao giờ** được chọn.
- `server.ts:607` còn lọc `.filter(m => m.includes('gemini'))` (trong dead code) — tư duy "chỉ có Gemini".

### 6.11 [TB] Phụ thuộc shape riêng của gateway khi đọc chi phí/model

- `clineService.ts:275-278`: đọc `provider_metadata.gateway.cost` và `...routing.resolvedProvider` — metadata **riêng của 9router/OpenRouter**, không thuộc chuẩn OpenAI.
- `aiService.ts:251-254, 265, 352` in khối ANSI box + tên key vào stdout → log production rất nhiễu.

### 6.12 [TB] Router trung tâm gánh quá nhiều trách nhiệm

- `aiService.ts` 743 dòng ôm: chọn provider + đọc key DB + cache + cooldown + chuyển payload Gemini↔OpenAI + chọn model + retry + health check + log ANSI.
- `aiService.ts:205-210`: hai nhánh `if (hasImage) / else` **giống hệt nhau**; ảnh bị **vứt bỏ** (chỉ ghi comment "handled by callClineVision separately") → route nào gửi ảnh mà không qua nhánh vision sẽ mất ảnh âm thầm.
- `systemInstruction` của Gemini bị nén thành message `role:'system'` — nếu gateway không hỗ trợ role `system` thì prompt mất.

### 6.13 [TB] Luồng gọi AI không thống nhất giữa các module

- `foodAnalysisService.ts:164,410,604` dùng `callAI(..., modelName:'auto')` — đúng chuẩn router.
- `src/services/ttsService.ts` dùng `callAIWithRetry` — bỏ qua router.
- `components/chat/ChatProvider.tsx:560,692` gọi AI coach từ FE qua `services/gemini.ts` → phụ thuộc `/api/ai/coach` với `optionalAuth` → dễ hỏng im lặng khi provider đổi.

### 6.14 [TB] Dead code & trùng lặp file

| Vấn đề | Bằng chứng |
|---|---|
| `server.ts` 2.363 dòng không ai import | `grep -rn "from '.*server.ts'"` → 0 kết quả |
| `server.ts` định nghĩa lại `/api/ai/extract`, `/bulk-extract`, `/coach`, `callAIWithRetry`, `checkGeminiHealth`, schema `GeminiKey` | `server.ts:537, 699-795, 806-873` — trùng với `server/routes/ai.routes.ts` + `server/services/aiService.ts` |
| 2 logger khác API | `src/utils/logger.ts` vs `services/logger.ts` |
| `services/` vs `server/services/` trùng tên, khác vai trò | FE client (`services/database.ts`) vs BE service |
| 4 component FE trùng bản trong thư mục con | `components/{AdminPanel,Layout,MetricsManagement,Profile}.tsx` |
| `CLINE_VISION_MODELS` là dữ liệu UI nhưng khai báo trong service | `clineService.ts:209` → trả về ở `admin.routes.ts:201` |

### 6.15 [Thấp] An toàn & hiệu năng

| # | Vấn đề | Bằng chứng |
|---|---|---|
| 6.15.1 | `GET /api/audit-logs` **không auth** (mount legacy) | `server/index.ts:157` — trả 500 log gần nhất |
| 6.15.2 | `verify-avatar` không auth + rate limit AI 30/phút → lạm dụng đốt key | `ai.routes.ts:30`, `server/index.ts:75-81` |
| 6.15.3 | `GeminiKey.find({isActive:true})` **trong vòng lặp retry/model** | `aiService.ts:649` → N queries mỗi lần gọi AI |
| 6.15.4 | `migrated_prompt_history` 24MB được deploy lên HF (deploy.yml phải `rm -rf` riêng) | `.github/workflows/deploy.yml` bước 3 |
| 6.15.5 | `vite.config.ts` tồn tại nhưng `vite` không có trong `devDependencies`; `build` là no-op | `package.json` |
| 6.15.6 | `code-workspace` trỏ folder `lucky-hub-2026` không tồn tại | `lucky-hub-2026.code-workspace` |

---

## 7. PHƯƠNG ÁN TÁI CẤU TRÚC HỆ THỐNG A.I

### 7.1 Kiến trúc đích (to-be)

```
              ────────────────────── server/routes/ai.routes.ts ──────────────────────┐
FE ──► /api/ai/{extract|bulk-extract|verify-avatar|coach|analyze-food|suggest-meal}
              │  payload chuẩn hoá: { task, text, imageBase64?, system?, jsonSchema? }
              ▼
        server/services/ai/aiRouter.ts          (task → model + capability check)
              │
              ├─► server/services/ai/gatewayClient.ts   ⭐ CHỈ 1 ĐƯỜNG RA
              │        baseUrl = process.env.AI_BASE_URL  (http://mc.luckyhub.io.vn:20128/v1)
              │        apiKey  = process.env.AI_API_KEY
              │        model   = process.env.AI_MODEL     ("Cline")
              │        fetch → readGatewayText()  (xử lý bọc {data} + đuôi "data: [DONE]")
              │
              └─► (tuỳ chọn, mặc định TẮT) server/services/ai/ttsClient.ts
                       Google TTS cho Magic Mirror — bật khi AI_ENABLE_GOOGLE_TTS=true
```

### 7.2 Đề xuất tách file (mỗi file 1 trách nhiệm)

| File mới | Nội dung | Thay thế / nguồn |
|---|---|---|
| `server/services/ai/gatewayClient.ts` | `chatText()`, `chatVision()`, `listModels()`, `readGatewayText()`, `readSSEText()`, timeout, retry HTTP | `clineService.ts` (313 dòng) |
| `server/services/ai/aiRouter.ts` | `callAI(task, input)` — chọn model, kiểm capability, fallback, cooldown, log 1 dòng | phần routing trong `aiService.ts` |
| `server/services/ai/modelPolicy.ts` | Bảng `TASK → { model, requiresVision, jsonSchema, maxTokens }`, default đọc từ `.env` | `MODEL_RECOMMENDATIONS`, `selectModelForTask`, `CLINE_VISION_MODELS` |
| `server/services/ai/keySource.ts` | Nguồn key: `.env` (chính) + DB (phụ, tuỳ chọn) | `getActiveClineKeys`, `ENV_API_KEYS`, `keyCooldowns` |
| `server/services/ai/healthCheck.ts` | `discoverAvailableModels()` + health, tách riêng 2 họ model | `discoverAvailableModels`, `quickKeyHealthCheck` |
| `server/services/ai/prompts/*.ts` | Prompt từng task (InBody, avatar, food, coach) | prompt đang rải trong `ai.routes.ts` + `foodAnalysisService.ts` |
| `server/models/AiKey.ts` (đổi tên) | Schema key dùng chung, bỏ `enum ['gemini','cline']` | `GeminiKey.ts` |

### 7.3 Biến `.env` đề xuất

```dotenv
# ===== AI Gateway (openai-compatible) =====
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://mc.luckyhub.io.vn:20128/v1
AI_API_KEY=<key cấp bởi gateway>
AI_MODEL=Cline

# Model riêng cho tác vụ ảnh (nếu combo Cline không có vision)
AI_VISION_MODEL=                # trống = dùng luôn AI_MODEL
AI_REQUIRE_VISION=true          # true → từ chối task ảnh nếu model không có vision

# Bật/tắt các đường ra khác (mặc định TẮT sau tái cấu trúc)
AI_ENABLE_GOOGLE_TTS=false
AI_ENABLE_LEGACY_GEMINI=false   # giữ để rollback, không dùng ở luồng chính

# Giữ cho giai đoạn chuyển tiếp (có thể xoá sau)
GEMINI_PROXY_URL=
```

> ⚠️ `AI_BASE_URL` là **http** (không phải https) — đã test `https://mc.luckyhub.io.vn:20128` trả `HTTP=000`. Cần đảm bảo server deploy gọi ra được cổng 20128.

### 7.4 Ba phương án triển khai

| # | Phương án | Ưu điểm | Nhược điểm | Phù hợp khi |
|---|---|---|---|---|
| A | **Adapter tối thiểu**: chỉ sửa `clineService.ts` (đọc `.env`, thêm `readGatewayText`, bỏ hard-code model) + tắt nhánh Gemini trong `callAI` | Ít rủi ro nhất, giữ nguyên mọi endpoint/UI, làm nhanh | `aiService.ts` vẫn phình 700+ dòng, nợ kỹ thuật còn | Cần chạy được **ngay**, chưa muốn refactor |
| B | **Tái cấu trúc module A.I** theo §7.2 (tách `server/services/ai/*`), giữ API endpoints 100% | Đúng chuẩn module hoá (.clinerules §6), dễ test từng phần, xoá được dead code `server.ts` | Cần sửa ~8 file, phải test lại 6 endpoint AI + TTS | Muốn dọn nợ + có thời gian test đầy đủ |
| C | **B + đổi UI quản trị** (bỏ `GeminiKeyManager`, thay bằng panel "AI Gateway" chỉ đọc `.env`, hiển thị health + model list từ gateway) | Đúng mục tiêu "key trong .env", UI gọn | Đụng nhiều component admin (`AIConfigPanel` 408 dòng, `GeminiKeyManager` 302 dòng) | Muốn hệ A.I sạch hoàn toàn, chấp nhận đổi UI admin |

**Khuyến nghị: Phương án B** — vì:
1. Đáp ứng đủ yêu cầu kỹ thuật (openai-compatible + gateway + model `Cline` + key trong `.env`) mà **không phá endpoint/UI hiện có** (theo `.clinerules` §7).
2. Xử lý được 5 điểm [CAO] (§6.1–6.5) — là những lỗi **chắc chắn xảy ra** khi trỏ gateway mới.
3. Tách `server/services/ai/*` đúng nguyên tắc module hoá (rules §6), đồng thời dọn được `server.ts` (dead code) và các `.bak`.
4. TTS/Magic Mirror cô lập sau cờ `AI_ENABLE_GOOGLE_TTS` → không tự ý đổi hành vi đang chạy tốt.

### 7.5 Thứ tự thực hiện đề xuất

1. **Chuẩn bị**: thêm biến `.env` (§7.3); thêm `scripts/ai-smoke.mjs` gọi gateway trực tiếp (text + vision) để có baseline.
2. **Tạo tầng gateway**: `gatewayClient.ts` + `readGatewayText/readSSEText` → thay `CLINE_API_URL` hard-code.
3. **Rút router**: `aiRouter.ts` + `modelPolicy.ts` + `keySource.ts`, giữ nguyên chữ ký `callAI(requestId, taskType, payload, options)` để `ai.routes.ts` không phải sửa.
4. **Kiểm capability vision**: đọc `/v1/models` một lần, cache; nếu `AI_REQUIRE_VISION=true` và model không có vision → trả lỗi rõ ràng thay vì đốt key.
5. **Cô lập TTS + Gemini legacy** sau cờ `.env`.
6. **Dọn dẹp** (xin phép riêng): xoá `server.ts`, `aiService.ts.bak`, các `.bak`, gỡ `migrated_prompt_history` khỏi git.
7. **Test lại toàn bộ**: 6 endpoint AI, TTS mirror, admin panel; `tsc --noEmit`; log 1 dòng/request.

---

## 8. CHECKLIST HÀNH ĐỘNG

### 8.1 Blocker — phải chốt trước khi tái cấu trúc

- [ ] Xác nhận **API key** dùng cho gateway `mc.luckyhub.io.vn:20128` (hiện chỉ có key của 9router local `sk-b1c4…`, chưa rõ key nào hợp lệ cho remote).
- [ ] Xác nhận server deploy (Render/HF) **gọi ra được** `http://mc.luckyhub.io.vn:20128` (http, port 20128).
- [ ] Xác nhận **model `Cline` (combo) có vision hay không**; nếu không → chốt `AI_VISION_MODEL` riêng hoặc tạm tắt tính năng đọc ảnh.
- [ ] Quyết định số phận **TTS / Magic Mirror** (giữ Gemini riêng hay bỏ).

### 8.2 Việc kỹ thuật (theo §7.5)

- [ ] Thêm `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` (+ `AI_VISION_MODEL`, `AI_REQUIRE_VISION`) vào `.env` và `.env.example`.
- [ ] Tạo `server/services/ai/*` theo §7.2.
- [ ] Loại bỏ hard-code model ở 6 vị trí (§6.2).
- [ ] Thêm `readGatewayText()` (§5.3) — **bắt buộc**, nếu không sẽ vỡ như §6.4.
- [ ] Tắt/cô lập nhánh fallback Gemini (§6.3).
- [ ] Thêm capability check cho vision (§6.5).
- [x] Bảo vệ route Magic Mirror, bỏ API key khỏi `/MM/config`, giới hạn dữ liệu trả về và thêm trang quản lý nhiều token (§6.7, 2026-10-09).
- [ ] Gọi `resetProviderCache()` / `resetClineKeysCache()` sau PUT `/api/admin/ai-config` (§6.9).
- [ ] Che key trong log; bỏ khối ANSI box (§6.11).
- [ ] Gộp query key ra ngoài vòng lặp retry (§6.15.3).

### 8.3 Dọn dẹp (đã hoàn tất 2026-10-01, theo xác nhận của chủ dự án)

- [x] Xoá `server.ts` (dead code 2.363 dòng) — đồng thời gỡ `"server.ts"` khỏi `tsconfig.json`
      (bổ sung `services`, `scripts`, `utils` vào `include` để lint phủ các thư mục này),
      sửa comment trong `run.js` và sơ đồ trong `AGENTS.md`.
- [x] Xoá `.bak` — thực tế còn 6 file (không phải 7), tất cả đều được git track nên khôi phục được:
      `App.tsx.bak`, `components/admin/MetricAdmin.tsx.bak`, `components/admin/UserManagement.tsx.bak`,
      `components/admin/groups/GroupManager.tsx.bak`, `components/admin/nutrition/BranchManager.tsx.bak`,
      `server/services/permissionService.ts.bak`. Thêm `*.bak` vào `.gitignore`.
- [x] Bỏ `migrated_prompt_history/` khỏi git (`git rm -r --cached`) + thêm vào `.gitignore`.
      **File 24MB vẫn còn nguyên trên đĩa**, chỉ không còn được version hoá.
- [x] `git add .clinerules/` để rules mới (`01-web-dev-vn.md`) được version hoá.
- [x] Sửa `lucky-hub-2026.code-workspace` — bỏ folder lồng nhau `lucky-hub-2026` trỏ vào chính nó.
- [x] Xoá file rác do agent tạo: `.tmp_cleanup`, `agent-task.json`, `clear-tmp.js`,
      `rebuild.js`, `rebuild.sh`, `restart-container.js`, `build.log`, `build2.log`, `run.log`, `run2.log`.

**Đợt 2 (rà theo đồ thị import, cùng ngày)** — các file dưới đây không được
import/require ở bất kỳ đâu (đã kiểm bằng script resolve đường dẫn tương đối,
không chỉ grep tên file):

- [x] 4 component trùng lặp cũ ở gốc `components/` (bản cũ, nhỏ hơn, đã bị bản trong
      thư mục con thay thế): `AdminPanel.tsx` (109 dòng), `Layout.tsx` (142),
      `MetricsManagement.tsx` (145), `Profile.tsx` (160).
- [x] Component dựng rồi không nối vào đâu: `components/admin/MetricAdmin.tsx`,
      `components/admin/SystemDiagnostics.tsx`, `components/admin/nutrition/ChatGroupManager.tsx`,
      barrel `components/admin/ai/index.ts`.
- [x] `vite.config.ts` — project không dùng bundler (`package.json` không có `vite`,
      `npm run build` là no-op, frontend chạy bằng importmap).
- [x] `metadata.json` — di sản của AI Studio, không nơi nào đọc.
- [x] `utils/performanceMonitor.ts` (311 dòng), `utils/permissions.ts`,
      `services/logger.ts` đã **giữ lại** (emailService dùng), `src/utils/puter.v2.js` (thư viện minify).
- [x] `scripts/fix-admin-group.js`, `scripts/fix-admin-permissions.js` — script sửa DB một lần, đã chạy xong.
- [x] `migrated_prompt_history/` — xoá hẳn theo xác nhận của chủ dự án.

Chỉ còn `server/index.ts` bị script đánh dấu "không ai import" — đúng, vì nó là
entry point được `run.js` gọi bằng chuỗi `npx tsx server/index.ts`.

---

## 9. PHỤ LỤC: BẰNG CHỨNG & LỆNH KIỂM CHỨNG

### 9.1 Lệnh đã dùng để dựng tài liệu này

```bash
# Cấu trúc
find . -path ./node_modules -prune -o -path ./.git -prune -o -type f -print | sort
find . -path ./node_modules -prune -o -name '*.ts*' -type f -print0 | xargs -0 wc -l | sort -rn | head -30

# Hệ A.I
grep -rn 'process\.env\.[A-Z_0-9]+' --include='*.ts' --include='*.tsx' .
grep -rn -E 'gemini|cline|apiKey|baseUrl' server/ --include='*.ts'
grep -rn "'/api/ai/" --include='*.ts' --include='*.tsx' .

# Kiểm chứng gateway
curl -s http://localhost:20128/v1/models | head -c 400
curl -s http://mc.luckyhub.io.vn:20128/v1/models                  # → 401
curl -s https://mc.luckyhub.io.vn:20128/v1/models                 # → 000 (không hỗ trợ HTTPS)
curl -s -X POST http://mc.luckyhub.io.vn:20128/v1/chat/completions \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $AI_API_KEY" \
  -d '{"model":"Cline","messages":[{"role":"user","content":"Say OK"}],"max_tokens":5}'
```

### 9.2 Kết quả test gateway (tóm tắt — 2026-09-19)

| Kiểm tra | Kết quả |
|---|---|
| `GET /v1/models` (local, không key) | 200 — có `"id":"Cline"`, `"owned_by":"combo"` |
| `GET /v1/models` (remote, không key) | 401 `API key required for remote API access` |
| `GET /v1/models` (remote, có key) | 200 |
| `POST /v1/chat/completions` model `Cline` | 200; `data.choices[0].message.content = "OK"`; `data.model` = `google/gemma-4-26b-a4b-it:free` (lần khác: `deepseek/deepseek-v4.1-flash`) |
| `JSON.parse(body)` |  FAIL tại position 815 (do đuôi `data: [DONE]`) |
| Sau khi strip `data: [DONE]` | ✅ parse OK, `success=true`, có `data.choices` |
| `stream: true` | trả SSE chunks chuẩn (`chat.completion.chunk`) |
| `Content-Type` khi `stream: false` | `text/event-stream` |
| `POST` không kèm key (remote) | 401 |

### 9.3 Rủi ro cần lưu ý

1. **Round-robin model free** → chất lượng trả lời **không ổn định** giữa các request (test cho thấy model đổi giữa 2 lần gọi cùng prompt). Cần cân nhắc cho tác vụ cần chính xác (InBody OCR).
2. **Rate limit của model free** → cần retry + backoff ở tầng gateway client.
3. **HTTPS không hỗ trợ** → nếu môi trường deploy chặn http ra ngoài thì gateway không dùng được.
4. Sau tái cấu trúc, nếu **tắt hoàn toàn** đường Gemini thì lỗi gateway sẽ trả thẳng cho người dùng (không còn fallback im lặng) → cần UI thông báo rõ.

---

*Hết tài liệu. Cập nhật lần cuối: 2026-09-19 — sau khi hoàn thành tái cấu trúc, cập nhật lại §4, §6, §7.*