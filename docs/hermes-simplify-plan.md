# PLAN CHI TIẾT — Eir "Simplify" (bản để review)

> Trạng thái: CHỜ REVIEW. Chưa thi công.
> Sau khi duyệt: switch agents ra khỏi Plan mode để bắt đầu Phase D0.
> Ngày lập: 15/11/2026. Base: `agent-core` @ main.

---

## 0. Bối cảnh & Audit (số liệu thật, 15/11/2026)

### 0.1. Vấn đề bạn đưa ra
1. Project quá phức tạp
2. Quá nhiều function, một phần thường không cần cho user
3. UI quá phức tạp, không thân thiện → **xác định lại: trọng tâm là DESKTOP APP**

### 0.2. Audit desktop app (`apps/desktop/`)

| Chỉ số | Giá trị |
|---|---|
| Tổng code TS/TSX | ~133,000 dòng / 666 file |
| Top-level routes | 10 views (chat, settings, command-center, skills, messaging, artifacts, cron, profiles, agents, starmap) |
| Overlays | 7+ (command-palette, model-picker, model-visibility, session-picker, session-switcher, updates, pet-overlay) |
| Chrome quanh chat | 6 vùng (left sidebar 1,414 dòng; right-rail preview 977; right-sidebar 3 tab; titlebar; statusbar; các menu panel) |
| Settings | ~22 panel riêng (model-settings 990 dòng) |
| Ngoài lề | Virtual pet (4 cụm), starmap (974 dòng canvas + simulation + share) |
| i18n | 5 ngôn ngữ × ~2,300 dòng ≈ 11,400 dòng |
| Store | 54 atom file |
| File to nhất | i18n zh 2,455; sidebar 1,414; desktop-controller 1,241; composer 1,026 |

### 0.3. Audit tổng project

| File | Dòng | Ghi chú |
|---|---|---|
| `gateway/run.py` | 19,670 | god-file #1 |
| `cli.py` | 15,944 | god-file #2 (AGENTS.md ghi sai ~11k) |
| `eir_cli/main.py` | 13,657 | god-file #3 |
| `eir_state.py` | 5,826 | |
| `run_agent.py` | 5,962 | AGENTS.md ghi sai ~12k — docs cần cập nhật |
| Tool files | 89 file / ~67 tool / 33 toolset | phần lớn đã opt-in hoặc check_fn-gated |
| Slash commands | 82 | nguồn nhiễu #2 |
| Bề mặt chat | 4 (CLI prompt_toolkit, TUI Ink, web dashboard, desktop Electron) | phân mảnh |

### 0.4. Kết luận "up to date" kiểm tra
Lõi agent (nén ngữ cảnh, prefix caching, skills, subagents, MCP catalog, 3 API modes) **hiện đại, đạt chuẩn 2026** — KHÔNG đụng. Mọi vấn đề nằm ở bề mặt: god-files, tool/lệnh phóng uế, UI phân mảnh.

---

## 1. Quyết định đã CHỐT (từ thảo luận)

| # | Quyết định |
|---|---|
| 1 | Desktop UI theo **Claude-style layout**, giữ brand Eir (accent gold, nền trung tính ấm) |
| 2 | Cron → **"Scheduled"** (nav) / **"Scheduled tasks"** (heading) / **"Schedule a task"** (CTA) / **"Nothing scheduled yet"** (empty state) |
| 3 | Route `/cron`, tool `cronjob`, code symbols: KHÔNG đổi — chỉ label + alias |
| 4 | Terminology pass: Gateway → "Connection", Toolset → "Tools" (label only) |
| 5 | Pet + starmap: ẩn sau `desktop.extras: false` *(mặc định đề xuất — review để đổi thành xoá hẳn)* |
| 6 | Command-center: hạ thành overlay *(review để đổi)* |
| 7 | Mọi thay đổi default có escape hatch 1 dòng config |
| 8 | Không hard-delete năng lực nào; chỉ ẩn/tier lại |

## 2. Quyết định ĐANG CHỜ bạn chốt khi review

1. Pet + starmap: **giấu flag** (đề xuất) hay **xoá code**?
2. Command-center: **overlay** (đề xuất) hay cũng ẩn flag?
3. Primary surface: desktop trước (đề xuất), CLI/TUI phase 2 — có cần đổi thứ tự không?
4. ~~Danh sách ~15 slash command core~~ → **ĐÃ CHỐT 15/11: giữ nguyên 82 lệnh, bỏ tier hóa**

---

# PHASE D0 — Design system base

