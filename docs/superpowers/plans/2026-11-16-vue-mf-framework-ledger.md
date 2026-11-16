# SDD ledger — plan: docs/superpowers/plans/2026-11-16-vue-mf-framework.md

Spec: docs/superpowers/specs/2026-11-16-vue-mf-framework-design.md
Branch: feat/framework (from main 884cc93)

## Process ruling (user request)
Ruling: Mỗi task chạy implementer → tester → reviewer. Tester (agent riêng) chạy toàn bộ test/typecheck/build/lint của phạm vi task, viết thêm test cho edge case còn hở, chạy thử hành vi, gỡ lỗi và sửa bằng commit riêng (`fix:`/`test:`), ghi report `task-N-tester.md`. Reviewer review BASE..HEAD gồm cả commit của tester. — user yêu cầu "thêm một tester, gỡ lỗi trên từng giai đoạn" — nếu sai: tốn thêm 1 agent/task.

## Pre-flight scan

| Rows | Produces ↔ Consumes | Finding |
|---|---|---|
| T1 ↔ T2 | mf-vite shared names ↔ mf-core peer deps | OK (vue, pinia, vue-router, vue-i18n, mf-core) |
| T1 ↔ T8 | defineHost/defineRemote ↔ playground vite configs | OK; coreVersion đọc từ node_modules/@nineh-fe-base/mf-core/package.json (workspace link) |
| T2 ↔ T4 | types.ts/bus MfEvents dùng AuthUser ↔ AuthUser định nghĩa T4 | CONFLICT: T2 import type file chưa tồn tại |
| T2/T5 ↔ T6 | MfContext.remotes: Ref<LoadedRemote[]> ↔ LoadedRemote định nghĩa T6 | CONFLICT tương tự |
| T3 ↔ T7 | createHttpClient/HttpAuthHooks ↔ createMfApp | OK |
| T4 ↔ T7 | configureAuth/installAuthGuard(loginPath) ↔ createMfApp loginPath | OK |
| T5 ↔ T6 | RemoteBoundary/RemoteErrorPage ↔ loader RemoteHost | OK |
| T6 ↔ T7 | createRemoteLoader(ready) ↔ mount order | OK |
| T7 ↔ T8 | createMfApp/createStandaloneRemote ↔ playground | OK |
| T8 ↔ T9 | playground preview ↔ e2e | MSW phải chạy cả ở build preview |
| T8 ↔ T10 | playground ↔ templates | OK |
| T1 self | test path `node_modules/.nineh-mf/mf-meta.js` ↔ writeMetaModule | OK |
| T2 self | MfContext khai báo ở T2 nhưng context.ts ở T5 | xem ruling R2 |
| T3–T7, T10 self | tests ↔ signatures | OK |
| T8 self | products standalone mock auth token `at-standalone` ↔ handlers | handler phải chấp nhận token này |
| T9 self | "1 bản Vue" có fallback | OK |
| T11 self | OK |

Ruling R1: `AuthUser` được định nghĩa ngay ở Task 2 trong `packages/mf-core/src/auth/types.ts`; Task 4 mở rộng file đó. — tránh import tới file chưa có — rủi ro thấp.
Ruling R2: Task 2 `types.ts` chỉ chứa `RemoteEntry`, `RemotesManifest`, `RemoteMeta`. `MfContext`, `RemoteSetup`, `LoadedRemote` thêm vào `types.ts` ở Task 5 (LoadedRemote = RemoteEntry & {status, error?}); loader Task 6 import từ types.ts. — giữ mỗi task build được độc lập — rủi ro thấp.
Ruling R3: MSW trong playground chạy ở mọi mode (dev & preview), `onUnhandledRequest: 'bypass'`; handler chấp nhận cả `at-standalone`. — e2e chạy trên preview — rủi ro thấp.

