# 表格视图优化

## 实现的功能

### 1. 层级聚合筛选
添加了层级筛选控件，允许用户选择性显示不同层级的数据：

- **总计**: 顶层聚合节点（如"3. 教育后勤总计"）
- **中心合计**: 中心级聚合节点（中心合计、集团合计、区域合计、业务合计）
- **部门小计**: 子聚合节点（分类、部门小计、本级小计、区域小计）
- **业务单元**: 叶子节点（具体业务单元）

用户可以通过复选框控制每个层级的显示/隐藏，便于聚焦特定层级的数据分析。

### 2. 指标列拖拽排序
使用 `@dnd-kit` 库实现了指标列的拖拽重排功能：

- 鼠标悬停在列头时显示拖拽手柄（GripVertical 图标）
- 支持鼠标拖拽和键盘操作
- 拖拽时列会半透明显示
- 拖拽完成后自动更新列顺序
- 业务单元列固定不可拖拽

## 技术实现

### 依赖包
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 核心组件
1. **DraggableHeader**: 可拖拽的表头组件
   - 使用 `useSortable` hook
   - 集成拖拽手柄和视觉反馈

2. **层级筛选状态**:
   ```typescript
   const [showAggregation, setShowAggregation] = useState({
     total: true,
     centers: true,
     segments: true,
     leafNodes: true,
   })
   ```

3. **指标顺序状态**:
   ```typescript
   const [metricOrder, setMetricOrder] = useState<MetricCategory[]>(selectedMetrics)
   ```

### 数据过滤逻辑
根据 `orgHierarchy` 字段的 `label` 和 `level_1` 属性判断节点层级：
- `label === '聚合节点' && level_1 === '总计'` → 总计
- `label === '聚合节点' && level_1 in ['中心合计', '集团合计', ...]` → 中心合计
- `label === '聚合节点' && level_1 in ['分类', '部门小计', ...]` → 部门小计
- `level_3 !== null` → 业务单元

## 用户体验改进

1. **层级筛选**: 当数据量大时，可以快速聚焦到特定层级，避免信息过载
2. **列拖拽**: 用户可以根据分析需求自定义指标列的显示顺序
3. **视觉反馈**: 拖拽时的半透明效果和手柄图标提供清晰的交互反馈
4. **响应式设计**: 筛选控件和表格都支持横向滚动，适应不同屏幕尺寸

## 文件修改
- `app/src/components/BizData/TableView.tsx`: 主要实现文件
- `app/package.json`: 添加 @dnd-kit 依赖