**Mục tiêu:** một theme file điều khiển toàn bộ visual trước khi đổi layout.

**Hiện trạng:** `src/themes/` có nhiều theme; không có tokens thống nhất (spacing/radius/font-size rải rác từng component).

**Việc làm:**
1. Tạo `src/themes/claude.ts` — design tokens:
   - Palette: nền trung tính ấm (cream/off-white), text gần-đen, 1 accent = gold Eir, trạng thái (success/warn/danger)
   - Spacing scale: 4/8/12/16/24/32
   - Radius: 8px (input/small) / 12px (card/composer) / full (pill)
   - Border: 1px mảnh, màu border ≈ nền tối 8%
   - Typography: body 14px, transcript 15px, heading 16-18px; line-height 1.6
2. Áp tokens vào `components/ui/*` (46 primitives) — đổi giá trị hardcode thành token
3. Đặt `claude` làm default theme; theme cũ giữ opt-out

**Final result:** toàn app đổi màu/độ bo/font đồng bộ — CHƯA đổi layout, chưa có gì di chuyển.

**Accept:**
- [ ] Không còn hardcode màu/px trong `components/ui/*` (grep check)
- [ ] 1 file theme điều khiển toàn bộ
- [ ] `npm run typecheck` + vitest xanh

**Rủi ro:** thấp. Ước lượng: 2 ngày, 1 PR.

---

# PHASE D1 — Chat-first shell: 10 routes → 3 views + sidebar

**Mục tiêu:** mở app chỉ thấy chat. Mọi thứ khác ≤ 2 keystroke.

**Hiện trạng:** nav 10 routes; 2 model picker khác nhau; 2 session picker khác nhau; pet/starmap chiếm route.

**Layout đích (Claude-style):**

```
┌────────────────────────────────────────────────────────┐
│ ☰  Eir                    (⌘K)              ◔ ⚙ ✕  │
├─────────┬──────────────────────────────────────────────┤
│ + New   │                                              │
│         │        TRANSCRIPT (centered, max-width)      │
│ Today   │                                              │
│  • ...  │                                              │
│ Earlier │                                    ┌───────┐ │
│  • ...  │                          artifact ◀│ files/│ │
│         │                                    │ review│ │
│ ─────── │  ┌──────────────────────────────┐ │       │ │
│ Scheduled│ │ ▤ attach  model ▾   ⏎ send  │ └───────┘ │
│ Skills ▢│  └──────────────────────────────┘           │
└─────────┴──────────────────────────────────────────────┘
```

**Việc làm:**
1. Sidebar 1 cột thu gọn (toggle ☰): **New chat** + session list + quick links **Scheduled**, **Skills**. Bỏ nav rail 10 mục.
2. Hạ cấp thành overlay (giữ code, mở qua ⌘K palette / slash): command-center, skills, messaging, artifacts, profiles, agents. Routes `routes.ts` giữ — chỉ đổi entry points.
3. Pet + starmap: guard sau `desktop.extras` (store mới hoặc `settings` config) — mặc định ẩn.
4. Gộp picker: model-picker + model-visibility-overlay → 1 (đặt trong composer — chuyển sang D2 hoàn tất); session-picker + session-switcher → 1 component, dùng chung ⌘K palette.
5. Cập nhật `desktop-slash-commands.ts` khớp nav mới (block-list hiện có giữ nguyên — `isDesktopSlashExtensionCommand` không đụng; Phase 2 đã quyết KHÔNG tier hóa slash).

**Final result:** idle screen = transcript + composer + sidebar (4 nhóm nội dung). Titlebar còn: ☰, ⌘K, gateway dot, ⚙, window controls.

**Accept:**
- [ ] Sidebar ≤ 4 nhóm; nav rail = 0
- [ ] Mọi view bị demote vẫn mở được ≤ 2 hành động (palette / slash)
- [ ] `desktop.extras: true` khôi phục UI đầy đủ hôm nay
- [ ] Skill commands + quick commands vẫn hiện trong palette (test `desktop-slash-commands.test.ts` xanh KHÔNG sửa assertion cắt chức năng)
- [ ] Deep-link `/cron`, `/skills`... vẫn hoạt động → redirect sang overlay

**Rủi ro:** trung bình (đổi layout gốc) — bù: routes giữ, chỉ đổi entry. Ước lượng: 3 ngày, 1 PR.

---

# PHASE D2 — Composer-centric + auto panes

**Mục tiêu:** vùng chrome quanh transcript từ ~6 → 2 (sidebar + composer).

