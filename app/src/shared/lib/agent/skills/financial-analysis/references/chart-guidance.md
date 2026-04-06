# 图表输出规范（fenced html + ECharts）

在经营分析中，只有当图表比文字或表格更能说明问题时，才绘制图表。
优先输出 **带 `html` 语言标签的 fenced code block**，代码内容为可复制运行的 HTML + ECharts，而不是只给图表建议或伪代码。

## 与报告模板中「推荐图 N」的关系

`biz-analysis-report.md` 等模板里的「推荐图 1 / 推荐图 2」仅表示**章节结构与占位提示**，便于知道何处适合插图。**最终输出**中，ECharts 的 `title` / 图题必须使用**结论式标题**（见下文「标题要求」），不得把「推荐图 1」当作对外标题。模板用于结构，图表规范用于成稿。

## 基本原则
- 先有分析结论，再决定是否画图
- 一张图尽量只表达一个重点
- 图表服务于解释，不做装饰
- 数据不足、口径不一致、只有单点数据时，不强行绘图
- 如表格更清楚，直接用表格
- 整个报告图的数量尽量控制在3-6个

## 输出方式
需要绘图时，优先输出：
- 带 `html` 语言标签的 fenced code block
- 内含 ECharts 容器与初始化代码的完整 HTML
- 明确的标题、单位、tooltip、legend
- 合理的宽高（通常宽度 100%，高度 380px–520px）
- 结论式标题，不使用“图1 / 图2 / 图3”

## 图表选择建议
Agent 可根据数据和结论自行选择最合适的图表类型，常见映射如下：

- **趋势**：折线图、柱线组合图  
  适合收入、利润、毛利率、人效等月度变化

- **对比**：柱状图、横向条形图  
  适合节点、区域、业务之间的收入/利润/达成率对比

- **结构**：环形图、堆叠柱状图  
  适合收入结构、费用结构、区域贡献结构

- **偏差归因**：瀑布图、桥图  
  适合预算 vs 实际、利润偏差、费用偏差拆解

- **风险分层**：散点图、热力图、优先级矩阵  
  适合达成率、利润率、规模综合判断

- **目标进度**：条形进度图、柱状图  
  适合年度目标、预算达成、累计进度展示

## ECharts 使用要求
- tooltip 默认开启，并展示完整业务信息
- 多序列图默认开启 legend
- 单位必须明确：万元、%、人
- 不同单位优先拆图，或使用双 Y 轴
- 类目较多时可启用 `dataZoom`
- 名称过长时，旋转标签、截断，或改用横向条形图
- 金额/比例格式化要清晰，避免过多小数

## 多图组织
如需多张图，按主题拆开，常见顺序：
1. 总体趋势
2. 结构分析
3. 对比分析
4. 偏差归因
5. 风险识别

不要把过多结论塞进同一张图。

## 标题要求
优先使用“结论式标题”，例如：
- 月度收入保持增长，但税前利润修复偏慢
- 三大区域收入贡献高于其他板块
- 税前利润偏差主要由毛利率下降驱动

避免使用：
- 图1
- 收入图
- 统计图

## 什么时候不画图
以下情况通常不建议绘图：
- 只有一个数据点
- 数据缺失明显
- 对比口径不一致
- 图表不会比文字更清楚
- 用户没有图表需求，且图表不会提升理解

## Agent 自主权
Agent 可以根据：
- 分析目标
- 数据结构
- 指标单位
- 展示重点

自主决定：
- 是否绘图
- 绘制几张图
- 图表类型
- 是否输出单图或多图 fenced `html` 代码块
- 是否加入 dataZoom、双轴、排序、Top N、风险分层等设计

原则只有一个：**让图表更有效地支持经营分析结论。**

---

## ECharts 代码模板

以下为常用图表的完整 HTML + ECharts 代码模板，可直接复制并替换数据使用。

