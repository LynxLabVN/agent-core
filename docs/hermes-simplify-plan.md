# PLAN CUỐI — Eir Simplify (bản tổng hợp chốt 16/11/2026)

> Repo: `office-agent/agent-core` (Eir Agent — rename từ hermes-agent @ `77a30e9127`).
> Bản này thay thế mọi bản plan trước. Status: ĐANG THI CÔNG.

---

## 1. Vấn đề gốc (audit)

| # | Vấn đề | Số liệu thật |
|---|---|---|
| 1 | Desktop app quá phức tạp | ~133k dòng, 10 routes, 22 settings panels, chrome 6 vùng quanh chat, pet + starmap, 2+2 picker trùng |
| 2 | Core tool schema nặng | `_EIR_CORE_TOOLS` ~35 entry trên MỌI call (~8–12k token) |
| 3 | Đa agent thiếu chuẩn cô lập | dispatcher mặc định nằm trong gateway (điểm sụp); chưa có luật isolation thành văn |
| 4 | ~~God-files~~ | ✅ Eir đã giải (facade + siblings + ratchet) — bỏ phase |
| 5 | ~~UI CLI/TUI phức tạp~~ | thu gọn thành: default TUI + wizard 3 câu; slash 82 lệnh GIỮ NGUYÊN |

## 2. Nhật ký quyết định (mọi thứ đã chốt)

| # | Quyết định | Ngày |
|---|---|---|
| 1 | Desktop = **Claude-style layout**, giữ brand (accent gold, nền trung tính ấm) | — |
| 2 | Cron → **"Scheduled"** nav / "Scheduled tasks" heading / "Schedule a task" CTA; route `/cron` + `cronjob_manage` giữ, alias `/scheduled` | — |
| 3 | Terminology label-only: Gateway → "Connection", Toolset → "Tools" | — |
| 4 | Slash commands **giữ nguyên 82** — bỏ tier hóa | 15/11 |
| 5 | **Bỏ role/profile** — skills + MCP + `tool_search` đã thay vai trò phân chia | 16/11 |
| 6 | Tool surface chia theo **tính năng × mức độ quan trọng** (T1/T2/T3) | 16/11 |
| 7 | Starter/essential tools **pre-baked trong build** (delivery guarantee) | 15/11 |
| 8 | Đa agent: **tương tác qua broker bền, độc lập, không sụp dây chuyền** (L1–L5) | 16/11 |
| 9 | Điều phối = **2 lớp**: dispatcher process cơ học (luôn sống) + coordinator agent thông minh (chết = suy giảm, không sụp) | 16/11 |
| 10 | Coordinator **respawn giữ nguyên context**: state nằm ngoài coordinator (board + journal + lease) | 16/11 |
| 11 | KHÔNG làm: persistent subagent process, message bus mới, RPC peer-to-peer | 16/11 |
| 12 | Mọi default mới có escape hatch 1 dòng; không hard-delete khi chưa có xác nhận | — |

**Chờ chốt 2 điều cuối:** pet + starmap (flag hay xoá), command-center (overlay / giữ trang / giấu).

---

## 3. Các Phase