## Tasks
Task 1: dispatched implementer (BASE 884cc93)
Task 1: BLOCKED — pnpm wrapper của tổ chức lỗi "malware definitions are invalid".
Ruling R4 (user quyết định): dùng **npm workspaces** thay pnpm cho toàn bộ plan. `pnpm-workspace.yaml` → `"workspaces": ["packages/*","playground/*"]` trong root package.json; `workspace:*` → `"*"` (npm link local package); `pnpm -r X` → `npm run X --workspaces --if-present`; `pnpm --filter P X` → `npm run X -w P`; `pnpm create @nineh-fe-base/mf` → `npm create @nineh-fe-base/mf`; mf-vite: version `"*"` hoặc `workspace:*`/`link:`/`file:` → `^<coreVersion>`. CI dùng npm ci. — user chỉ định — nếu sai: đổi lại package manager tốn ít.
Task 1: implementer DONE_WITH_CONCERNS (8009bb8, 1506304); TS pinned ^6.0.3 for typescript-eslint; defineHost/defineRemote untested until mf-core exists (tester/T8)
Task 1: tester PASS (bfc77be). Note: MF vite plugin returns no plugins under VITEST unless MFE_VITE_NO_TEST_ENV_CHECK=true
Task 1: review Approved; 1 Important (plan-mandated): vitest.workspace.ts dùng defineWorkspace không tồn tại ở vitest 5.1.
Ruling R5: thay `vitest.workspace.ts` bằng root `vitest.config.ts` dùng `test.projects: ['packages/*', 'playground/*']` (mỗi package tự có vitest/vite config nếu cần môi trường riêng, vd jsdom cho mf-core). Các task sau dùng cấu trúc này. — plan viết theo API cũ; spec không ràng buộc — rủi ro thấp.
Task 1: minor (deferred): federation.ts:42 thông báo lỗi lặp; shared.ts:17,34 chưa format prettier; define.ts dùng process.cwd() thay vì vite root; test phụ thuộc env MFE_VITE_NO_TEST_ENV_CHECK; nhánh không có mf-core trong versions chưa test; vite là peer của mf-vite.
Task 1: fix round 1/5 (1 addressed, 0 open; commits bfc77be..362976e)
Task 1: complete (commits 884cc93..362976e, review clean)
Task 2: dispatched implementer (BASE 362976e)
Task 2: implementer DONE (19f2e5d)
Task 2: tester PASS (c7252f2)
Task 2: complete (commits 362976e..c7252f2, review clean)
Task 2: minor (deferred): theme apply() không xóa token cũ khi đổi mode khác bộ key; plugin-vue chưa cần (sẽ cần ở T5 SFC); vue không có trong devDeps mf-core (hoisting); chưa test CORE_VERSION == package.json; cast as never ở i18n.ts.
Task 3: dispatched implementer (BASE c7252f2)
Task 3: implementer DONE (c8ef99d)
Task 3: tester PASS_WITH_FIXES (1f56198): stale-token 401 replays w/o refresh; auth typing Omit. Note: refresh() must not use same client w/o skipAuth (deadlock) — T4 adapters use bare axios per plan.
Task 3: complete (commits c7252f2..1f56198, review clean)
Task 3: minor (deferred): onAuthFailure throw thay lỗi 401 bằng lỗi hook (test chỉ assert toBeDefined); replay giữ header Bearer cũ khi token mới null; onAuthFailure "once" chỉ theo chu kỳ (401 muộn sau logout kích hoạt lại); cookie auth: stale-check vô hiệu; test 3-parallel dựa thứ tự mock adapter; dòng withCredentials thừa; peerDependencies bị npm sắp xếp lại.
Task 4: dispatched implementer (BASE 1f56198)
Task 4: implementer DONE (cb08ed1)
Task 4: tester PASS (a2503de)
Task 4: complete (commits 1f56198..a2503de, review clean)
Task 4: minor (deferred): [→T7] createMfApp phải truyền adapter.withCredentials vào createHttpClient + test cookie; adapter/bus module-scoped (HMR reset); init() race với login() ghi đè; login fail trước init để status idle; cookie init không thử refresh; cookie.ts:46 'user' in data với body không phải object; multi-tab RT rotation clear() xóa RT của tab khác; login không xóa RT cũ khi response thiếu RT; logout gửi refreshToken null; init/refresh throw sync.
Task 5: dispatched implementer (BASE a2503de)
Task 5: implementer DONE (97d34c7); inline styles, Suspense timeout
Task 5: tester PASS_WITH_FIXES (d090777): boundary reset on route change via routeLocationKey
Task 5: complete (commits a2503de..d090777, review clean)
Task 5: minor (deferred): boundary nuốt lỗi không log (onErrorCaptured false) ; reset theo fullPath cả khi query đổi; fallback loading rỗng; import giữa file types.ts; timeout đọc 1 lần.
Task 6: dispatched implementer (BASE d090777), model opus (MF runtime integration)
Task 6: implementer DONE (b8c1d59). MF runtime real-instance behaviour unverified (→T8/e2e). Route names prefixed <remote>/.
Task 6: tester PASS_WITH_FIXES (16af692): per-remote timeoutMs default 10000
Task 6: review Needs fixes — 1 Important (plan-mandated): major check split('.')[0] vô hiệu ở 0.x.
Ruling R6: "major" theo semver: nếu major = 0 thì so `major.minor` (0.1.x vs 0.2.x → từ chối). — spec: tương thích ngược trong 1 major, 0.x minor là breaking theo semver — nếu sai: chặt hơn cần thiết, dễ nới.
Task 6: minor (deferred): fallback init() không shared, không warn; registerRemotes không force (bị bỏ qua nếu đã đăng ký); type:'module' cho mọi entry không phải manifest; phát hiện thiếu ./setup qua text; nested child absolute path/function redirect/alias không scope; tên remote trùng route host; setup bị abandon vẫn giữ side effects; defineRemoteComponent cần loadAll trước; test real socket 127.0.0.1:1 timeout 20s.
Task 6: fix round 1/5 (1 addressed, 0 open; commits 16af692..c326339)
Task 6: complete (commits d090777..c326339, review clean)
Task 7: dispatched implementer (BASE c326339), model opus
Task 7: implementer DONE (a5b5771)
Task 7: tester PASS (fba1696)
Task 7: review Needs fixes — 1 Important: hasPermission không hiểu wildcard '*' của mock user → standalone route có meta.permissions bị đá về /403 (không có route /403 ở standalone).
Task 7: minor (deferred): 401 trước khi router install mất deep link; mount fail không retry được; not-found host chỉ giữ component+meta; configureAuth global; [→T8] mock adapter gửi `Bearer mock-token` (không phải at-standalone) — handler T8 phải chấp nhận; createTheme chạy trước mount.
Task 7: fix round 1/5 (1 addressed, 0 open; commits fba1696..58a311f)
Task 7: complete (commits c326339..58a311f, review clean)
Task 7: minor (deferred): '*' là quyền toàn cục cho mọi adapter — cần ghi docs.
Task 8: dispatched implementer (BASE 58a311f), model opus
Task 8: implementer DONE_WITH_CONCERNS (e71fd30 mf-vite dts:false, a567df7 playground). Browser-verified dev+preview. remotes.json dùng mf-manifest.json; token mock lưu localStorage.
Task 8 notes [→T9]: msw3 dùng onUnhandledFrame (R3 cập nhật); chặn remote bằng context.route (không phải page.route) vì SW; redirect query không encode (`redirect=/products`); đếm Vue: preview dùng __FEDERATION__.__SHARE__.
Task 8: tester PASS (no commits)
Task 8: complete (commits 58a311f..a567df7, review clean)
Task 8: minor (deferred): dts:false không override được (thêm option dts?/federation passthrough); [→T10] template cần tsconfig.json + vue-tsc, không copy msw/runtime deps của playground; optimizeDeps axios/mitt reload lần đầu (nên xử lý trong mf-vite); shell/package.json thiếu newline; logout không thu hồi access token mock; màu lỗi hard-code Login.vue:68; StandaloneRoot dùng h().
Ruling R7 (T9): kiểm redirect bằng parse URL (`searchParams.get('redirect') === '/products'`) thay vì so chuỗi `%2Fproducts` — plan ghi encode, router thực tế không encode `/`; ngữ nghĩa như nhau — rủi ro thấp.
Task 9: dispatched implementer (BASE a567df7)
Task 9: implementer DONE (f78eec8) 8/8 e2e x2
Task 9: tester PASS_WITH_FIXES (1649285 webServer array); mutation-tested 5/5
Task 9: complete (commits a567df7..1649285, review clean)
Task 9: minor (deferred): single-Vue check gián tiếp (__SHARE__ version count); test chặn 5002 không login lại; reuseExistingServer có thể dùng build cũ; e2e chưa có tsconfig/lint; không retry CI.
Task 10: dispatched implementer (BASE 1649285)
Task 10: implementer DONE (6beda57). Manual check outside repo: typecheck+build+dev OK.
Ruling R8: tên host cũng phải là JS identifier (federation name) — implementer phát hiện my-shell lỗi build; chấp nhận lệch so với chỉ dẫn "npm name là đủ" — rủi ro thấp.
Task 10: tester PASS_WITH_FIXES (c5e6221 host login route + public sample route)
Task 10: review Approved nhưng 2 Important: (1) remote tên hoa → package.json name không hợp lệ npm; (2) placeholder {{name}} trùng cú pháp Vue mustache.
Ruling R9: thêm placeholder packageName = kebab-case lowercase của name (vd myOrders → my-orders) dùng trong package.json; đổi cú pháp placeholder sang `%%key%%` để không đụng Vue `{{ }}`. Kèm skip binary (NUL byte). — tránh template hỏng âm thầm — rủi ro thấp.
Task 10: minor (deferred): positional có path separator; next-steps cd đường dẫn; sample route public không demo guard; versions.ts không có kiểm tra đồng bộ với playground.
Task 10: fix round 1/5 (2 addressed, 0 open; commits c5e6221..7f184b4)
Task 10: complete (commits 1649285..7f184b4, review clean)
Task 10: minor (deferred): render decode UTF-8 không kiểm tra; host camelCase bị NPM_NAME từ chối, remote thì không (bất đối xứng).
Task 11: dispatched implementer (BASE 7f184b4)
Task 11: implementer DONE (95e4ef1); full verify green; pack dry-run clean
Task 11: tester PASS_WITH_FIXES (4d7bad6 docs)
Task 11: complete (commits 7f184b4..4d7bad6, review clean)
Task 11: minor (deferred): ci.yml thiếu permissions contents:read + concurrency; release không chạy test; timeout-minutes; CI env thừa.
Final review (3bec919..4d7bad6): With fixes — 5 Important (shared override mất singleton; token gửi cross-origin; boundary nuốt lỗi handler + che page; init bypass single-flight refresh; multi-tab clear RT) + minors chọn sửa cùng đợt. Findings: final-findings.md. Fix wave dispatched (FIX_BASE 4d7bad6), opus.
Ruling R10: RemoteBoundary chỉ chiếm vùng khi lỗi setup/render/lifecycle/async load; lỗi event handler chỉ log + forward errorHandler, giữ nội dung. — người dùng không mất form vì lỗi click; lệch so với spec "remote crash → vùng lỗi" ở chỗ lỗi handler không coi là crash — nếu sai: lỗi handler không hiện khung (vẫn log).
Ruling R11: httpClient chỉ gắn token/xử lý 401 cho URL tương đối hoặc cùng origin với baseURL (+ trustedOrigins). — chặn rò token sang bên thứ ba — nếu sai: API khác origin cần khai trustedOrigins.
Final fix wave: DONE (3530982..b79f568, 13 commits); 198 unit, 9 e2e. Deviations: per-request baseURL override không được token; jwt refresh 401 retry 1 lần với RT mới hơn của tab khác.
Final fix wave re-review: Clean (14/14 addressed).
Parked (minor, residual): pageOrigin dùng location.origin thay document.baseURI; jwt retry khi tab khác xoay 2 lần → logout xóa rt-3; trustedOrigins không hợp lệ bị bỏ im lặng; title ?? vs ||; logout khi refresh đang bay có thể ghi lại RT; refresh lỗi mạng/5xx → onAuthFailure logout.