**Hiện trạng:** left sidebar 1,414 dòng có actions per-row; right-rail preview luôn sẵn; right-sidebar 3 tab (review/files/terminal) thường trực; titlebar có model-menu-panel + model-edit-submenu; statusbar-controls riêng.

**Việc làm:**
1. **Composer chứa model picker** (dropdown như mockup D1); xoá model-menu-panel khỏi titlebar. Titlebar còn: gateway status dot + context %.
2. **Right pane auto-on-demand:** dùng lại `pane-shell` + `right-sidebar` — đổi trigger:
   - Agent đọc/ghi file → panel Files mở, đóng khi 30s không hoạt động
   - Agent chạy terminal → panel Terminal mở
   - Có review/diff → panel Review mở
   - Manual override: kéo mở/đóng tay, state lưu `store/layout.ts`
3. **Session list thu gọn:** title + time + pin. Bỏ nút actions per-row → context-menu (right-click). Giảm `chat/sidebar/index.tsx` 1,414 dòng xuống ≤ ~700.
4. Keybind panel → di chuyển vào palette (tab "Keys").
5. StatusbarControls gộp vào titlebar (1 hàng chrome duy nhất trên).

**Final result:** mặc định: transcript + composer + sidebar. Panel phải chỉ xuất hiện khi agent cần (hoặc user kéo).

**Accept:**
- [ ] Chrome < 15% chiều ngang window (đo ở 1440px)
- [ ] Composer chiếm ≥ 40% chiều cao ở 900p
- [ ] Panel phải không tự hiện nếu agent không đụng file/terminal/review
- [ ] `npm test` desktop (vitest repo-root) xanh; typecheck xanh

**Rủi ro:** trung bình. Ước lượng: 3 ngày, 1 PR.

---

# PHASE D3 — Settings: 22 panels → 5 tabs

**Mục tiêu:** settings home = 5 tab; mọi setting ≤ 2 click.

**Nhóm đích:**

| Tab | Gộp từ panels hiện có |
|---|---|
| **General** | appearance, notifications, pet (nếu giữ), human_delay |
| **Models & Keys** | model-settings (990 dòng → tách con-tab), providers, env-credentials, keys |
| **Features** | skills, memory, mcp, toolset-config-panel, computer-use |
| **Sessions** | sessions-settings, config-settings (→ 1 mục "Advanced"), privacy |
| **About & Gateway** | gateway-settings, updates, about, uninstall |

**Việc làm:**
1. Settings index đổi thành 5 tab; mỗi tab = 1 scroll-height, top-3 setting inline, phần còn disclosure rows
2. Panel > 600 dòng (model-settings) tách: chọn model + presets ở tab; provider chi tiết → disclosure
3. Config raw editor giữ nguyên chức năng, thành mục "Advanced" trong tab Sessions

**Final result:**

```
┌ Settings ──────────────────────────────────────────────┐
│ [General] [Models & Keys] [Features] [Sessions] [About]│
│                                                        │
│  Appearance      ● light  ○ dark  ○ auto               │
│  Notifications   [x] tool done  [ ] gateway events     │
│  ...                                                   │
└────────────────────────────────────────────────────────┘
```

**Accept:**
- [ ] Settings home hiện 5 tab (không còn list 22 links)
- [ ] Mọi setting ≤ 2 click (tab → row)
- [ ] Không file settings > 600 dòng sau gộp
- [ ] Uninstall vẫn tìm được (1 click từ About)

**Rủi ro:** thấp-trung (dời panel, không đổi logic). Ước lượng: 4 ngày, 1 PR.

---

# PHASE D4 — Onboarding 3 bước ≤ 90 giây

**Mục tiêu:** fresh install → trả lời đầu tiên ≤ 90s, 0 sửa config tay.

**Hiện trạng:** `components/onboarding` + `store/onboarding.ts` (927 dòng) — flow dài, có bước giới thiệu pet.

**Việc làm:**
1. Flow rút còn 3 bước:
   - 1/3: chọn model + paste key + nút **Test** (xanh ✓ mới cho đi tiếp)
   - 2/3: gắn messaging (Telegram/Discord...) — nút **Skip** nổi bật
   - 3/3: xong → vào chat NGAY, composer focus, placeholder gợi ý: `Try: /help`
2. Bỏ mọi bước giới thiệu pet/starmap/extras
3. Giữ skip ở mọi bước trừ bước 1

**Final result:** 3 màn hình → chat.

