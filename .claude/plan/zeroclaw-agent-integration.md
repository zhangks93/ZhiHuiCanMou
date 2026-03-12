# Implementation Plan: Zeroclaw Agent Integration for Intelligent Analysis

## Task Type
- [ ] Frontend (→ Gemini)
- [x] Backend (→ Codex)
- [x] Fullstack (→ Parallel)

## Technical Solution

Based on research and codebase analysis, this plan integrates **zeroclaw** (a lightweight Rust AI agent framework) into the Tauri application to power an intelligent assistant on the AiAnalysis page.

### Zeroclaw Overview
- **What**: Ultra-lightweight AI agent runtime written in Rust (~3.4 MB binary, <10ms cold start)
- **Key Features**: Multi-provider LLM support (22+ providers including OpenAI-compatible endpoints), tool calling, memory management, autonomous execution
- **Architecture**: Trait-driven design that abstracts models, tools, memory, and execution
- **Security**: Memory-safe Rust implementation with sandboxed tool execution

### Integration Approach

**Embedding Strategy**: Since zeroclaw is primarily a CLI tool, we'll integrate it as a Rust library dependency in the Tauri backend, creating custom Tauri commands that expose agent capabilities to the React frontend.

**Key Components**:
1. **Rust Agent Service** (`app/src-tauri/src/agent/`): Wrapper around zeroclaw library with custom tools
2. **Tauri Commands**: Expose agent operations (initialize, send_message, stream_response) to frontend
3. **Custom Tools**: Web search, Supabase data queries (respecting auth), report generation
4. **React UI** (`app/src/pages/AiAnalysis.tsx`): Chat interface with streaming responses and tool execution indicators

## Implementation Steps

### Step 1: Add Zeroclaw Dependency and Setup Agent Module
**Deliverable**: Rust agent service foundation

**Changes**:
- Update `app/src-tauri/Cargo.toml` to add zeroclaw dependency
- Create `app/src-tauri/src/agent/mod.rs` as the main agent module
- Create `app/src-tauri/src/agent/tools.rs` for custom tool implementations
- Create `app/src-tauri/src/agent/config.rs` for agent configuration

**Pseudo-code**:
```toml
# app/src-tauri/Cargo.toml
[dependencies]
zeroclaw = "0.1"  # Check latest version on crates.io
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

```rust
// app/src-tauri/src/agent/mod.rs
pub mod tools;
pub mod config;

use zeroclaw::{Agent, AgentConfig, Tool};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AgentService {
    agent: Arc<Mutex<Agent>>,
}

impl AgentService {
    pub async fn new(api_key: String, model: String) -> Result<Self, Box<dyn std::error::Error>> {
        let config = AgentConfig {
            model,
            api_key,
            temperature: 0.7,
            max_tokens: 2000,
        };

        let mut agent = Agent::new(config)?;

        // Register custom tools
        agent.register_tool(tools::web_search_tool());
        agent.register_tool(tools::supabase_query_tool());
        agent.register_tool(tools::report_generator_tool());

        Ok(Self {
            agent: Arc::new(Mutex::new(agent)),
        })
    }

    pub async fn send_message(&self, message: String) -> Result<String, Box<dyn std::error::Error>> {
        let mut agent = self.agent.lock().await;
        agent.process(message).await
    }

    pub async fn stream_response(&self, message: String) -> impl Stream<Item = String> {
        // Implementation for streaming responses
    }
}
```

### Step 2: Implement Custom Tools for Agent
**Deliverable**: Web search, Supabase query, and report generation tools

**Changes**:
- Implement `web_search_tool()` in `app/src-tauri/src/agent/tools.rs`
- Implement `supabase_query_tool()` with auth context passing
- Implement `report_generator_tool()` for PDF/Excel generation

**Pseudo-code**:
```rust
// app/src-tauri/src/agent/tools.rs
use zeroclaw::Tool;
use serde_json::Value;

