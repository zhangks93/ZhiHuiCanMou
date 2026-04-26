# 本地优先汇报包技术方案

> 面向 Codex / 工程实现参考  
> 项目愿景：员工在本地整理工作数据，由 Agent 协助形成结构化汇报包，点对点发送给领导；领导在本地收件箱中预览、分析、导入与采纳，形成逐级汇报与经营决策闭环。

---

## 0. 重要前提

本方案基于以下产品与技术前提：

1. **未来所有业务数据均保存在本地 SQLite**  
   包括但不限于：商机、经营、出差、考勤、日程、组织、人员等。

2. **Supabase 不作为业务数据主库**  
   Supabase 最多用于身份、设备公钥、加密包中转、状态回执。  
   不保存业务明文数据，不做经营、商机、考勤、出差的正式数据存储。

3. **点对点发送的核心不是“云端共享表”，而是“汇报包”**  
   员工本地 SQLite → 生成汇报包 → 发送给领导 → 领导本地 SQLite 导入。

4. **领导不应被动接受外部数据直接写入正式业务表**  
   正确流程是：收到 → 解密/解析 → 预览 → 校验 → 差异对比 → 导入到汇报库或采纳到正式库。

5. **Agent 的数据来源应切换到本地 SQLite**  
   Agent 通过 Tauri command 查询本地数据、读取汇报包、执行预览和导入动作。

---

## 1. 目标

### 1.1 产品目标

实现一个本地优先的「员工向 Agent 汇报」闭环：

```text
员工本地整理数据
  ↓
Agent 帮员工生成汇报摘要
  ↓
员工生成汇报包
  ↓
点对点发送给领导
  ↓
领导本地收件箱接收
  ↓
Agent 帮领导解读
  ↓
领导导入到本地汇报库
  ↓
领导选择性采纳到本地正式数据
  ↓
领导汇总后继续向上汇报
```

### 1.2 工程目标

建立一套可复用的通用数据汇报包能力，而不是为每个模块重复实现一套 transfer 逻辑。

需要支持：

- 本地 SQLite 汇报包表
- `.zcpkg` 汇报包文件格式
- 汇报包导出与导入
- 收件箱 / 发件箱
- 导入到个人汇报库
- 采纳到本地正式数据
- 数据血缘与导入批次
- Agent 汇报包工具
- 后续端到端加密中转扩展

---

## 2. 非目标

MVP 阶段不要实现以下内容：

1. 不做 WebRTC / 局域网直连。
2. 不做复杂多设备自动同步。
3. 不做经营正式数据的自动覆盖导入。
4. 不做中心化云端业务数据表。
5. 不让前端绕过 Tauri/Rust 直接操作复杂导入逻辑。
6. 不为每个模块单独复制 `xxxTransferRepository`。

---

## 3. 推荐总体架构

```text
员工设备
────────────────────────
本地 SQLite
  - 商机
  - 经营
  - 出差
  - 考勤
  - 日程
  - 汇报发件箱

        ↓ 生成汇报包

.zcpkg 汇报包
  - manifest.json
  - payload.sqlite
  - attachments/
  - checksums.json
  - signature.json

        ↓ 点对点发送

传输层
  A. 离线文件发送，MVP
  B. 端到端加密云中转，正式版
  C. 局域网 / WebRTC 直连，增强版

        ↓

领导设备
────────────────────────
本地 SQLite
  - 汇报收件箱
  - 收到的原始汇报
  - 个人汇报库
  - 正式业务数据
  - 导入批次
  - 数据血缘

        ↓

Agent 读取领导本地 SQLite
  - 汇总
  - 分析
  - 对比
  - 提醒
  - 生成管理建议
```

---

## 4. 产品流程

### 4.1 员工侧流程

```text
进入商机 / 出差 / 考勤 / 经营 / 日程模块
  ↓
点击“发送给领导”
  ↓
选择数据范围
  ↓
选择接收人
  ↓
Agent 生成汇报摘要，可编辑
  ↓
系统校验数据
  ↓
生成汇报包
  ↓
导出文件或在线发送
```

员工侧需要展示：

- 汇报类型
- 汇报周期
- 数据条数
- 校验结果
- 汇报摘要
- 接收人
- 是否包含附件
- 是否已发送
- 领导处理状态，在线中转阶段支持

### 4.2 领导侧流程

```text
打开汇报收件箱
  ↓
看到员工发来的汇报包
  ↓
预览摘要与明细
  ↓
让 Agent 分析
  ↓
查看与本地数据的差异
  ↓
选择：
    A. 导入到我的汇报库
    B. 采纳到本地正式数据
    C. 退回修改
    D. 忽略 / 删除
```

领导侧卡片示例：

```text
张三发来 2026年4月商机汇报
商机 28 条 · 新增 6 条 · 更新 12 条 · 风险 3 条
状态：待处理

[预览] [Agent 分析] [导入到我的汇报库] [采纳为正式数据] [退回修改]
```

---