**Accept:**
- [ ] Onboarding ≤ 3 screens
- [ ] Đo thời gian install → reply đầu tiên ≤ 90s (manual E2E)
- [ ] Post-onboarding = đúng idle screen D1

**Rủi ro:** thấp. Ước lượng: 2 ngày, 1 PR.

---

# PHASE 2 — CLI/TUI default + fast wizard (BẢN CHI TIẾT)

*(Desktop xong mới làm — desktop là primary surface.)*

**Mục tiêu:** `eir` = TUI; wizard 3 câu hỏi. Slash commands **giữ nguyên 82 lệnh** (quyết định 15/11/2026 — không tier hóa).

---

## 2.1. Đổi default UI sang TUI

**Cơ chế hiện có (`eir_cli/main.py:111-168`) — KHÔNG viết mới, chỉ đổi giá trị:**

```
Thứ tự chọn UI hôm nay:
  1. `eir --cli`          → classic CLI (prompt_toolkit)
  2. `eir --tui` hoặc env EIR_TUI=1 → TUI (Ink)
  3. KHÔNG set gì            → classic CLI   ← ĐỔI ĐIỂM DUY NHẤT ở đây

Sau Phase 2.1:
  1. `eir --cli`          → classic CLI  (giữ nguyên)
  2. `eir --tui` / env    → TUI          (giữ nguyên)
  3. KHÔNG set gì            → TUI          ← mặc định mới
  4. `eir --classic`      → alias mới cho --cli (tên dễ hiểu hơn)
```

**Trải nghiệm user:**

| Ai | Trước | Sau |
|---|---|---|
| User mới gõ `eir` | CLI kawaii + 82 lệnh autocomplete | TUI sạch, composer như chat app |
| User cũ muốn CLI cũ | mặc định | `eir --classic` hoặc `display.interface: cli` 1 dòng |
| Script/CI (`eir ... > log`) | | Tự detect stdout redirect — giữ hành vi nhánh non-TTY như hiện tại (code đã có guard `EIR_TUI_NO_EARLY_DISABLE`) |

**Config viết trong `~/.eir/config.yaml`:**
```yaml
display:
  interface: cli   # opt-out — user cũ dán dòng này là về bản cũ
```

**Việc code:** 1 hàm fallback trong `main.py` (đổi default literal) + alias `--classic` + release note. KHÔNG đổi `ui-tui/`, KHÔNG đổi `tui_gateway/`.

---

## 2.2. Slash commands — QUYẾT ĐỊNH: giữ nguyên (bỏ tier hóa)

**Quyết định 15/11/2026 (user chốt):** giữ nguyên hành vi hôm nay — autocomplete + `/help` hiện đủ 82 lệnh. KHÔNG thêm field `tier`, KHÔNG ẩn lệnh nào.

Lý do giữ: lệnh gõ tay luôn chạy được dù ẩn, nhưng ẩn gây "mất tìm kiếm" cho user đã quen; autocomplete đủ 82 không phải vấn đề thật so với chi phí đổi + rủi ro hơi nhầm lẫn. (Nếu sau này muốn reconsider: thiết kế tier đã được ghi ở git history của plan này.)

**Tác động lên các phần khác của plan:**
- Desktop D1: `desktop-slash-commands.ts` KHÔNG đổi vì tier — chỉ giữ nguyên block-list hiện có (`isDesktopSlashExtensionCommand` không đụng)
- Telegram BotCommand menu + Slack map: giữ nguyên như hôm nay
- Phase 5 terminology: vẫn đổi LABEL "Cron" → "Scheduled" — điều đó vẫn nằm trong 82 lệnh, không tier

---

## 2.3. Fast wizard — 3 câu hỏi

**Hiện trạng:** `eir_cli/setup.py` 3,416 dòng, hỏi ~15+ mục (provider, model, key, memory, vision, tts, gateway, platform từng cái...).

**Fast path mới (mục `eir setup` mặc định):**

```
┌ Bước 1/3 ────────────────────────────────────┐
│ Chọn model:                                  │
│  ❯ Nous Portal (khuyên dùng — có key miễn phí)│
│    OpenRouter   OpenAI   Endpoint riêng      │
│ Dán API key: sk-••••••••        [Test ✓]    │
└──────────────────────────────────────────────┘
┌ Bước 2/3 ────────────────────────────────────┐
│ Nhắn tin qua Telegram/Discord?               │
│   [ Skip — chat trên máy trước ]   [ Gắn ]  │  ← Skip nổi bật
└──────────────────────────────────────────────┘
┌ Bước 3/3 ────────────────────────────────────┐
│ Thư mục làm việc mặc định?                   │
│   ~/Documents  [Enter dùng thư mục này]      │
└──────────────────────────────────────────────┘

→ ghi config tối thiểu vào ~/.eir/config.yaml:
  model: <chọn>          # + key vào .env
  # KHÔNG ghi gì khác — mọi thứ dùng DEFAULT_CONFIG

→ vào chat. Placeholder: "Try: /help"
```

