# Báo cáo Khám phá Dự án — Eir Agent

> Tài liệu tổng hợp từ quá trình khảo sát codebase tại `/home/duy/Documents/Workspace/Work/agent-core`
> (repo: `LynxLabVN/agent-core`). Ngày biên soạn: 15/11/2026.

---

## 1. Tổng quan dự án

**Eir** là agent AI cá nhân có khả năng **tự cải thiện (self-improving)** do Nous Research phát triển. Điểm khác biệt cốt lõi: nó sở hữu **vòng lặp học tập khép kín (closed learning loop)** — tự tạo skill từ kinh nghiệm thực chiến, tự cải thiện skill trong lúc sử dụng, chủ động lưu kiến thức vào bộ nhớ, tự tìm kiếm trong các cuộc hội thoại quá khứ (FTS5 + tóm tắt LLM), và dần xây dựng "chân dung người dùng" xuyên suốt các phiên làm việc.

Đặc trưng kiến trúc quan trọng nhất: **một lõi agent duy nhất chạy trên 4 bề mặt (surfaces)**:

| Bề mặt | Điểm vào | Ghi chú |
|---|---|---|
| CLI tương tác | `cli.py` + `eir_cli/` | Rich banner, prompt_toolkit, autocomplete slash command |
| TUI (Ink/React) | `ui-tui/` + `tui_gateway/` | `eir --tui`; giao tiếp JSON-RPC qua stdio |
| Gateway nhắn tin | `gateway/run.py` | Telegram, Discord, Slack, WhatsApp, Signal và ~20 platform khác |
| Desktop (Electron) | `apps/desktop/` | App riêng, không nhúng TUI; backend dùng chung `tui_gateway` |

Chạy mọi nơi: VPS $5, GPU cluster, hay hạ tầng serverless (Modal/Daytona) gần như miễn phí khi idle. Agent không bị buộc vào laptop — nhắn Telegram từ xa trong khi agent làm việc trên VM cloud.

---

## 2. Chức năng cốt lõi — Agent Loop

Trái tim dự án là `AIAgent` trong `run_agent.py` (~12k LOC), chạy hoàn toàn **đồng bộ**:

```python
while (api_call_count < self.max_iterations and budget còn lại) or _budget_grace_call:
    if _interrupt_requested: break
    response = client.chat.completions.create(model, messages, tool_schemas)
    if response.tool_calls:
        for call in response.tool_calls:
            result = handle_function_call(call.name, call.args)
            messages.append(tool_result_message(result))
    else:
        return response.content
```

Thông điệp theo chuẩn OpenAI (`system/user/assistant/tool`), reasoning lưu trong `assistant_msg["reasoning"]`.

### 2.1. Các bất biến giữ trật tự lõi

1. **Prompt caching là tối thượng.** Cuộc hội thoại dài-lived tái dùng cache prefix mỗi lượt. Cấm mọi thứ làm đổi ngữ cảnh trong quá khứ, đổi toolset giữa chừng, hay rebuild system prompt giữa hội thoại — chỉ ngoại lệ duy nhất là compression. Vi phạm = nhân chi phí người dùng nhiều lần.
2. **Lõi hẹp, năng lực ở rìa (narrow waist).** Mỗi model tool mới được gửi đi trên MỌI lời gọi API — nên ngưỡng thêm tool cốt lõi rất cao. Đa phần năng lực mới đến bằng: lệnh CLI + skill → tool có service-gate (`check_fn`) → plugin → MCP server → mới nhất là tool cốt ("Footprint Ladder").
3. **Lõi bất kể nền tảng.** Một class `AIAgent` phục vụ CLI, gateway, ACP, batch, API server. Khác biệt nền tảng nằm ở điểm vào, không nằm trong agent.
4. **Chèn xen được (interruptible).** Lời gọi API và tool execution có thể hủy giữa chừng bằng input hoặc signal.
5. **Cô lập profile.** Mỗi profile (`eir -p <name>`) có `EIR_HOME` riêng — config, key, memory, session, PID gateway đều tách biệt, chạy song song được.

### 2.2. Chức năng nổi bật