## 5. 汇报包文件格式

### 5.1 文件扩展名

建议使用：

```text
.zcpkg
```

含义：

```text
ZhiHui CanMou Package
```

### 5.2 文件结构

MVP 阶段可以先实现为 zip 包。正式阶段再加入加密封装。

```text
packet.zcpkg
  ├── manifest.json
  ├── payload.sqlite
  ├── attachments/
  │   ├── 原始商机台账.xlsx
  │   └── 出差申请附件.pdf
  ├── checksums.json
  └── signature.json
```

### 5.3 manifest.json

```json
{
  "packetVersion": 1,
  "packetId": "uuid",
  "moduleId": "opportunity",
  "packetType": "snapshot",
  "title": "2026年4月商机汇报",
  "summary": "共28条商机，新增6条，更新12条，风险3条",
  "period": {
    "label": "2026-04",
    "start": "2026-04-01",
    "end": "2026-04-30"
  },
  "sender": {
    "userId": "user_a",
    "displayName": "张三",
    "deviceId": "device_a"
  },
  "recipient": {
    "userId": "user_b",
    "displayName": "李总",
    "deviceId": "device_b"
  },
  "createdAt": "2026-04-26T10:30:00+09:00",
  "schemaVersion": 1,
  "itemCount": 28,
  "source": {
    "type": "local-sqlite",
    "databaseId": "employee-local-db-id"
  },
  "derivedFrom": []
}
```

### 5.4 payload.sqlite

`payload.sqlite` 是汇报包内的结构化数据载体。

不要只使用 JSON 文件，原因：

- 数据量大时更稳定。
- 可以直接 `ATTACH` 到本地数据库做 diff。
- 可以事务化导入。
- 可以保留索引。
- 可以支持 schema migration。
- 适合本地优先架构。

MVP 阶段建议使用统一记录表：

```sql
create table packet_records (
  id text primary key,
  module_id text not null,
  record_uid text not null,
  record_key text not null,
  operation text not null default 'upsert',
  schema_version integer not null,
  payload_json text not null,
  row_hash text not null,
  validation_status text not null default 'valid',
  validation_errors text,
  created_at text not null
);

create index idx_packet_records_module_key
  on packet_records(module_id, record_key);

create index idx_packet_records_uid
  on packet_records(record_uid);
```

后续可以为高频模块增加专用表，例如：

```sql
create table packet_opportunities (...);
create table packet_attendance_records (...);
create table packet_trip_records (...);
create table packet_biz_metrics (...);
```

但第一期不要过度设计。

---

## 6. 本地 SQLite 表设计

以下表需要存在于应用本地 SQLite 中。

### 6.1 local_data_packets

用于本机收件箱和发件箱。

```sql
create table if not exists local_data_packets (
  id text primary key,

  direction text not null check (direction in ('inbox', 'outbox')),
  module_id text not null,
  packet_type text not null default 'snapshot',

  title text not null,
  summary text,
  period_label text,
  period_start text,
  period_end text,

  sender_user_id text not null,
  sender_name text,
  sender_device_id text,

  recipient_user_id text not null,
  recipient_name text,
  recipient_device_id text,

  status text not null default 'draft',
  -- draft, ready, sent, received, downloaded, pending_import,
  -- imported_personal, accepted_official, rejected, cancelled, failed

  packet_hash text not null,
  signature text,
  package_path text,

  item_count integer not null default 0,
  validation_summary text,
  import_summary text,

  created_at text not null,
  sent_at text,
  received_at text,
  imported_at text,
  rejected_at text,
  updated_at text not null
);

create index if not exists idx_local_data_packets_direction_status
  on local_data_packets(direction, status);

create index if not exists idx_local_data_packets_module
  on local_data_packets(module_id);

create index if not exists idx_local_data_packets_created_at
  on local_data_packets(created_at);
```

### 6.2 local_data_packet_records

收到或生成汇报包后，把明细缓存到本地，避免每次预览都重新解压解析。

```sql
create table if not exists local_data_packet_records (
  id text primary key,
  packet_id text not null,

  module_id text not null,
  record_uid text not null,
  record_key text not null,
  operation text not null default 'upsert',

  payload_json text not null,
  row_hash text not null,

  validation_status text not null default 'valid',
  validation_errors text,

  imported_personal integer not null default 0,
  accepted_official integer not null default 0,

  created_at text not null,

  foreign key(packet_id) references local_data_packets(id)
);

create index if not exists idx_local_data_packet_records_packet
  on local_data_packet_records(packet_id);

create index if not exists idx_local_data_packet_records_key
  on local_data_packet_records(module_id, record_key);
```

### 6.3 local_received_records

领导导入到“我的汇报库”的目标表。