### 模板 1：柱折组合图（收入达成 + 达成率）

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
</head><body>
<div id="chart" style="width:100%;height:420px;"></div>
<script>
var chart = echarts.init(document.getElementById('chart'));
chart.setOption({
  title: { text: '收入规模基本达成，但利润转化仍需改善', left: 'center', textStyle: { fontSize: 15 } },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
    formatter: function(p) { return p.map(function(i) { return i.seriesName + ': ' + (i.seriesName.indexOf('率') >= 0 ? i.value + '%' : i.value + ' 万元'); }).join('<br>'); }
  },
  legend: { bottom: 0 },
  grid: { left: 60, right: 60, top: 50, bottom: 40 },
  xAxis: { type: 'category', data: ['营业收入', '毛利', '税前利润'] },
  yAxis: [
    { type: 'value', name: '万元', axisLabel: { formatter: '{value}' } },
    { type: 'value', name: '%', min: 0, max: 120, axisLabel: { formatter: '{value}%' } }
  ],
  series: [
    { name: '实际', type: 'bar', data: [5200, 1800, 620], itemStyle: { color: '#5470c6' } },
    { name: '年初预算', type: 'bar', data: [5500, 2000, 700], itemStyle: { color: '#91cc75' } },
    { name: '突围考核', type: 'bar', data: [5800, 2100, 750], itemStyle: { color: '#fac858' } },
    { name: '预算达成率', type: 'line', yAxisIndex: 1, data: [94.5, 90.0, 88.6], symbol: 'circle', symbolSize: 8, itemStyle: { color: '#ee6666' },
      label: { show: true, formatter: '{c}%', position: 'top' } }
  ]
});
window.addEventListener('resize', function() { chart.resize(); });
</script></body></html>
```

### 模板 2：瀑布图（利润偏差归因）

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
</head><body>
<div id="chart" style="width:100%;height:420px;"></div>
<script>
var chart = echarts.init(document.getElementById('chart'));
// 瀑布图通过透明底座 + 实际值柱形实现
var categories = ['预算利润', '收入影响', '毛利率影响', '人工成本', '其他费用', '实际利润'];
var base =       [0,         700,        620,          570,        530,        0];
var values =     [700,       -80,        -50,          -40,        -30,        500];
var colors = values.map(function(v, i) {
  if (i === 0 || i === categories.length - 1) return '#5470c6';
  return v >= 0 ? '#91cc75' : '#ee6666';
});
chart.setOption({
  title: { text: '税前利润偏差主要由毛利率下降和人工成本上升驱动', left: 'center', textStyle: { fontSize: 15 } },
  tooltip: { trigger: 'axis', formatter: function(p) { var v = p[1]; return v.name + ': ' + (v.value >= 0 ? '+' : '') + v.value + ' 万元'; } },
  grid: { left: 60, right: 30, top: 50, bottom: 30 },
  xAxis: { type: 'category', data: categories },
  yAxis: { type: 'value', name: '万元' },
  series: [
    { name: '底座', type: 'bar', stack: 'total', data: base, itemStyle: { color: 'transparent' }, emphasis: { itemStyle: { color: 'transparent' } } },
    { name: '差异', type: 'bar', stack: 'total', data: values.map(function(v, i) { return { value: Math.abs(v), itemStyle: { color: colors[i] } }; }),
      label: { show: true, position: 'top', formatter: function(p) { return (values[p.dataIndex] >= 0 ? '+' : '') + values[p.dataIndex]; } }
    }
  ]
});
window.addEventListener('resize', function() { chart.resize(); });
</script></body></html>
```

### 模板 3：堆叠柱形图（分板块收入结构）

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
</head><body>
<div id="chart" style="width:100%;height:420px;"></div>
<script>
var chart = echarts.init(document.getElementById('chart'));
chart.setOption({
  title: { text: '三大区域收入贡献超六成，商业业务增速领先', left: 'center', textStyle: { fontSize: 15 } },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: function(v) { return v + ' 万元'; } },
  legend: { bottom: 0 },
  grid: { left: 60, right: 30, top: 50, bottom: 40 },
  xAxis: { type: 'category', data: ['8月', '9月', '10月', '11月', '12月', '1月', '2月'] },
  yAxis: { type: 'value', name: '万元' },
  series: [
    { name: '后勤管理中心', type: 'bar', stack: 'total', data: [320, 340, 350, 330, 360, 340, 350], itemStyle: { color: '#5470c6' } },
    { name: '东部区域', type: 'bar', stack: 'total', data: [180, 190, 200, 195, 210, 200, 205], itemStyle: { color: '#91cc75' } },
    { name: '北部区域', type: 'bar', stack: 'total', data: [150, 160, 155, 165, 170, 160, 165], itemStyle: { color: '#fac858' } },
    { name: '西南区域', type: 'bar', stack: 'total', data: [120, 130, 125, 135, 140, 130, 135], itemStyle: { color: '#ee6666' } },
    { name: '商业业务', type: 'bar', stack: 'total', data: [80, 90, 95, 100, 110, 105, 115], itemStyle: { color: '#73c0de' } }
  ]
});
window.addEventListener('resize', function() { chart.resize(); });
</script></body></html>
```

### 使用说明
- 复制模板后，替换 `data` 数组中的数据为实际查询结果
- 修改 `title.text` 为结论式标题
- 根据实际板块/指标调整 `categories`、`series` 等
- 所有金额单位统一为万元，比率统一为 %