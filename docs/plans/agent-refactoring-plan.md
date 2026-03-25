# Implementation Plan: Multi-Agent System with Financial Analysis Agent

## Date: 2026-03-24

---

## Requirements Restatement

1. **Refine existing Agent into an independent "Financial Analysis" Agent**
   - Current agent is generic "智能分析助手" (Smart Analysis Assistant)
   - Rename/position as specialized "Financial Analysis" (财务分析) Agent
   - Keep all existing financial analysis capabilities (tools, system prompt)

2. **Prepare for future introduction of more types of Agents**
   - Create extensible Agent architecture
   - Support multiple specialized agents (Financial, HR, Operations, etc.)
   - Agent registry/configuration system
   - Each agent has: name, avatar, description, system prompt, tools

3. **Optimize conversation interface**
   - Reference WeChat/Telegram: Agents as individual contacts in sidebar
   - Reference DeepSeek/ChatGPT: Clean chat window with conversation history sidebar
   - Retain conversation window and conversation history sidebar
   - Add Agent selection/indicator in the UI

4. **Support desktop and mobile displays**
   - Responsive design (existing mobile breakpoints maintained)
   - Optimized mobile chat experience
   - Touch-friendly interactions

5. **Maintain UI consistency with existing glassmorphism design system**
   - Use existing CSS variables, colors, shadows
   - Preserve glassmorphism effects (backdrop-filter, transparent backgrounds)
   - Consistent border-radius, spacing, typography

---

## Architecture Changes

### Current Architecture
```
AiAnalysis.tsx (Page)
  └── ChatAgent (Class)
        ├── systemPrompt.md
        ├── Tools (queryBizData, etc.)
        └── Conversation Store
```

### New Architecture
```
AgentChatPage.tsx (Page)
  ├── AgentRegistry (Configuration)
  │     ├── FinancialAnalysisAgent
  │     ├── Future: HRAgent
  │     └── Future: OperationsAgent
  ├── AgentSelector (Sidebar/Header)
  └── ChatSession
        ├── ChatWindow (Message List)
        ├── ChatInput
        └── ConversationSidebar
```

---

## Implementation Phases

### Phase 1: Agent Abstraction & Registry
**Files to create/modify:**
- `lib/agent/registry.ts` - NEW: Agent registry with configurations
- `lib/agent/agents/financialAnalysis.ts` - NEW: Financial Analysis Agent definition
- `lib/agent/types.ts` - MODIFY: Add AgentDefinition type
- `lib/agent/conversationStore.ts` - MODIFY: Support per-agent conversations

**Key changes:**
```typescript
// Agent Definition
interface AgentDefinition {
  id: string
  name: string
  description: string
  avatar: string | ReactNode
  systemPrompt: string
  tools: RegisteredTool[]
  quickPrompts: string[]
  color: string // accent color
}

// Registry
const AGENTS: Record<string, AgentDefinition> = {
  financial: financialAnalysisAgent,
  // Future: hr: hrAgent,
  // Future: operations: operationsAgent
}
```

**Risks:** LOW - Pure refactoring, no functional changes

---

### Phase 2: Agent Selection UI
**Files to create/modify:**
- `components/AgentChat/AgentSelector.tsx` - NEW: Agent list/contact list component
- `components/AgentChat/AgentCard.tsx` - NEW: Individual agent card (like contact)
- `index.css` - MODIFY: Add agent selector styles

**UI Design (WeChat/Telegram style):**
- Left sidebar shows agent "contacts" list
- Each agent has: avatar, name, description, last message preview
- Active agent highlighted
- Mobile: Drawer/sheet for agent selection

**Risks:** LOW - UI component creation

---

### Phase 3: Unified Chat Interface
**Files to create/modify:**
- `pages/AgentChat.tsx` - NEW: Unified agent chat page (replaces AiAnalysis.tsx)
- `components/AgentChat/ChatHeader.tsx` - NEW: Shows active agent info
- `components/AgentChat/ConversationList.tsx` - NEW: History sidebar
- `components/Chat/` - MODIFY: Enhance message components

**UI Design (DeepSeek/ChatGPT style):**
- Clean message area with proper spacing
- Agent avatar in header showing current agent
- Message grouping by date
- Floating input area with glassmorphism
- Mobile-optimized bottom input

**Risks:** MEDIUM - Complex state management for active agent + conversation

---

### Phase 4: Conversation History per Agent
**Files to create/modify:**
- `lib/agent/conversationStore.ts` - MODIFY: Namespace conversations by agent
- Storage key: `agent_conversations_{agentId}`
- Migration: Migrate existing conversations to "financial" agent

**Key changes:**
```typescript
// Per-agent storage
function getStorageKey(agentId: string): string {
  return `agent_conversations_${agentId}`
}

// Migration on first load
function migrateLegacyConversations(): void {
  // Move old 'agent_conversations' to 'agent_conversations_financial'
}
```

**Risks:** LOW - Data migration needs careful handling

---

### Phase 5: Mobile Responsiveness
**Files to modify:**
- `index.css` - MODIFY: Mobile breakpoint optimizations
- Add touch gestures (swipe to dismiss sidebar)
- Optimize message bubbles for mobile width
- Bottom sheet for agent selection on mobile