```sql
create table if not exists local_received_records (
  id text primary key,

  owner_user_id text not null,
  source_packet_id text not null,
  source_record_id text not null,

  module_id text not null,
  record_uid text not null,
  record_key text not null,
  record_hash text not null,

  payload_json text not null,

  sender_user_id text not null,
  sender_name text,

  period_label text,
  imported_at text not null,

  unique(owner_user_id, source_packet_id, record_key)
);

create index if not exists idx_local_received_records_owner_module
  on local_received_records(owner_user_id, module_id);

create index if not exists idx_local_received_records_packet
  on local_received_records(source_packet_id);
```

### 6.4 local_import_batches

记录每次导入行为。

```sql
create table if not exists local_import_batches (
  id text primary key,

  packet_id text not null,
  module_id text not null,

  target_scope text not null check (target_scope in ('personal', 'official')),
  import_mode text not null check (import_mode in ('append', 'upsert', 'replace_period')),

  imported_by text not null,

  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  conflict_count integer not null default 0,
  error_count integer not null default 0,

  import_summary text,
  created_at text not null
);

create index if not exists idx_local_import_batches_packet
  on local_import_batches(packet_id);
```

### 6.5 local_record_lineage

记录正式业务数据的来源。

```sql
create table if not exists local_record_lineage (
  id text primary key,

  local_table text not null,
  local_record_id text not null,

  source_packet_id text not null,
  source_record_id text not null,
  source_record_uid text not null,
  source_record_hash text not null,

  sender_user_id text not null,
  sender_device_id text,

  import_batch_id text not null,

  created_at text not null
);

create index if not exists idx_local_record_lineage_local
  on local_record_lineage(local_table, local_record_id);

create index if not exists idx_local_record_lineage_packet
  on local_record_lineage(source_packet_id);
```

### 6.6 local_source_record_map

跨设备记录映射表。用于识别下属第二次发来的同一条记录。

```sql
create table if not exists local_source_record_map (
  id text primary key,

  source_user_id text not null,
  source_device_id text not null,
  source_module_id text not null,
  source_record_uid text not null,

  local_module_id text not null,
  local_record_id text not null,

  first_seen_packet_id text not null,
  last_seen_packet_id text,

  created_at text not null,
  updated_at text not null,

  unique(source_user_id, source_device_id, source_module_id, source_record_uid)
);

create index if not exists idx_local_source_record_map_local
  on local_source_record_map(local_module_id, local_record_id);
```

---

## 7. 本地业务表标准字段

未来所有本地业务表建议统一包含以下字段。

```sql
id text primary key,
record_uid text not null unique,

created_at text not null,
updated_at text not null,
deleted_at text,

created_by_user_id text,
updated_by_user_id text,

origin_user_id text,
origin_device_id text,
origin_record_uid text,

source_packet_id text,
source_import_batch_id text,

record_hash text,
version integer not null default 1
```

字段说明：

| 字段 | 说明 |
|---|---|
| `id` | 本机数据库内部 ID |
| `record_uid` | 跨设备稳定记录 ID，由源设备生成 |
| `origin_user_id` | 原始数据来源用户 |
| `origin_device_id` | 原始数据来源设备 |
| `origin_record_uid` | 原始来源记录 UID |
| `source_packet_id` | 最近一次导入来源汇报包 |
| `source_import_batch_id` | 最近一次导入批次 |
| `record_hash` | 内容 hash，用于判断变化 |
| `version` | 本地版本号，用于历史与回滚 |

---

## 8. 冲突与去重规则

每条汇报记录必须携带四类标识：

```text
record_uid
  源设备生成的稳定 ID。

record_key
  业务自然键，例如 月份 + 人员 + 部门。

row_hash
  内容 hash，用于判断是否变化。

source_anchor
  发送人 + 设备 + 模块 + 源记录 UID。
```

导入判断顺序：

```text
1. 如果 source_anchor 已经映射到本地记录：
   - row_hash 相同：跳过
   - row_hash 不同：提示更新或自动更新

2. 如果 source_anchor 没有映射，但 record_key 命中本地记录：
   - 提示“可能是同一条记录”
   - 允许用户选择：关联并更新 / 新建 / 跳过

3. 如果都没有命中：
   - 新建本地记录

4. 每次导入都写入 lineage 和 import_batch
```

伪代码：

```ts
function resolveImportAction(packetRecord, localDb) {
  const sourceAnchor = {
    userId: packet.sender.userId,
    deviceId: packet.sender.deviceId,
    moduleId: packetRecord.moduleId,
    recordUid: packetRecord.recordUid,
  }

  const mapped = localDb.findSourceRecordMap(sourceAnchor)

  if (mapped) {
    const localRecord = localDb.findById(mapped.localModuleId, mapped.localRecordId)

    if (!localRecord) {
      return { action: 'conflict', reason: 'mapped_local_record_missing' }
    }

    if (localRecord.record_hash === packetRecord.rowHash) {
      return { action: 'skip', reason: 'unchanged' }
    }

    return { action: 'update', localRecordId: localRecord.id }
  }

  const naturalMatch = localDb.findByRecordKey(packetRecord.moduleId, packetRecord.recordKey)

  if (naturalMatch) {
    return {
      action: 'review_required',
      reason: 'natural_key_match_without_source_mapping',
      candidateLocalRecordId: naturalMatch.id,
    }
  }

  return { action: 'insert' }
}
```