**Điều kiện nhánh:**
- Đã có config hợp lệ (`model` + key) → **bỏ qua wizard**, vào chat luôn (user cũ không bị hỏi lại)
- `eir setup --advanced` → wizard đầy đủ hôm nay (giữ nguyên 3,416 dòng, không đụng)

**Final result Phase 2:**

```
TRƯỚC: eir → CLI quen thuộc, wizard 15 câu
SAU:   eir → TUI chat-app, wizard 3 câu ≤ 90s, 82 lệnh giữ nguyên
       eir --classic → nguyên trạng hôm nay
```

**Accept mở rộng:**
- [ ] Đổi default chỉ nằm 1 hàm trong `main.py` (diff ≤ 10 dòng)
- [ ] `--classic` chạy nguyên vẹn; test suite CLI xanh không sửa
- [ ] Slash commands: 0 thay đổi hành vi — autocomplete + `/help` nguyên trạng (test xanh KHÔNG sửa)
- [ ] Wizard fast: ≤ 3 màn; user đã có config → skip hoàn toàn
- [ ] E2E install → reply đầu ≤ 90s (temp EIR_HOME)

**Ước lượng:** 3–4 ngày, 2 PR (PR1: default UI; PR2: fast wizard).

---

# PHASE 3 — Tool profiles (BẢN CHI TIẾT)

**Mục tiêu:** schema gửi đi mỗi API call chỉ chứa tool user thực dùng → rẻ hơn, model ít nhiễu hơn, UI `eir tools` 1 phím chọn.

---

## 3.1. Khái niệm — giải thích đơn giản

**Profile = "bộ đồ nghề" theo việc bạn làm.** Hôm nay mọi user nhận cùng một chồng ~50 tool trong mọi API call, kể cả người chỉ chat + tìm web. Profile đổi điều đó:

| Profile | Cho ai | Tool trong schema |
|---|---|---|
| **starter** | user mới, chat thường ngày | ~15 (list dưới) |
| **coding** | đang đứng trong repo/code workspace | starter + browser + vision + delegate + process (~30) — **toolset này ĐÃ TỒN TẠI** `toolsets.py:346`, chỉ áp mặc định đúng lúc |
| **full** | power user | như hiện tại (~50) |
| **custom** | tự chọn | danh sách tự định nghĩa qua `eir tools` |

**Config:**
```yaml
tools:
  profile: starter   # starter | coding | full | custom
```

**Danh sách tool `starter` (chốt để review — 15 tool):**

```
web_search, web_extract          # tra mạng
terminal, process                # chạy lệnh
read_file, write_file, patch, search_files   # file
todo                             # kế hoạch
memory                           # nhớ
skills_list, skill_view          # skill
clarify                          # hỏi lại
execute_code, delegate_task      # chạy code + ủy quyền
```

KHÔNG có trong starter: browser (13 tool), vision, image/video gen, tts, cronjob, session_search, ha_*, kanban_*, computer_use, read_terminal, close_terminal. → User vẫn chạm được khi cần: agent tự khuyên bật toolset (tin nhắn giải thích) hoặc user chạy `/tools` — nhưng **schema mặc định gọn**.

---

## 3.2. Chuỗi resolution — cách profile quyết định schema

```
Profile (tools.profile)                      ← tầng 1: mặc định theo loại user
   ↓ override khi:
Code workspace detect (coding_context.py)    ← tầng 2: auto coding (ĐÃ CÓ, giờ áp mặc định)
   ↓ override khi:
tools.<platform>.enabled / disabled lists    ← tầng 3: user chọn tay từng toolset (giữ nguyên)
   ↓ lọc cuối:
check_fn per-tool (token/env gate)           ← tầng 4: tool thiếu key tự ẩn (ĐÃ CÓ)
   ↓
= SCHEMA gửi lên API (final)
```

**Ví dụ điển hình (worked example):**