### D0 — Design system (~2 ngày, 1 PR) — ✅ DONE 16/11
- `apps/shared/src/theme-presets.ts`: palette `claude` (light + dark) — nền kem ấm `#faf9f5`/`#262624`, gold accent `#8a6508` (light, ↓ từ brand `#D89B04` vì chỉ đạt ~2:1 trên kem — cùng vấn đề goldenrod ladder của CLI) / `#e3b341` (dark, lift như nous `#0053fd`→`#4a84fe`), contrast ≥4.5:1 đã tính.
- `apps/desktop/src/themes/presets.ts`: `claudeTheme` + đăng ký đầu `BUILTIN_THEMES` (nổi bật nhất picker; `DEFAULT_SKIN_NAME` vẫn `nous` đến D1 — logic #76579).
- Không cần wiring thêm: `accents.ts`/`backend-sync.ts` generic theo tên; precedent `classic` = desktop builtin không cần CLI skin. Web dashboard có registry riêng — parity để Phase 5.
- **Audit token:** 116 file `components/ui/*`, chỉ 2 literal thật: dot amber `pane-tab.tsx` + inset shadow `dialog.tsx`. Amber là warning de-facto toàn app (plugins, update-status, kanban dùng cùng) → thêm token `--ui-warning` đòi đổi `DesktopThemeColors` + 12 preset → **defer sang D2** (dù vậy sẽ đụng DESIGN.md named contract). Không phải blocker D0.
- **Verify:** desktop `src/themes/` 149 test pass; web themes 5 pass; typecheck desktop + web xanh.
**Accept (hiệu chỉnh):** palette 1 nguồn ở shared, 0 token mới cần thêm — hardcode còn lại là convention amber toàn app, xử lý ở D2.

### D1 — Chat-first shell: 10 routes → 4 mục sidebar (~3 ngày, 1 PR) — ✅ DONE 18/11
**Discovery chính:** desktop ĐÃ có hệ Simple/Advanced mode (`src/store/interface-mode.ts`) — Simple chính là chat-first shell trong plan (ẩn statusbar/panes/technical payloads, ẩn rows artifacts+cron, mọi route vẫn ⌘K, reveal hệ thống có sẵn). D1 thực chất = flip default + chỉnh tier, KHÔNG xây từ đầu.
**Đã chốt (17/11):** default → simple (mọi user, escape = 1 click Advanced trong picker, persisted); pet+starmap → flag `desktop.extras` default false; command-center → overlay như hiện tại (0 code).
**Đã làm:**
- `interface-mode.ts`: `DEFAULT_INTERFACE_MODE = 'simple'` + codec decode/encode flip (simple = no-record, advanced = record persisted); tests cập nhật contract mới (persistence, reload, tiers)
- Sidebar tiers: `cron` hiện ở Simple (Scheduled = mục cốt lõi), `messaging` ẩn ở Simple (⌘K vẫn tới)
- `desktop.extras`: default trong `config_defaults.py` (schema auto-generate); store `desktop-extras.ts` mirror từ `useEirConfig` (chạy trên connect/scope switch/config.changed); gate FloatingPet + starmap overlay + 3 palette entries (starmap, pets, generate-pet); types + docs `website/docs/user-guide/desktop.md`; vitest contract 6 test
- Ripple triage sau flip: 16 test pin Advanced contract bằng `setInterfaceMode('advanced')` (setter cũng đổi layout scope — `$interfaceMode.set` không đủ cho `modeLayout`-bound keys); 7 fail còn lại pre-existing trên main sạch (plugin-preview, plugin-source-urls, fallback-model, dead-session-prune, profile-remote-override, voice-prefs, prepared-submissions) — ngoài scope
**Verify:** full `ui` lane xanh trừ 7 pre-existing; typecheck + eslint xanh; Python docs-drift/config/slash-registry 202 pass
**Accept (hiệu chỉnh):** mở app = transcript + composer + sidebar (Simple); mọi view ≤ 2 keystroke (palette đã có đủ nav entries); `isDesktopSlashExtensionCommand` nguyên vẹn; 2 picker merge → D2 (composer-centric).

### D2 — Composer-centric + auto panes (~3 ngày, 1 PR) — ✅ DONE 18/11
**Discovery:** model picker đã trong composer, session list actions qua context menu, ⌘K nav, keybind → palette đều đã có sẵn (0 code). Việc còn lại là 2 mảnh:
- `titlebar-session-status.tsx`: pill titlebar mang 2 readout còn lại — gateway dot (socket truth, tone open/connecting/else; click → Command Center system section) + context % (cùng pipeline `useContextBreakdown`/`ContextUsagePanel` với statusbar gauge, estimate → measured breakdown). Mount đúng khi statusbar unmount (Simple) nên 2 surface không nhân đôi readout; đặt cạnh `TitlebarControls` bằng CSS vars của wiring.
- `pane-focus.ts` + `desktop-bridge.ts`: agent spotlight — reveal tiếp theo của agent (active session `pane.reveal`, `spotlight: true`) tự đóng pane agent đã reveal trước đó (chỉ files/review/terminal, dùng `closeTreePane` = closer đã đăng ký). Gate ở Simple; tour/layout pick không mang flag nên không bao giờ đóng gì; không auto-close khi turn end (attention theft).
**Verify:** `pane-focus.spotlight.test.ts` 3 test + `titlebar-session-status.test.tsx` 4 test; full `ui` lane.
**Accept:** chrome < 15% ngang (pill ~60px, ẩn khi statusbar hiện); vitest xanh.

### D3 — Settings 22 → 5 tabs (~4 ngày, 1 PR)
General / Models & Keys / Features / Sessions / About & Gateway. Raw config editor = mục "Advanced".
**Accept:** mọi setting ≤ 2 click; không panel > 600 dòng.

### D4 — Onboarding 3 bước ≤ 90s (~2 ngày, 1 PR)
Model + key (Test ✓) → messaging (Skip) → vào chat, composer focus "Try: /help". Không hỏi role.
**Accept:** install → reply đầu ≤ 90s; ≤ 3 màn; skip trừ bước 1.

### Phase 2 — CLI default + fast wizard (3–4 ngày, 2 PR)
`hermes`/`eir` mặc định = TUI (đổi 1 fallback literal); `--classic` opt-out. Fast wizard 3 câu; wizard cũ = `--advanced`; user có config skip hoàn toàn. Slash giữ nguyên.
**Accept:** diff ≤ 10 dòng; 0 thay đổi hành vi slash.

### Phase 3 — Tool tiers + delivery (1–1.5 tuần, 3 PR)

**T1 — Essential, luôn trong schema (~14 tool, ↓ ~70% token):**
`web_search, web_extract, terminal, process_manage, read_file, write_file, patch, search_files, skills_list, skill_view, skill_manage, todo_list, memory, clarify, tool_search`

**T2 — Important, defer qua `tools.tool_search.defer` (1 nhịp khi cần):**
`session_search, execute_code, delegate_task, cronjob_manage, browser_exec, browser_cdp, browser_dialog, browser_vault, vision_analyze, image_generate, text_to_speech, manage_connections`

**T3 — Optional, không bao giờ tự hiện:**
`kanban_*` (15), `computer_use`, platform tools (`ha_*`, `discord`, `feishu_*`, `spotify_*`, `yuanbao_*`), MCP catalog

Phân tầng = data/config, không phải code; chốt lúc đầu phiên → caching an toàn.

**Delivery guarantee (3.7):** T1 pre-baked — `ddgs` vào base deps (web_search keyless day-1); `hermes doctor` verify T1 14/14; web_extract không key → message hướng dẫn thay crash; 0 lazy prompt giữa chat; CI smoke `tests/tools/test_starter_delivery.py` (behavior contract).

**Lưu ý repo:** đổi `tools[]` phải kèm `scripts/ci/prompt_surface.py render` + fixture approval (`tests/ci/test_prompt_surface.py`).

**Accept:** schema ↓ ≥ 60% (baseline đo trong PR); defer tools discover được E2E; doctor xanh trên install thuần không key; Docker image web_search day-1.

### Phase 3.5 — Multi-agent isolation (0.5–1 tuần, 2 PR + docs)
- Đổi default `dispatch_in_gateway: false` → dispatcher process riêng (systemd unit có sẵn)
- Docs chuẩn **L1–L5**: (L1) giao tiếp qua broker bền, không gọi peer trực tiếp; (L2) failure = trạng thái task (block/retry), không phải crash hệ thống + failure_limit; (L3) liveness = heartbeat + pid; (L4) truyền summary ngắn có cấu trúc, không transcript; (L5) mỗi agent 1 context + timeout + hard interrupt riêng
- E2E: kill dispatcher → reclaim; kill worker → task retry, fleet sống; kill gateway → cron vẫn tick
- KHÔNG thêm message bus / RPC / mesh

### Phase 3.6 — Fleet Coordinator (tùy chọn, ~1.5 tuần, 2 PR + 1 skill)
Gated `fleet.coordinator.enabled`:
- **2 lớp:** dispatcher process (cơ học, luôn sống) + coordinator agent (LLM, chết = suy giảm)
- **State ngoài coordinator:** sứ mệnh = task meta trên board; quyết định = comments append-only (`[lease-token] task-id quyết định`); lease `<home>/fleet/.coordinator.lock`
- **Respawn:** sentinel cron tick phát hiện lease hết hạn → chiếm lock (token mới) → spawn lại profile → ritual đọc (mission → journal cuối → pending) → tiếp đúng việc treo
- **Chống sập:** F1 lease token vô hiệu hoá zombie; F2 backoff ×2 chống respawn-storm; F3 quyết định idempotent theo task-id
- Coordinator = profile + cron heartbeat + skill + toolset kanban → **0 code core, 0 schema mới**
- E2E: `kill -9` coordinator giữa 2 nhịp → ≤ lease_seconds có instance mới, 0 task trùng

### Phase 4 — ~~God-file refactor~~ — ĐÃ BỎ
Eir đã có facade + siblings + size ratchet (file ≤ 2,000 dòng, CC ≤ 20). Chỉ verify trong Phase 5.

### Phase 5 — Terminology + verification (song song)
- i18n: Scheduled / Connection / Tools (en + ja + zh + zh-hant); grep "Cron" ngoài advanced = 0; alias `/scheduled`
- Mỗi phase: `scripts/run_tests.sh` (không bare pytest) + `python scripts/check` + desktop typecheck/vitest
- E2E temp `EIR_HOME`: install → wizard → chat → tool → Scheduled task → delivery
- Invariants: prompt caching byte-stable; toolset chỉ đổi đầu phiên; strict alternation; không đụng `requestGateway` transport; 3 điểm compose đa agent chạy đúng (cron→delegate, kanban worker, process handoff)
- Docs sync: `website/docs/developer-guide/` + area `AGENTS.md` khi symbol đổi

---

## 4. Thứ tự + tổng

```
D0 → D1 → D2 → D3 → D4            desktop ~2 tuần
→ Phase 2 (3–4 ngày) → Phase 3 (1–1.5 tuần)
→ Phase 3.5 (0.5–1 tuần) → Phase 3.6 tùy chọn (1.5 tuần)
→ Phase 5 song song
```
**Tổng ~5–6 tuần, ~15 PR** — 3.6 tùy chọn +1.5 tuần. Mỗi PR độc lập, revert được.

## 5. Nguyên tắc bất biến xuyên suốt

1. Base state tối thiểu → summon đúng lúc → dissolve sau dùng (cùng nguyên lý ở 3 tầng: schema / agent / UI)
2. Không xóa năng lực — chỉ ẩn/tầng lại
3. Lõi agent không đụng; caching + narrow waist tuyệt đối
4. State của mọi thứ dài sống nằm trên đĩa/board, không trong RAM
5. Hard-delete chỉ khi có xác nhận từng mục