---

## 9. 模块导入策略

### 9.1 商机 opportunity

优先作为 MVP 第一个非日程模块。

#### 源记录建议字段

```text
record_uid
project_name
customer_name
region
stage
owner
expected_revenue
expected_finish_date
progress_note
updated_at
```

#### record_key

```text
opportunity:${normalized_customer}:${normalized_project}:${owner}
```

但正式导入判断优先级应为：

```text
source_user_id + source_device_id + source_record_uid
```

#### 导入策略

```text
我的汇报库：
  保存原始商机汇报，供领导和 Agent 分析。

正式数据：
  如果已有 source_record_uid 映射，则更新本地商机。
  如果自然键疑似匹配，则提示用户确认。
  否则新建商机。
```

#### 差异摘要

```text
新增商机 6 条
更新商机 12 条
阶段变化 4 条
预计收入变化 3 条
超过 30 天未推进 2 条
预计完成时间缺失 3 条
```

---

### 9.2 出差 trip

出差是事件型数据，适合 append/upsert。

#### record_key

```text
trip:${employee_uid}:${start_time}:${end_time}:${destination}
```

#### 导入策略

```text
同一个员工、同一时间段、同一目的地：
  认为可能是同一条出差记录。

时间重叠：
  提示冲突。

客户或商机关联缺失：
  作为 warning。
```

#### 导入模式

```text
个人汇报库：默认推荐
正式数据：append 或 upsert
```

---

### 9.3 考勤 attendance

考勤是周期快照型数据。

#### record_key

```text
attendance:${year_month}:${employee_uid}:${department_uid}
```

#### 导入策略

```text
同一员工同一月份只能有一条主记录。
重复发送时做 upsert。
如果月份相同但数值不同，展示差异。
```

#### 差异展示

```text
张三：
  应出勤 22 → 22
  实出勤 21 → 20
  请假 1 → 2

李四：
  新增迟到 2 次
```

#### 正式采纳模式

考勤适合：

```text
replace_period
```

导入前必须明确提示范围：

```text
将替换：2026-04，教育后勤事业部，126 条考勤记录
```

---

### 9.4 经营 biz-data

经营数据价值最高，但第一期不要直接导入正式表。

#### 第一阶段

```text
经营汇报包 → 领导本地汇报库 → Agent 分析
```

#### 后续正式采纳

经营数据按周期、组织节点和指标导入：

```text
biz:${period}:${org_node}:${metric_code}:${scenario}
```

示例：

```text
biz:2026-04:华东区域:revenue:actual
biz:2026-04:华东区域:cost:actual
biz:2026-04:华东区域:profit:actual
```

正式采纳时使用：

```text
replace_period
```

本地 SQLite 事务流程：

```sql
begin transaction;

-- 1. 写 import batch
-- 2. 备份旧数据到 history
-- 3. 删除目标周期旧数据
-- 4. 插入新数据
-- 5. 写 lineage

commit;
```

失败时：

```sql
rollback;
```

---

### 9.5 日程 schedule

当前日程转交可以保留，后续逐步并入统一汇报包体系。

长期目标：

```text
schedule_transfers → schedulePacketAdapter → data_packets
```

日程仍保留特殊规则：

```text
重复日程识别
会议纪要保留
同时间段冲突提示
导入到当前设备本地
```

---

## 10. Tauri / Rust 实现建议

核心数据包能力应放在 Tauri/Rust 层，而不是前端。

### 10.1 推荐目录

```text
app/src-tauri/src/data_packet/
  mod.rs
  models.rs
  manifest.rs
  package.rs
  payload.rs
  crypto.rs
  export.rs
  import.rs
  diff.rs
  lineage.rs
  errors.rs
  adapters/
    mod.rs
    schedule.rs
    opportunity.rs
    trip.rs
    attendance.rs
    biz.rs
```

### 10.2 Rust 侧职责

Rust 负责：

```text
读取本地 SQLite
生成 packet
压缩 / 解压
加密 / 解密，第二阶段
签名 / 验签，第二阶段
解析 payload.sqlite
导入 payload.sqlite
事务处理
写 import batch
写 lineage
差异计算
生成预览摘要
```

前端负责：

```text
选择数据
展示预览
触发发送
展示收件箱
确认导入
调用 Agent
```

### 10.3 Tauri Commands

建议暴露以下命令：

```rust
create_data_packet(selection) -> PacketDraft
export_data_packet_file(packet_id, target_path) -> ExportResult
import_data_packet_file(file_path) -> PacketPreview

list_data_packets(direction, filters) -> Vec<PacketSummary>
read_data_packet(packet_id) -> PacketDetail

preview_data_packet_import(packet_id, target_scope) -> ImportPreview
import_data_packet(packet_id, target_scope, import_mode) -> ImportResult

reject_data_packet(packet_id, reason) -> Result
delete_data_packet(packet_id) -> Result

send_data_packet_via_relay(packet_id, recipient_device_id) -> SendResult
sync_relay_inbox() -> Vec<PacketSummary>
sync_relay_receipts() -> Vec<Receipt>
```