**Mobile-specific features:**
- Swipe gestures for navigation
- Bottom sheet for agent/contacts
- Optimized input (larger touch targets)
- Full-screen chat view

**Risks:** LOW - CSS and interaction adjustments

---

### Phase 6: Integration & Cleanup
**Files to modify:**
- `config/constants.ts` - UPDATE: Route changes
- `App.tsx` or router - UPDATE: New route for AgentChat
- Keep AiAnalysis.tsx as redirect or remove
- Update navigation links

**Key changes:**
```typescript
// Route update
export const ROUTES = {
  // ...
  AGENT_CHAT: '/chat', // New unified chat
  // DEPRECATED: AI_ANALYSIS: '/ai-analysis'
}
```

**Risks:** LOW - Configuration updates

---

## Detailed File Structure

### New Files
```
app/src/
├── lib/agent/
│   ├── registry.ts              # Agent registry
│   ├── agents/
│   │   ├── financialAnalysis.ts # Financial agent config
│   │   └── index.ts             # Export all agents
│   └── conversationStore.ts     # Modified for per-agent storage
├── components/AgentChat/
│   ├── AgentChatPage.tsx        # Main container
│   ├── AgentSelector.tsx        # Agent/contact list
│   ├── AgentCard.tsx            # Individual agent card
│   ├── ChatHeader.tsx           # Active agent header
│   ├── ConversationList.tsx     # History sidebar
│   └── index.ts                 # Barrel export
└── pages/AgentChat.tsx          # Route page
```

### Modified Files
```
app/src/
├── lib/agent/
│   ├── types.ts                 # Add AgentDefinition
│   ├── chatAgent.ts             # Minor updates if needed
│   └── systemPrompt.md          # Rename/move to agents/financial/
├── components/Chat/
│   ├── ChatMessageItem.tsx      # Enhance styling
│   └── ChatProcessPanel.tsx     # Minor updates
├── index.css                    # Add new styles
└── config/constants.ts          # Route updates
```

---

## UI Mockup

### Desktop Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar          │  Main Chat Area                         │
│  ───────────────  │  ─────────────────────────────────────  │
│                   │                                         │
│  🤖 Agents        │  ┌───────────────────────────────────┐  │
│  ───────────────  │  │  🤖 财务分析助手              ✕ │  │
│  🤖 财务分析    ◄──│  │  专注于25学年经营数据分析      │  │
│  📊 报表生成      │  └───────────────────────────────────┘  │
│  📈 预测分析      │                                         │
│                   │  ┌────────────┐                         │
│  ───────────────  │  │ 用户消息... │ (right-aligned)        │
│  💬 历史对话      │  └────────────┘                         │
│  ───────────────  │                                         │
│  💬 经营分析...   │  ┌──────────────────────────────────┐   │
│  💬 本月数据...   │  │🤖 根据查询结果...                │   │
│                   │  │                                  │   │
│                   │  └──────────────────────────────────┘   │
│                   │                                         │
│                   │  ┌────────────────────────────────┐     │
│                   │  │ 输入消息...          [发送按钮] │     │
│                   │  └────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Layout
```
┌─────────────────────────┐
│ ☰ 财务分析助手      ⚙️ │  ← Header with menu
├─────────────────────────┤
│                         │
│  ┌──────────────────┐   │
│  │ 用户消息...      │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │🤖 助手回复...    │   │
│  └──────────────────┘   │
│                         │
├─────────────────────────┤
│ [输入消息...]      [➤] │  ← Bottom input
└─────────────────────────┘
```

---

## Dependencies

No new dependencies required. Using existing:
- React hooks for state management
- lucide-react for icons
- Tailwind CSS for styling
- localStorage for persistence

---

## Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|------------|
| Data migration issues | MEDIUM | Test migration thoroughly; keep backup of legacy data |
| UI complexity with multiple states | MEDIUM | Use clear state management; thorough testing |
| Mobile performance | LOW | Lazy load conversations; virtual scroll if needed |
| Breaking existing functionality | LOW | Keep AiAnalysis.tsx until new page is verified |
| User confusion with new layout | LOW | Maintain similar interaction patterns |

---

## Testing Checklist

- [ ] Financial Analysis Agent loads with correct tools
- [ ] Conversation history persists per agent
- [ ] Data migration works correctly
- [ ] Desktop layout matches design
- [ ] Mobile layout is usable
- [ ] Agent switching works smoothly
- [ ] New conversation creation works
- [ ] Message streaming works
- [ ] Tool calls display correctly
- [ ] All existing features preserved

---

## Estimated Complexity: MEDIUM

- Phase 1 (Agent Registry): 2-3 hours
- Phase 2 (Agent UI): 2-3 hours
- Phase 3 (Chat Interface): 3-4 hours
- Phase 4 (Storage): 1-2 hours
- Phase 5 (Mobile): 2-3 hours
- Phase 6 (Integration): 1 hour
- **Total: 11-16 hours**

---

## Next Steps

1. Review and approve this plan
2. Begin with Phase 1: Create agent registry
3. Implement phases sequentially
4. Test thoroughly after each phase
5. Deploy when all phases complete