| Tình huống | Tầng 1 | Tầng 2 | Tầng 3 | Kết quả schema |
|---|---|---|---|---|
| User mới, chat Telegram | starter | — | — | 15 tool |
| Dev mở `agent-core/` trong CLI | starter | auto→coding | — | ~30 tool |
| Dev tùy chỉnh thêm browser | starter | coding | +browser | ~31 tool |
| Power user set `full` | full | — | — | ~50 tool như hôm nay |
| User mới + chưa có HASS_TOKEN | starter | — | — | 15 tool (`ha_*` vốn gate sẵn — không đổi) |

---

## 3.3. Chi phí — vì sao đáng làm (số ước tính, đo lại trong PR)

Ước lượng thô: 1 tool schema ≈ 150–250 token (mô tả + params). Mọi API call đều mang chúng:

| Profile | Tool | Token schema/call (ước tính) | So với hôm nay |
|---|---|---|---|
| Hôm nay (core bundle) | ~50 | ~8k–12k | — |
| starter | 15 | ~2.5k–4k | **↓ ~60–70%** |
| coding | ~30 | ~5k–7.5k | ↓ ~35% |

Lợi ích kép: (1) chi phí giảm trực tiếp, (2) model chọn tool ít nhiễu hơn → đúng tool hơn. Con số thật đo bằng `get_tool_definitions()` đếm token trong PR — ghi vào PR description làm baseline.

---

## 3.4. `eir tools` — quick select profile

**Hiện trạng:** curses UI (`eir_cli/tools_config.py`, pattern chuẩn — KHÔNG simple_term_menu) hiện toolset từng cái, phải hiểu khái niệm.

**Sau Phase 3:**

```
┌ Tool profile ────────────────────────────────────────────┐
│  ❯ Starter (recommended — chat + web + file + terminal)  │
│    Coding  (auto khi vào code workspace)                 │
│    Full    (mọi tool — như cũ)                           │
│    Custom  (tự chọn từng toolset)                        │
└──────────────────────────────────────────────────────────┘

Chọn Custom → vào danh sách toolset từng cái (UI hiện tại giữ nguyên làm tầng dưới)
```

**Việc code:** thêm 1 màn hình curses phía TRÊN UI hiện có; UI cũ giữ nguyên thành "Custom" mode → không phá gì.

---

## 3.5. Config viewer — nhóm cốt / advanced

**Hiện trạng:** `eir_cli/config.py` ~3,000 dòng, DEFAULT_CONFIG ~40 section ngang hàng — đọc config như đọc code.

**Việc:** KHÔNG đổi cấu trúc DEFAULT_CONFIG (tránh migration đau). Chỉ thêm **thứ tự + metadata nhóm hiển thị**:

- Nhóm "core hiển thị" (≤ 30 key): `model`, `agent.*` (max_iterations...), `terminal.cwd`, `tools.profile`, `display.interface`, `memory.provider`, `gateway.port`, cron cơ bản...
- Còn lại đánh dấu `advanced` trong docs + `eir config` viewer (2 cột: Core | Advanced)

Key mới `tools.profile` → thêm vào DEFAULT_CONFIG, **không bump `_config_version`** (key mới đi qua deep-merge tự động — rule có sẵn trong AGENTS.md).

---

## 3.6. (Tùy chọn — review thêm) Dọn `_EIR_CORE_TOOLS`

3 nhóm tool nằm trong bundle core nhưng đã gate sẵn bằng `check_fn`:

| Tool | Gate hiện có | Đề xuất |
|---|---|---|
| `ha_*` (4) | `HASS_TOKEN` | Kéo khỏi core bundle → toolset `homeassistant` riêng, chỉ bật khi user cấu hình |
| `kanban_*` (9) | env `EIR_KANBAN_TASK` / toolset flag | Giữ nguyên (đã zero-footprint thực tế) — chỉ cân nhắc |
| `computer_use` | cua-driver installed | Kéo khỏi core → toolset `computer_use` riêng (đã có toolset) |

Lợi ích chỉ là "sạch danh sách" (schema vốn 0 footprint khi gate đóng) — **duyệt hay bỏ đều được**, không chặn PR chính.

---

## 3.7. Delivery guarantee — starter tools pre-baked vào build

**Yêu cầu (user chốt 15/11/2026):** tool cơ bản của starter phải **pre-implement sẵn trong build** — cài xong chạy đúng ngay lần đầu, KHÔNG dựa vào lazy-install lúc đang chat, KHÔNG bắt user sửa gì.