MVP 阶段必须实现：

```text
create_data_packet
export_data_packet_file
import_data_packet_file
list_data_packets
read_data_packet
preview_data_packet_import
import_data_packet
```

在线中转相关命令留到第三期。

### 10.4 Rust Adapter Trait

建议定义模块适配器 trait：

```rust
pub trait DataPacketAdapter {
    fn module_id(&self) -> &'static str;

    fn collect_records(
        &self,
        db: &SqlitePool,
        selection: PacketSelection,
    ) -> Result<Vec<PacketRecord>, DataPacketError>;

    fn validate_record(
        &self,
        record: &PacketRecord,
    ) -> ValidationResult;

    fn build_record_key(
        &self,
        record: &PacketRecord,
    ) -> Result<String, DataPacketError>;

    fn summarize(
        &self,
        records: &[PacketRecord],
    ) -> PacketSummaryStats;

    fn preview_import(
        &self,
        db: &SqlitePool,
        packet: &LocalDataPacket,
        records: &[PacketRecord],
        target_scope: ImportTargetScope,
    ) -> Result<ImportPreview, DataPacketError>;

    fn import_personal(
        &self,
        tx: &mut Transaction<'_, Sqlite>,
        packet: &LocalDataPacket,
        records: &[PacketRecord],
    ) -> Result<ImportResult, DataPacketError>;

    fn import_official(
        &self,
        tx: &mut Transaction<'_, Sqlite>,
        packet: &LocalDataPacket,
        records: &[PacketRecord],
        mode: ImportMode,
    ) -> Result<ImportResult, DataPacketError>;
}
```

---

## 11. 前端实现建议

### 11.1 推荐目录

```text
app/src/features/data-packets/
  api/
    dataPacketCommands.ts
  components/
    PacketCard.tsx
    PacketInboxList.tsx
    PacketOutboxList.tsx
    PacketPreview.tsx
    PacketDiffView.tsx
    PacketImportDialog.tsx
    PacketRecipientPicker.tsx
    PacketStatusBadge.tsx
  pages/
    DataPacketInboxPage.tsx
    DataPacketOutboxPage.tsx
    DataPacketComposePage.tsx
    DataPacketDetailPage.tsx
  adapters/
    opportunityPacketUiAdapter.ts
    tripPacketUiAdapter.ts
    attendancePacketUiAdapter.ts
    bizPacketUiAdapter.ts
    schedulePacketUiAdapter.ts
  types.ts
```

### 11.2 前端 API 封装

```ts
export async function createDataPacket(input: CreateDataPacketInput): Promise<PacketDraft>

export async function exportDataPacketFile(packetId: string, targetPath?: string): Promise<ExportResult>

export async function importDataPacketFile(filePath: string): Promise<PacketPreview>

export async function listDataPackets(params: ListPacketsParams): Promise<PacketSummary[]>

export async function readDataPacket(packetId: string): Promise<PacketDetail>

export async function previewDataPacketImport(
  packetId: string,
  targetScope: 'personal' | 'official',
): Promise<ImportPreview>

export async function importDataPacket(
  packetId: string,
  targetScope: 'personal' | 'official',
  importMode: 'append' | 'upsert' | 'replace_period',
): Promise<ImportResult>
```

### 11.3 路由建议

```text
/data-packets/inbox
/data-packets/outbox
/data-packets/new
/data-packets/:id
```

也可以挂在现有工作台：

```text
/workspace?tab=packets
```

推荐 UI 信息架构：

```text
工作台
  - 日程
  - 汇报箱
  - 系统链接
```

汇报箱内部：

```text
汇报收件箱
汇报发件箱
导入汇报包
```

---

## 12. Agent 工具设计

Agent 应通过 Tauri command 读取本地数据，不应依赖 Supabase 业务表。

### 12.1 工具列表

```ts
listLocalPackets({
  direction: 'inbox' | 'outbox',
  status?: string,
  moduleId?: string
})

readLocalPacket({
  packetId: string
})

summarizeLocalPacket({
  packetId: string
})

comparePacketWithLocalData({
  packetId: string,
  targetModule: string
})

importLocalPacket({
  packetId: string,
  targetScope: 'personal' | 'official',
  importMode: 'append' | 'upsert' | 'replace_period'
})

queryLocalBusinessData({
  moduleId: string,
  filters: Record<string, unknown>
})
```

### 12.2 典型对话

用户：

```text
今天谁给我发了新的汇报？
```

Agent：

```text
今天收到 3 个待处理汇报包：
1. 张三的 4 月商机汇报，共 28 条商机；
2. 李四的 4 月考勤汇报，共 126 条记录；
3. 王五的本周出差汇报，共 8 条记录。

其中张三的商机汇报有 3 条预计完成时间缺失，建议先预览后导入。
```