pub fn web_search_tool() -> Tool {
    Tool::new(
        "web_search",
        "Search the web for current information. Use this when you need up-to-date data or external knowledge.",
        |args: Value| async move {
            let query = args["query"].as_str().unwrap_or("");

            // Use a web search API (e.g., Tavily, SerpAPI, or DuckDuckGo)
            let client = reqwest::Client::new();
            let response = client
                .get("https://api.tavily.com/search")
                .query(&[("q", query), ("api_key", &get_search_api_key())])
                .send()
                .await?;

            let results = response.json::<Value>().await?;
            Ok(serde_json::to_string(&results)?)
        }
    )
}

pub fn supabase_query_tool() -> Tool {
    Tool::new(
        "query_business_data",
        "Query education logistics business data (edu_biz_report). Supports filtering by period, report_type (fone/tuwei), metric_category, node_name. Returns hierarchical aggregated data.",
        |args: Value| async move {
            let period = args["period"].as_str();
            let report_type = args["report_type"].as_str();
            let metric_category = args["metric_category"].as_str();
            let node_name = args["node_name"].as_str();
            let access_token = args["access_token"].as_str().unwrap_or("");

            // Build Supabase query with auth
            let client = reqwest::Client::new();
            let mut query_params = vec![];

            if let Some(p) = period {
                query_params.push(format!("period=eq.{}", p));
            }
            if let Some(rt) = report_type {
                query_params.push(format!("report_type=eq.{}", rt));
            }
            if let Some(mc) = metric_category {
                query_params.push(format!("metric_category=eq.{}", mc));
            }
            if let Some(nn) = node_name {
                query_params.push(format!("node_name=like.*{}*", nn));
            }

            let query_string = query_params.join("&");
            let url = format!(
                "{}/rest/v1/edu_biz_report?{}",
                get_supabase_url(),
                query_string
            );

            let response = client
                .get(&url)
                .header("apikey", get_supabase_anon_key())
                .header("Authorization", format!("Bearer {}", access_token))
                .send()
                .await?;

            let data = response.json::<Value>().await?;

            // Apply hierarchical aggregation (reuse logic from bizDataService)
            let aggregated = aggregate_business_data(data)?;

            Ok(serde_json::to_string(&aggregated)?)
        }
    )
}

pub fn report_generator_tool() -> Tool {
    Tool::new(
        "generate_report",
        "Generate a downloadable report (PDF or Excel) from analysis results. Provide title, content sections, and format.",
        |args: Value| async move {
            let title = args["title"].as_str().unwrap_or("Analysis Report");
            let content = args["content"].as_str().unwrap_or("");
            let format = args["format"].as_str().unwrap_or("pdf");

            // Generate report file
            let file_path = match format {
                "pdf" => generate_pdf_report(title, content).await?,
                "excel" => generate_excel_report(title, content).await?,
                _ => return Err("Unsupported format".into()),
            };

            Ok(serde_json::json!({
                "success": true,
                "file_path": file_path,
                "download_url": format!("tauri://localhost/reports/{}", file_path)
            }).to_string())
        }
    )
}

// Helper functions
fn get_search_api_key() -> String {
    std::env::var("SEARCH_API_KEY").unwrap_or_default()
}

fn get_supabase_url() -> String {
    std::env::var("VITE_SUPABASE_URL").unwrap_or_default()
}

fn get_supabase_anon_key() -> String {
    std::env::var("VITE_SUPABASE_ANON_KEY").unwrap_or_default()
}

async fn generate_pdf_report(title: &str, content: &str) -> Result<String, Box<dyn std::error::Error>> {
    // Use a PDF generation library (e.g., printpdf, genpdf)
    // Save to app data directory
    // Return file path
    todo!()
}

async fn generate_excel_report(title: &str, content: &str) -> Result<String, Box<dyn std::error::Error>> {
    // Use rust_xlsxwriter or similar
    // Save to app data directory
    // Return file path
    todo!()
}

fn aggregate_business_data(data: Value) -> Result<Value, Box<dyn std::error::Error>> {
    // Reuse aggregation logic from bizDataService.ts
    // This should match the hierarchical aggregation in the UI
    todo!()
}
```

### Step 3: Create Tauri Commands for Agent Operations
**Deliverable**: Tauri commands exposed to React frontend

**Changes**:
- Add Tauri commands in `app/src-tauri/src/lib.rs`
- Implement `initialize_agent`, `send_agent_message`, `stream_agent_response`
- Add global state management for AgentService

**Pseudo-code**:
```rust
// app/src-tauri/src/lib.rs
mod agent;