**Hiện trạng — lỗ hổng delivery:**
- `web_search`/`web_extract` có 8 backend (parallel/firecrawl/tavily/exa/searxng/brave-free/ddgs/xai), fallback cuối là `firecrawl` (`web_tools.py:171`) — **cần API key**. Cài mới không key → tool lỗi hoặc phải lazy-install `ddgs` giữa hội thoại (bị chặn trong Docker: `EIR_DISABLE_LAZY_INSTALLS=1`)
- Vậy starter "chạy đúng khi mở hộp" hiện KHÔNG đảm bảo với web tools

**Việc làm — 3 lớp đảm bảo:**

**Lớp 1 — Dependency audit: starter 15 tool ⊆ base `dependencies` (pyproject.toml)**
| Tool nhóm | Phụ thuộc hiện tại | Đảm bảo |
|---|---|---|
| terminal, process, file, todo, memory, skills, clarify, execute_code, delegate_task | stdlib + base deps | ✅ đã pre-baked — chỉ cần test chứng minh |
| `web_search` | **thêm `ddgs` vào base `dependencies`** (pure-python, nhỏ, keyless) — đúng rule pyproject "dep dùng bởi EVERY starter session" | search keyless chạy day-1 |
| `web_extract` | keyless KHÔNG có backend đúng nghĩa — thay vì fake, tool trả message hướng dẫn có hành động (gợi ý `/tools` gắn backend) thay vì lỗi trần | degrade có kiểm soát, không crash |
| `ddgs` | khỏi `LAZY_DEPS` cho backend này (đã base) | không còn lazy prompt |

**Lớp 2 — Build/install validation:**
- Installer (`setup-eir.sh`, PowerShell, Dockerfile) thêm bước post-install: `eir doctor --profile starter` — verify 15/15 tool: register OK, schema collect OK, handler import OK, `ddgs` present, không tool nào cần prompt
- Docker image: mặc định `tools.profile: starter` + deps starter baked trong image (image vốn seal lazy-install — giờ profile khớp luôn)
- Fresh install (shell/PowerShell): `tools.profile` không set → hành vi default vẫn `full` cho user cũ; installer mới ghi `tools.profile: starter` vào config sau onboarding wizard (Phase 2.3 đã có model step — thêm 1 dòng ghi)

**Lớp 3 — CI smoke test (`tests/tools/test_starter_delivery.py`):**
```python
# Hợp đồng delivery — chạy trong env EIR_DISABLE_LAZY_INSTALLS=1
def test_starter_tools_register_without_lazy_install(): ...
def test_starter_deps_are_base_dependencies():
    # mỗi import của starter tool ⊆ pyproject base dependencies
def test_web_search_keyless_fallback_works():   # ddgs day-1
def test_web_extract_keyless_returns_guidance(): # message, không raise
def test_no_starter_tool_triggers_lazy_prompt(): # không LAZY_DEPS hit lúc load
```
Behavior contract — KHÔNG snapshot list tool (tránh change-detector test theo rubric).

**Final result thêm:**
```
Cài xong → mở chat → web_search chạy ngay (keyless ddgs)
         → web_extract không key → message hướng dẫn gọn, không crash
         → 0 lazy-install prompt giữa hội thoại với starter
```

**Accept thêm (Phase 3):**
- [ ] `pip install .[base]` thuần → `eir doctor --profile starter` = 15/15 xanh, không chạm extras
- [ ] Docker image: web_search chạy day-1 không key (E2E trong image)
- [ ] Test suite `test_starter_delivery.py` xanh trong CI (no-network cho phần register; mock cho web)

---

## Final result Phase 3

```
TRƯỚC: mọi user mang ~50 tool trong mọi call; web tool cài mới có thể lỗi/lazy-install giữa chat
SAU:   user mới = 15 tool PRE-BAKED (cài xong chạy, search keyless day-1)
       dev = ~30 (auto coding); power = full (1 dòng config)
       eir tools = 4 lựa chọn profile 1 phím
```

**Accept mở rộng:**
- [ ] Profile áp CHỈ lúc đầu phiên; test assert: đổi profile giữa hội thoại bị chặn (bất biến caching)
- [ ] Per-platform `enabled/disabled` lists vẫn override profile (test resolution 4 tầng, ≥ 5 case của bảng 3.2)
- [ ] Đo schema token trước/sau, ghi baseline vào PR (mục tiêu starter ↓ ≥ 60%)
- [ ] `eir tools` quick select hoạt động; Custom = UI cũ nguyên vẹn
- [ ] User cũ nâng cấp: không có `tools.profile` trong config → giữ hành vi `full` (tương thích — KHÔNG ép đổi)
- [ ] `eir config` viewer hiện 2 nhóm Core/Advanced
- [ ] **Delivery:** starter 15/15 tool xanh `eir doctor` trên install thuần không key; web_search keyless day-1; web_extract không key = message hướng dẫn, không crash; 0 lazy prompt giữa chat (mục 3.7)