用户：

```text
分析一下张三的商机汇报。
```

Agent：

```text
张三本次汇报包含 28 条商机，其中新增 6 条、更新 12 条。
重点风险：
1. 3 条商机预计完成时间缺失；
2. 2 条商机超过 30 天未更新进展；
3. XX 项目预计收入下调 20 万。
建议先导入到个人汇报库，再对 5 条高价值商机进行人工确认。
```

---

## 13. 在线中转设计，第三期

### 13.1 原则

在线中转服务只能保存加密数据：

```text
允许保存：
  发送方 ID
  接收方 ID
  发送方设备 ID
  接收方设备 ID
  加密包路径
  加密后的对称密钥
  包大小
  状态回执
  过期时间

禁止保存：
  商机名称
  经营金额
  考勤明细
  出差客户
  业务附件明文
  汇报摘要明文，正式阶段也建议加密
```

### 13.2 设备密钥

首次启动应用时：

```text
生成 device_id
生成加密密钥对
生成签名密钥对
私钥保存在本地 Keychain / 安全存储
公钥上传到身份目录
```

云端只保存：

```text
user_id
device_id
public_key
signing_public_key
device_name
last_seen_at
```

### 13.3 发送流程

```text
1. 生成 .zcpkg
2. 计算 packet_hash
3. 用发送方私钥签名
4. 生成随机对称密钥
5. 用对称密钥加密 .zcpkg
6. 用接收方设备公钥加密对称密钥
7. 上传 encrypted_blob
```

### 13.4 接收流程

```text
1. 下载 encrypted_blob
2. 用本机私钥解密对称密钥
3. 解密 .zcpkg
4. 校验 packet_hash
5. 校验发送方签名
6. 写入本地收件箱
7. 进入预览和导入流程
```

### 13.5 中转表

#### relay_devices

```sql
create table relay_devices (
  id uuid primary key,
  user_id uuid not null,
  device_id text not null,
  device_name text,
  public_key text not null,
  signing_public_key text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
```

#### relay_packets

```sql
create table relay_packets (
  id uuid primary key,

  sender_user_id uuid not null,
  sender_device_id text not null,

  recipient_user_id uuid not null,
  recipient_device_id text not null,

  encrypted_blob_path text not null,
  encrypted_key text not null,

  packet_hash text not null,
  signature text not null,

  size_bytes bigint,
  status text not null default 'uploaded',

  created_at timestamptz not null default now(),
  downloaded_at timestamptz,
  expires_at timestamptz
);
```

#### relay_receipts

```sql
create table relay_receipts (
  id uuid primary key,

  packet_id uuid not null,
  from_user_id uuid not null,
  from_device_id text not null,

  to_user_id uuid not null,
  to_device_id text not null,

  receipt_type text not null,
  -- downloaded, imported_personal, accepted_official, rejected, failed

  encrypted_note text,
  created_at timestamptz not null default now()
);
```

---

## 14. 多级汇报链

本地化汇报包天然支持逐级上报。

```text
员工 A → 主管
员工 B → 主管
员工 C → 主管

主管本地导入 A/B/C 的汇报包
  ↓
Agent 帮主管生成团队汇总
  ↓
主管发送“团队商机汇总包”给区域负责人

区域负责人导入多个主管的汇总包
  ↓
Agent 生成区域经营简报
  ↓
区域负责人发送给总经理
```

manifest 中保留来源链：

```json
{
  "derivedFrom": [
    {
      "packetId": "packet_a",
      "sender": "张三",
      "moduleId": "opportunity"
    },
    {
      "packetId": "packet_b",
      "sender": "李四",
      "moduleId": "opportunity"
    }
  ]
}
```

这样总经理可以追溯：

```text
这个汇总来自哪些下级汇报？
哪些数据是原始汇报？
哪些数据是主管二次整理？
哪些数据被过滤或合并过？
```

---

## 15. 分阶段实施计划

### Phase 1：本地文件汇报包 MVP

目标：不依赖云端，先跑通闭环。

范围：

```text
1. 新增本地 data packet 表
2. 新增 .zcpkg 文件格式
3. 支持从本地 SQLite 生成汇报包
4. 支持领导导入 .zcpkg
5. 支持收件箱 / 发件箱
6. 支持导入到我的汇报库
7. 支持商机、出差、考勤
8. Agent 可以读取汇报包摘要
```

不做：

```text
经营正式数据采纳
在线云中转
复杂多设备同步
WebRTC 直连
```

验收标准：

```text
员工可以在本地选择商机数据，生成汇报包。
领导可以导入该汇报包。
领导可以预览明细和摘要。
领导可以导入到本地汇报库。
Agent 可以总结该汇报包。
```

---

### Phase 2：本地正式采纳与差异对比

目标：让领导可以把汇报数据写入自己的本地正式库。

