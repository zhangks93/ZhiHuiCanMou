# 考勤系统重新设计

## 数据库变更

### 新的 attendance_records 表结构

```sql
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES feishu_members(id),
  department_id text NOT NULL REFERENCES feishu_departments(department_id),
  year_month integer NOT NULL,
  expected_days numeric DEFAULT 0,
  actual_days numeric DEFAULT 0,
  leave_days numeric DEFAULT 0,
  absent_days numeric DEFAULT 0,
  late_times integer DEFAULT 0,
  early_leave_times integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, department_id, year_month)
);
```

### 主要改进

1. **正确的外键关联**
   - `member_id` → `feishu_members.id`
   - `department_id` → `feishu_departments.department_id`

2. **唯一约束**
   - 每个成员在每个部门每个月只能有一条记录

3. **索引优化**
   - member_id, department_id, year_month 单独索引
   - (year_month, department_id) 复合索引用于部门汇总查询

## 数据导入脚本

### 新脚本：`scripts/import_attendance_v2.py`

**主要特性：**

1. **通过 employee_no 匹配成员**
   - 从 feishu_members 表查询现有成员
   - 使用 employee_no 进行精确匹配

2. **智能部门匹配**
   - 优先使用成员的第一个部门ID
   - 如果没有部门ID，尝试通过部门名称匹配

3. **支持两种Excel格式**
   - 行政人员格式（24列）
   - 一线标准格式（50列）

4. **数据验证**
   - 跳过无法匹配的成员
   - 跳过缺少部门信息的记录
   - 提供详细的导入统计

### 使用方法

```bash
python scripts/import_attendance_v2.py <excel文件路径>
```

## 前端页面优化

### Attendance.tsx 改进

1. **部门层级显示**
   - 显示部门名称和上级部门
   - 按出勤率排序

2. **可展开的部门详情**
   - 点击部门行展开/收起
   - 显示该部门所有成员的详细考勤记录
   - 包含：姓名、工号、职位、各项考勤指标

3. **更好的数据关联**
   - 直接通过外键关联查询
   - 不再需要手动解析 department_id 字符串

4. **性能优化**
   - 按需加载成员详情
   - 使用索引优化的查询

## 迁移步骤

1. **数据库迁移**
   - 已通过 Supabase MCP 工具执行
   - 旧的 attendance_records 表已删除
   - 新表结构已创建

2. **重新导入数据**
   ```bash
   python scripts/import_attendance_v2.py <你的考勤Excel文件>
   ```

3. **前端更新**
   - Attendance.tsx 已更新
   - 支持新的数据结构
   - 添加了交互式部门展开功能

## 数据完整性

- 所有外键约束确保数据一致性
- 级联删除：删除成员时自动删除其考勤记录
- 唯一约束防止重复记录
- RLS 策略已启用

## 后续建议

1. **批量导入优化**
   - 考虑添加事务支持
   - 添加错误恢复机制

2. **数据验证增强**
   - 添加日期范围验证
   - 添加数值合理性检查

3. **UI 增强**
   - 添加筛选和搜索功能
   - 添加导出功能
   - 添加趋势图表