**Ước lượng:** 1.5–2 tuần, 4–5 PR (PR1: profile resolution; PR2: eir tools UI + config viewer; PR3: starter pre-bake + doctor + CI smoke; PR4: core trim tùy chọn).

---

# PHASE 4 — God-file refactor (mechanical)

| File | Dòng | Tách thành |
|---|---|---|
| `gateway/run.py` | 19,670 | `gateway/runner/{dispatch, guards, deliveries, sessions, maintenance}.py` |
| `cli.py` | 15,944 | `eir_cli/repl/{command_dispatch, display, session_io}.py` |
| `eir_cli/main.py` | 13,657 | `eir_cli/cmds/{model, gateway, cron, tools, skills, setup}.py` |

**Quy tắc thi công:**
1. Mechanical moves ONLY — không đổi tên/hàm trong khi di chuyển
2. Public import path giữ (`from cli import EirCLI` không đổi) — facade + lazy import chống cycle
3. 1 god-file = 1 PR riêng
4. Rubric repo ỦNG HỘ rõ ("refactor god-files into clean modules" = wanted work)

**Final result:** không file > ~6k dòng; hành vi 100% giữ.

**Accept:**
- [ ] `import cli, eir_cli.main, gateway.run` xanh
- [ ] `scripts/run_tests.sh tests/gateway/ tests/eir_cli/` xanh trước + sau từng PR
- [ ] Smoke CLI + gateway + TUI backend

**Ước lượng:** 2–3 tuần, 3–4 PR.

---

# PHASE 5 — Terminology + Verification (song song mọi phase)

**Terminology pass (i18n):**

| Trước | Sau |
|---|---|
| Cron | Scheduled |
| Gateway | Connection |
| Toolset | Tools |

- Sửa `i18n/en.ts` + mirror `ja`, `zh`, `zh-hant`, `types.ts`
- Grep "Cron" ngoài màn advanced = 0 hit
- Alias: `/scheduled`, `/jobs` thêm cho `/cron`; `eir jobs` alias CLI

**Verification (mỗi phase phải qua trước PR kế):**
1. `scripts/run_tests.sh` (KHÔNG gọi pytest trực tiếp)
2. Desktop: `npm run typecheck` + `npm test` (vitest repo-root)
3. E2E thật, temp `EIR_HOME`: install → onboarding → chat → tool → `/model` → Schedule a task → nhận delivery
4. Cache invariants: system prompt byte-stable; không toolset mutation giữa hội thoại; strict alternation
5. Contract không đụng: `isDesktopSlashExtensionCommand`, `backendSupportsServe`, JSON-RPC transport (`requestGateway`), plugin surface, `desktop-slash-commands.test.ts`

**Docs sync (cuối):** cập nhật AGENTS.md (số liệu sai: run_agent 5,962 không phải ~12k) + `website/docs/developer-guide/architecture.md` (cây thư mục + toolset list sau Phase 3/4).

---

# Thứ tự thi công + ước lượng tổng

```
D0 (2d) → D1 (3d) → D2 (3d) → D3 (4d) → D4 (2d)   ← desktop ~2 tuần
→ Phase 2 CLI/TUI + wizard (3–4 ngày) → Phase 3 profiles (1–2 tuần)
→ Phase 4 refactor (2–3 tuần) → Phase 5 chạy song song
```

Tổng: **~6–7 tuần**, ~15–17 PR, mỗi PR độc lập revert được.

# Nguyên tắc xuyên suốt (bất biến)

1. Không xóa năng lực — chỉ ẩn/tier lại
2. Lõi agent KHÔNG đụng (run_agent.py, prompt_builder, caching)
3. Mọi default mới có opt-out 1 dòng config
4. Caching + narrow waist + message alternation giữ nguyên tuyệt đối
5. Hard-delete chỉ khi bạn xác nhận từng mục

---

## Checklist review cho bạn

- [ ] Chốt 4 quyết định đang chờ (mục 2 đầu tài liệu)
- [ ] Duyệt layout mockup D1/D2
- [ ] Duyệt bảng nhóm settings D3
- [x] Slash commands: giữ nguyên 82 lệnh (đã chốt 15/11 — bỏ tier hóa)
- [ ] Duyệt thứ tự phases (desktop trước, CLI sau)