范围：

```text
1. 增加 preview diff
2. 增加 import batch
3. 增加 record lineage
4. 商机支持 upsert
5. 出差支持 append/upsert
6. 考勤支持 replace_period
7. 支持重复导入检测
8. 支持导入回滚或历史查看
```

验收标准：

```text
领导收到同一个员工第二次商机更新时，
系统能识别哪些是新增，哪些是更新，哪些无变化。
```

---

### Phase 3：端到端加密中转

目标：把文件模式升级成在线收件箱。

范围：

```text
1. 设备公钥注册
2. 汇报包端到端加密
3. 上传 encrypted packet
4. 领导自动拉取收件箱
5. 员工发件箱显示回执
6. 包过期自动清理
```

验收标准：

```text
中转服务数据库和存储中不出现任何业务明文。
领导可以在线收到员工汇报包。
员工可以看到领导是否已下载、已导入、已退回。
```

---

### Phase 4：经营数据与多级汇总

目标：让产品真正变成经营参谋。

范围：

```text
1. 经营数据汇报包
2. 经营数据本地 staging
3. 周期性 replace_period 导入
4. 多个员工 / 部门汇报合并
5. 主管生成汇总包
6. 区域负责人生成区域包
7. 总经理视角经营简报
```

---

## 16. Codex 执行任务拆解

### Task 1：新增 SQLite migration

新增本地 SQLite 表：

```text
local_data_packets
local_data_packet_records
local_received_records
local_import_batches
local_record_lineage
local_source_record_map
```

要求：

- migration 可重复执行或通过版本管理执行。
- 给常用字段加 index。
- 不破坏现有日程表。
- 现有日程转交暂时不迁移。

验收：

```text
应用启动后本地 SQLite 包含上述表。
已有日程功能不受影响。
```

---

### Task 2：新增 Rust data_packet 模块

新增目录：

```text
app/src-tauri/src/data_packet/
```

先实现：

```text
models.rs
manifest.rs
package.rs
payload.rs
import.rs
export.rs
errors.rs
```

MVP 不需要实现 crypto。

验收：

```text
Rust 能创建 manifest。
Rust 能创建 payload.sqlite。
Rust 能打包 .zcpkg。
Rust 能解包 .zcpkg。
Rust 能把 packet metadata 写入 local_data_packets。
Rust 能把 packet records 写入 local_data_packet_records。
```

---

### Task 3：实现 Tauri commands

优先实现：

```text
create_data_packet
export_data_packet_file
import_data_packet_file
list_data_packets
read_data_packet
preview_data_packet_import
import_data_packet
```

验收：

```text
前端可以通过 invoke 调用所有 command。
错误返回结构化 message，不直接 panic。
```

---

### Task 4：实现模块 adapter，先做 opportunity

优先实现：

```text
opportunity adapter
```

功能：

```text
从本地商机表选取记录。
转换为 packet_records。
生成 record_uid / record_key / row_hash。
生成摘要。
支持导入到 local_received_records。
```

验收：

```text
可从商机页生成商机汇报包。
领导导入后可在个人汇报库看到原始商机记录。
```

---

### Task 5：前端新增 data-packets feature

新增：

```text
DataPacketInboxPage
DataPacketOutboxPage
DataPacketDetailPage
PacketCard
PacketPreview
PacketImportDialog
```

验收：

```text
能看到收件箱。
能看到发件箱。
能导入 .zcpkg 文件。
能预览 packet 明细。
能导入到我的汇报库。
```

---

### Task 6：商机页增加“发送给领导”

在商机模块增加按钮：

```text
发送给领导
```

MVP 可以先让用户选择：

```text
当前筛选结果
全部商机
指定日期范围
```

验收：

```text
点击后生成 draft packet。
可以导出 .zcpkg 文件。
```

---

### Task 7：Agent 接入汇报包工具

新增 Agent tools：

```text
listLocalPackets
readLocalPacket
summarizeLocalPacket
```

MVP 不要让 Agent 自动执行正式导入。

验收：

```text
用户问“今天收到哪些汇报”，Agent 能读取本地收件箱回答。
用户问“总结这个商机汇报”，Agent 能读取 packet 摘要和明细回答。
```

---

### Task 8：支持 trip / attendance

在 opportunity 跑通后，实现：

```text
trip adapter
attendance adapter
```

验收：

```text
出差可以生成和导入汇报包。
考勤可以生成和导入汇报包。
都支持导入到 local_received_records。
```

---

### Task 9：实现正式采纳

Phase 2 执行。

功能：

```text
preview diff
import batch
lineage
source record map
official import
```

验收：

```text
重复导入同一个 packet 不会重复写正式表。
同一个下属第二次发来的更新能识别为 update。
导入后能追溯正式数据来自哪个 packet。
```

---

## 17. 测试建议

### 17.1 Rust 单元测试

至少覆盖：