- **Vòng lặp học:** memory có curator (agent tự dọn, tự lưu trữ skill cũ — không bao giờ xóa), skill tự sinh sau task phức tạp, tự cải thiện khi dùng.
- **Cron:** agent task theo lịch (không phải shell task) — job có gắn skill, script tiền xử lý, giao kết quả về bất kỳ platform nào; interrupt cứng 3 phút chống loop chạy hoang.
- **Delegation:** `delegate_task` sinh subagent cô lập context + terminal riêng; chạy song song (batch) hoặc background; `role="orchestrator"` cho phép lồng nhau (giới hạn độ sâu).
- **Kanban:** bảng SQLite đa agent, dispatcher reclaim stale claim + tự block task gây spin loop.
- **Kết thúc nghiên cứu:** sinh trajectory ShareGPT format + nén trajectory để huấn luyện thế hệ model tool-calling kế tiếp.
- **Terminal 6 backend:** local, Docker, SSH, Singularity, Modal, Daytona.

---

## 3. Cấu trúc hiện tại

| Tầng | Vị trí | Vai trò |
|---|---|---|
| Lõi | `run_agent.py`, `model_tools.py`, `toolsets.py` | Vòng lặp, dispatch tool, 28 toolset |
| Nội bộ agent | `agent/` | prompt_builder, nén ngữ cảnh, prompt caching, memory manager, provider adapter |
| Tools | `tools/` + `tools/environments/` | 70+ tool tự đăng ký qua `tools/registry.py`; 6 backend terminal |
| CLI | `cli.py`, `eir_cli/` | Slash command (registry trung tâm), setup wizard, skin engine |
| Gateway | `gateway/` + `gateway/platforms/` | 20 adapter platform, session store, hooks, token lock theo profile |
| Rìa | `plugins/`, `skills/`, `optional-skills/`, `cron/`, `acp_adapter/`, `ui-tui/`, `apps/desktop/` | Nơi năng lực mới được đặt — không chạm lõi |
| Trạng thái | `eir_state.py` | SQLite + FTS5, lineage session (cha/con qua các lần nén) |
| Kiểm thử | `tests/` | ~17k test / ~900 file, cách ly subprocess, môi trường hermetic (`scripts/run_tests.sh`) |

### 3.1. Chuỗi phụ thuộc cốt

```
tools/registry.py  (không phụ thuộc — mọi tool import nó)
       ↑
tools/*.py  (tự gọi registry.register() khi import)
       ↑
model_tools.py  (import registry + kích hoạt discovery)
       ↑
run_agent.py, cli.py, batch_runner.py, environments/
```

Tool đăng ký lúc import, trước khi instance agent nào tồn tại. File `tools/*.py` có `registry.register()` ở top-level sẽ được auto-discover — không cần danh sách import thủ công.

### 3.2. Dòng chảy dữ liệu

```
CLI:        input → EirCLI.process_input() → AIAgent.run_conversation()
            → build_system_prompt → resolve provider → API → tool loop → response → SessionDB

Gateway:    event platform → Adapter → GatewayRunner (authorize, session key)
            → AIAgent với history → deliver ngược qua adapter

Cron:       tick scheduler → job đến hạn → agent mới (không history) → inject skills
            → chạy prompt → deliver → update next_run
```

### 3.3. Lịch sử hình thành (từ git log)

- **07–08/2025:** `initial commit` → terminal tool → nén nội dung crawl → vision tool → MoA (mixture of agents) → image gen.
- **09/2025:** hệ toolsets ra đời (`17608c114`) — "make them easy to create and configure"; **tài liệu kiến trúc đầu tiên** xuất hiện (xem mục 4); cấu trúc lại project cho gọn.
- **10/2025 → 01/2026:** restructure, environment config, mở rộng tool.
- **01–03/2026:** bùng nổ rìa — skills hub, gateway đa platform, plugin system, website docs (Docusaurus), kanban, ACP, desktop app.
- **05–06/2026:** chính sách khoá "narrow waist" (không thêm memory provider in-tree, plugin sản phẩm ngoài phải là repo standalone).

**Quy luật phát triển:** khởi đầu chỉ là terminal tool + vòng lặp nhỏ → phình to ở RÌA (platform, skill, plugin) trong khi LÒI giữ nguyên hình dáng. Nguyên tắc bất biến xuyên suốt: **năng lực ở rìa, lõi hẹp**.

---

## 4. Tài liệu thiết kế ĐẦU TIÊN (khía cạnh chức năng)

Tài liệu thiết kế sớm nhất của dự án xuất hiện **ngày 12/09/2025**, qua 2 commit:

- `045a1737f` — *"message graphs"* → `architecture/message_graph.md`
- `066514e2a` — *"add more architecture docs"* → `architecture/agents.md`, `architecture/llm_client.md`, `architecture/tools.md`

### 4.1. `agents.md` — Tuyên ngôn triết học cốt lõi

> "Agents can be viewed as an FSM using an LLM to generate inputs into a system operating over a DAG… **the agent is just a function without memory**."

```python
def my_agent(*args, **kwargs) -> str:
    # do whatever you want!
    return "Hi I'm an agent!"
```

Định nghĩa này dẫn ra quy tắc nền tảng: **KHÔNG lưu state của agent bên ngoài lời gọi hàm**. Class tồn tại chỉ để gom config + khởi tạo + helper (`BaseAgent.tools()` trả danh sách tool; `agent_primitives()` trả các agent con sinh input; `run()` trả `ConversationGraph`).

### 4.2. `message_graph.md` — Thông điệp là node của đồ thị

Miêu tả hội thoại dạng đồ thị: message là node bất biến, "edits are kept in the graph as context so we can ensure they're immutable while keeping them editable" — kèm sơ đồ mermaid vẽ System → User → Chat Response → Tool Response, và subagent chat lồng trong tool metadata.

### 4.3. `llm_client.md` — Wrapper mỏng quanh OpenAI API

Trách nhiệm: biến request chat/completions thường thành graph; dịch graph thành request LLM; giữ lịch sử các graph đã parse (on-policy data + dedup). "Dùng y như OpenAI API, chỉ thêm input/output dạng graph."

### 4.4. `tools.md` — Tool là wrapper CÓ STATE quanh hàm

```python
class BaseTool:
    def definitions(self) -> List[Dict[str, Any]]: ...   # schema tương thích OpenAI
    def __call__(self, *args, **kwargs) -> Dict[str, Any]: ...
```

Mục đích của state: giữ docker container sống, giữ game online — trả về tối thiểu `{'role': 'tool', 'content': '...'}`.

### 4.5. Số phận của các tài liệu này

- **30/01/2026** (`4b68d30b0`): thư mục `architecture/` được đổi tên thành `docs/` cho rõ ràng.
- **05/03/2026** (`a352b5c19`): thư mục `docs/` legacy bị xoá — toàn bộ nội dung chuyển sang website Docusaurus.
- Hậu duệ hiện tại: `website/docs/developer-guide/architecture.md` — bản đồ kiến trúc hiện hành (kèm `agent-loop.md`, `tools-runtime.md`, `provider-runtime.md`, `session-storage.md`, `gateway-internals.md`...).
- Bản gốc vẫn xem được qua git: `git show 066514e2a:architecture/agents.md`.

### 4.6. Tầm nhìn ban đầu so với thực tế

Tầm nhìn FSM/DAG/graph trong các tài liệu đầu tiên **chưa bao giờ được triển khai nguyên văn** — thực tế đơn giản hoá thành danh sách message tuyến tính với strict alternation + prefix caching. Nhưng **nguyên tắc thì sống sót hoàn chỉnh**:

| Nguyên tắc trong docs đầu tiên | Hình thái hôm nay |
|---|---|
| Agent = hàm không memory | Vòng lặp stateless-per-turn, state nằm trong message list + SessionDB |
| Message bất biến, edit giữ làm context | Strict message alternation, cấm đột biến ngữ cảnh quá khứ (bảo vệ cache) |
| Tool = wrapper có state quanh hàm | Registry pattern: `registry.register()`, handler trả JSON string |
| LLM client mỏng, tương thích OpenAI | 3 API mode: chat_completions / codex_responses / anthropic_messages |

---

## 5. Kết luận

Những tài liệu đầu tiên định hình **DNA thiết kế** còn cai trị repo đến tận hôm nay: agent hình dạng một hàm, tool registry, và tính bất biến của message — nay được chính thức hoá trong AGENTS.md (narrow waist, caching tối thượng, Footprint Ladder, "verify the premise before merging a fix").

Câu chuyện tổng thể: một dự án biết **mình là gì ngay từ tài liệu đầu tiên**, rồi bám chặt triết lý đó qua 10 tháng tăng trưởng tự do ở rìa. Lõi chưa từng phình — đó là thành tựu thiết kế hiếm thấy ở tốc độ ship này.