use agent::AgentService;
use std::sync::Arc;
use tauri::{Manager, State};
use tokio::sync::Mutex;

struct AppState {
    agent: Arc<Mutex<Option<AgentService>>>,
}

#[tauri::command]
async fn initialize_agent(
    state: State<'_, AppState>,
    api_key: String,
    model: String,
) -> Result<String, String> {
    let agent = AgentService::new(api_key, model)
        .await
        .map_err(|e| e.to_string())?;

    let mut agent_lock = state.agent.lock().await;
    *agent_lock = Some(agent);

    Ok("Agent initialized successfully".to_string())
}

#[tauri::command]
async fn send_agent_message(
    state: State<'_, AppState>,
    message: String,
    access_token: String,
) -> Result<String, String> {
    let agent_lock = state.agent.lock().await;

    if let Some(agent) = agent_lock.as_ref() {
        // Inject access_token into tool context
        let response = agent.send_message(message).await
            .map_err(|e| e.to_string())?;
        Ok(response)
    } else {
        Err("Agent not initialized".to_string())
    }
}

#[tauri::command]
async fn stream_agent_response(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    message: String,
    access_token: String,
) -> Result<(), String> {
    let agent_lock = state.agent.lock().await;

    if let Some(agent) = agent_lock.as_ref() {
        let mut stream = agent.stream_response(message).await;

        while let Some(chunk) = stream.next().await {
            app.emit("agent:stream-chunk", chunk)
                .map_err(|e| e.to_string())?;
        }

        app.emit("agent:stream-end", ())
            .map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("Agent not initialized".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        agent: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            initialize_agent,
            send_agent_message,
            stream_agent_response,
        ])
        .setup(move |app| {
            // Existing deep link setup...
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Step 4: Build React Chat UI on AiAnalysis Page
**Deliverable**: Interactive chat interface with streaming responses

**Changes**:
- Replace placeholder content in `app/src/pages/AiAnalysis.tsx`
- Create `app/src/components/Agent/ChatInterface.tsx`
- Create `app/src/components/Agent/MessageList.tsx`
- Create `app/src/components/Agent/ToolExecutionIndicator.tsx`

**Pseudo-code**:
```tsx
// app/src/pages/AiAnalysis.tsx
import { useState, useEffect, useRef } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAuth } from '@/contexts/AuthContext'
import { Send, Loader2, Download } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
}

interface ToolCall {
  name: string
  status: 'pending' | 'success' | 'error'
  result?: string
}

export function AiAnalysis() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize agent on mount
  useEffect(() => {
    const initAgent = async () => {
      try {
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY || ''
        const model = 'gpt-4o-mini'

        await invoke('initialize_agent', { apiKey, model })
        setIsInitialized(true)

        // Add welcome message
        setMessages([{
          id: '1',
          role: 'assistant',
          content: '你好！我是智能分析助手，可以帮你分析经营数据、搜索信息、生成报告。有什么我可以帮助你的吗？',
          timestamp: Date.now(),
        }])
      } catch (error) {
        console.error('Failed to initialize agent:', error)
      }
    }

    initAgent()
  }, [])

  // Listen for streaming chunks
  useEffect(() => {
    const unlisten = listen<string>('agent:stream-chunk', (event) => {
      setStreamingContent(prev => prev + event.payload)
    })

    const unlistenEnd = listen('agent:stream-end', () => {
      if (streamingContent) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: streamingContent,
          timestamp: Date.now(),
        }])
        setStreamingContent('')
      }
      setIsLoading(false)
    })

    return () => {
      unlisten.then(fn => fn())
      unlistenEnd.then(fn => fn())
    }
  }, [streamingContent])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async () => {
    if (!input.trim() || !isInitialized || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Get access token from auth context
      const accessToken = user?.accessToken || ''

      await invoke('stream_agent_response', {
        message: input,
        accessToken,
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsLoading(false)
    }
  }

  return (
    <>
      <PageTitle breadcrumb="工具与分析 / 智能分析" title="智能分析" />

      <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-xl border border-gray-200 shadow-card">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.toolCalls.map((tool, idx) => (
                      <div key={idx} className="text-xs opacity-75 flex items-center gap-2">
                        <span>🔧 {tool.name}</span>
                        {tool.status === 'pending' && <Loader2 size={12} className="animate-spin" />}
                        {tool.status === 'success' && <span>✓</span>}
                        {tool.status === 'error' && <span>✗</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[70%] rounded-lg px-4 py-3 bg-gray-100 text-gray-900">
                <div className="text-sm whitespace-pre-wrap">{streamingContent}</div>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 size={12} className="animate-spin" />
                  <span>正在生成...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isInitialized ? "输入你的问题..." : "正在初始化..."}
              disabled={!isInitialized || isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleSend}
              disabled={!isInitialized || isLoading || !input.trim()}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>发送中</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>发送</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            提示：可以询问经营数据、请求生成报告、或搜索相关信息
          </div>
        </div>
      </div>
    </>
  )
}
```

### Step 5: Add Environment Configuration for Agent
**Deliverable**: Environment variables for API keys and configuration

**Changes**:
- Update `app/.env.example` with agent-related variables
- Update `app/src/config/env.ts` to include agent config

**Pseudo-code**:
```bash
# app/.env.example
# Existing Supabase config...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Agent Configuration
VITE_OPENAI_API_KEY=sk-...
VITE_AGENT_MODEL=gpt-4o-mini
VITE_SEARCH_API_KEY=your-tavily-api-key

# Optional: Alternative LLM providers
# VITE_ANTHROPIC_API_KEY=sk-ant-...
# VITE_AGENT_PROVIDER=openai  # or anthropic, ollama, etc.
```

```typescript
// app/src/config/env.ts
export const env = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  feishu: {
    appId: import.meta.env.VITE_FEISHU_APP_ID || '',
    redirectUri: import.meta.env.VITE_FEISHU_REDIRECT_URI || '',
    scope: import.meta.env.VITE_FEISHU_SCOPE || 'contact:user.base:readonly',
  },
  agent: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
    model: import.meta.env.VITE_AGENT_MODEL || 'gpt-4o-mini',
    provider: import.meta.env.VITE_AGENT_PROVIDER || 'openai',
    searchApiKey: import.meta.env.VITE_SEARCH_API_KEY || '',
  },
}
```

### Step 6: Implement Report Download Functionality
**Deliverable**: Download generated reports from agent

**Changes**:
- Add Tauri command `download_report` in `app/src-tauri/src/lib.rs`
- Add download button in React UI when report is generated
- Use Tauri's file system API to save reports

**Pseudo-code**:
```rust
// app/src-tauri/src/lib.rs
#[tauri::command]
async fn download_report(
    file_path: String,
    save_path: String,
) -> Result<String, String> {
    use std::fs;

    fs::copy(&file_path, &save_path)
        .map_err(|e| e.to_string())?;

    Ok(save_path)
}

// Add to invoke_handler
.invoke_handler(tauri::generate_handler![
    initialize_agent,
    send_agent_message,
    stream_agent_response,
    download_report,
])
```

```tsx
// In AiAnalysis.tsx - Add download handler
const handleDownloadReport = async (filePath: string) => {
  try {
    const savePath = await save({
      defaultPath: 'analysis-report.pdf',
      filters: [{
        name: 'PDF',
        extensions: ['pdf']
      }]
    })

    if (savePath) {
      await invoke('download_report', { filePath, savePath })
      alert('报告已保存')
    }
  } catch (error) {
    console.error('Failed to download report:', error)
  }
}
```

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| app/src-tauri/Cargo.toml | Modify | Add zeroclaw, tokio, reqwest dependencies |
| app/src-tauri/src/agent/mod.rs | Create | Main agent service module |
| app/src-tauri/src/agent/tools.rs | Create | Custom tool implementations (web search, Supabase, reports) |
| app/src-tauri/src/agent/config.rs | Create | Agent configuration management |
| app/src-tauri/src/lib.rs | Modify | Add Tauri commands for agent operations |
| app/src/pages/AiAnalysis.tsx | Modify | Replace placeholder with chat interface |
| app/src/config/env.ts | Modify | Add agent configuration variables |
| app/.env.example | Modify | Add agent-related environment variables |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Zeroclaw crate may not exist on crates.io | Research shows zeroclaw is primarily a CLI tool. Alternative: Use OpenAI/Anthropic SDK directly with custom tool framework, or fork zeroclaw and adapt as library |
| Auth token passing to tools may expose security risks | Pass tokens through secure context, never log them, implement token validation in each tool |
| Streaming responses may have latency issues | Implement chunked streaming with backpressure handling, add timeout configuration |
| Report generation may consume excessive memory | Generate reports asynchronously, stream to disk, implement file size limits |
| Supabase RLS policies may block agent queries | Ensure access_token is properly passed, test with different user roles, add fallback error messages |
| Web search API costs may accumulate | Implement rate limiting, cache search results, add usage monitoring |

## Alternative Approach (If Zeroclaw Library Not Available)

If zeroclaw cannot be used as a Rust library, implement a custom agent framework:

1. **Use OpenAI/Anthropic SDK directly** in Rust (e.g., `async-openai` crate)
2. **Implement tool calling** using function calling API
3. **Create custom tool registry** with trait-based design
4. **Add streaming support** using Server-Sent Events or WebSocket

This approach gives full control but requires more implementation work.

## Testing Strategy

1. **Unit Tests**: Test individual tools (web search, Supabase query, report generation)
2. **Integration Tests**: Test Tauri command invocation from Rust
3. **E2E Tests**: Test full chat flow from React UI through Tauri to agent
4. **Security Tests**: Verify auth token handling, RLS policy enforcement
5. **Performance Tests**: Measure streaming latency, memory usage during report generation

## Success Criteria

1. Agent initializes successfully on AiAnalysis page load
2. User can send messages and receive streaming responses
3. Agent can execute web search and return relevant results
4. Agent can query Supabase data respecting user auth context
5. Agent can generate and download PDF/Excel reports
6. Chat interface is responsive and handles errors gracefully
7. No auth tokens are leaked in logs or error messages

## SESSION_ID (for /ccg:execute use)

Since ace-tool MCP is not available and we're not using external model calls for this planning phase, no SESSION_ID is needed.

---

## Implementation Notes

- **Zeroclaw Status**: Based on research, zeroclaw is a CLI tool with a Rust codebase. If it's not available as a library crate, we'll need to either fork it and extract the library components, or implement a custom agent framework using OpenAI/Anthropic SDKs directly.
- **Tool Design**: Tools should be stateless and idempotent where possible. Auth context should be passed explicitly rather than stored globally.
- **Streaming**: Use Tauri's event system for streaming responses to avoid blocking the main thread.
- **Security**: Never log access tokens or sensitive data. Implement proper error handling that doesn't expose internal details.

## Sources

Research for this plan was conducted using the following sources:

- [zeroclaw-labs/zeroclaw GitHub](https://github.com/zeroclaw-labs/zeroclaw)
- [ZeroClaw Official Website](https://zeroclaw.org/)
- [ZeroClaw on Lib.rs](https://lib.rs/crates/zeroclaw)
- [Fastest OpenClaw Fork and Setup](https://sonusahani.com/blogs/zeroclaw-ollama-openclaw-fork-setup)
- [A Lightweight Open Source Alternative to OpenClaw](https://pinggy.io/blog/zeroclaw_lightweight_openclaw_alternative/)
- [Rust-based OpenClaw Alternative with 99% Smaller Footprint](https://sparkco.ai/blog/zeroclaw-review-the-rust-based-openclaw-alternative-with-99-smaller-footprint)
- [Definitive AI Agent Framework Comparison — June 1, 2025](https://sparkco.ai/blog/openclaw-vs-zeroclaw-which-ai-agent-framework-should-you-choose-in-2026)