```text
manifest 序列化 / 反序列化
payload.sqlite 写入 / 读取
.zcpkg 打包 / 解包
row_hash 稳定性
record_key 生成
重复导入识别
import_personal 事务
import_official 事务
lineage 写入
```

### 17.2 前端测试

至少覆盖：

```text
收件箱空状态
收件箱列表
packet 详情页
导入弹窗
导入成功状态
导入失败状态
商机页发送入口
```

### 17.3 集成测试

建议准备一个测试 fixture：

```text
fixtures/data-packets/opportunity-basic.zcpkg
fixtures/data-packets/opportunity-updated.zcpkg
fixtures/data-packets/attendance-monthly.zcpkg
```

测试：

```text
导入 basic → inserted_count > 0
再次导入 basic → skipped_count > 0
导入 updated → updated_count > 0
```

---

## 18. 安全注意事项

MVP 文件模式也需要注意：

```text
1. 导入前校验 packet_hash。
2. 不信任 manifest 中的用户展示名。
3. payload_json 必须做 schema 校验。
4. 附件路径必须防止 zip slip。
5. 解包目录必须使用应用私有目录。
6. 不允许 .zcpkg 内文件覆盖任意路径。
7. 不允许前端传入 SQL 片段。
8. 所有导入必须在事务中完成。
9. 所有导入都要写 import batch。
10. 正式导入必须记录 lineage。
```

在线中转阶段还需要：

```text
1. 业务数据端到端加密。
2. 私钥保存在 OS Keychain 或 Tauri Stronghold。
3. 中转服务不保存业务明文。
4. 回执中的备注也建议加密。
5. 汇报包自动过期清理。
```

---

## 19. 关键命名建议

产品命名：

```text
汇报包
汇报收件箱
汇报发件箱
我的汇报库
采纳为正式数据
退回修改
```

技术命名：

```text
data_packet
local_data_packets
local_received_records
local_import_batches
local_record_lineage
source_record_map
.zcpkg
```

避免使用：

```text
transfer_xxx
sync_xxx
cloud_xxx
```

因为未来核心不是云同步，而是本地优先的汇报流。

---

## 20. Codex 实施注意

请 Codex 按以下原则执行：

1. 优先小步提交，不要一次性重构所有业务模块。
2. 先保留现有日程转交逻辑，不要破坏既有能力。
3. 新能力先放在 `data-packets` feature，不要散落到各模块。
4. 先实现商机 adapter，跑通后再复制模式到出差和考勤。
5. 所有复杂导入逻辑放 Rust，不放 React 组件。
6. React 组件只负责展示和调用 command。
7. 所有导入必须事务化。
8. 所有导入必须写批次。
9. 所有正式导入必须写 lineage。
10. 不要引入新的 Supabase 业务数据表。
11. 不要把业务明文上传到中转服务。
12. 不要使用 `as any` 绕过关键类型。
13. 不要把密钥或示例真实数据写入仓库。
14. 第一阶段不需要做加密，但代码结构要给 crypto 预留位置。
15. 文件处理必须防 zip slip。

---

## 21. MVP 验收清单

```text
[ ] 本地 SQLite 已新增 data packet 相关表。
[ ] 应用可启动，现有日程功能不回归。
[ ] 商机页有“发送给领导”入口。
[ ] 可以从本地商机数据生成 .zcpkg。
[ ] .zcpkg 内包含 manifest.json 和 payload.sqlite。
[ ] 可以在另一台或同一台测试环境导入 .zcpkg。
[ ] 导入后收件箱出现该汇报包。
[ ] 可以查看汇报摘要和明细。
[ ] 可以导入到 local_received_records。
[ ] 重复导入同一包不会重复写入个人汇报库。
[ ] Agent 可以列出本地汇报包。
[ ] Agent 可以总结商机汇报包。
[ ] 错误状态有用户可读提示。
[ ] 所有导入流程有 Rust 测试。
```

---

## 22. 推荐落地顺序

最推荐的执行顺序：

```text
1. 建表
2. Rust data_packet 基础模型
3. .zcpkg 打包 / 解包
4. opportunity adapter
5. data-packets 前端页面
6. 商机页发送入口
7. 导入到个人汇报库
8. Agent 读取汇报包
9. trip adapter
10. attendance adapter
11. diff + official import
12. encrypted relay
13. biz-data packet
14. multi-level reporting
```

---

## 23. 最终架构结论

本项目应从“中心化数据看板 + AI 聊天”升级为：

```text
Local-first SQLite
+
.zcpkg 本地汇报包
+
Tauri/Rust 汇报包引擎
+
本地收件箱 / 发件箱
+
本地汇报库 / 本地正式库
+
导入批次 / 数据血缘
+
端到端加密中转
+
Agent 本地数据工具
```

这条路线能最大程度贴合产品愿景：

```text
员工不是上传数据到云端系统，
而是在本地整理工作成果，
由 Agent 协助形成汇报，
点对点发送给领导，
领导再由 Agent 协助理解、采纳和逐级上报。
```
