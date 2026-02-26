-- opportunity_ledger: 商机项目台账（周度快照）
CREATE TABLE IF NOT EXISTS opportunity_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id),

  -- 快照周次
  snapshot_date date NOT NULL,

  -- 项目基本信息
  item_type     text NOT NULL CHECK (item_type IN ('operation', 'expansion', 'tracking')),
  region        text,
  project_name  text NOT NULL,

  -- 体量
  estimated_amount numeric,

  -- 审批状态
  logistics_approved boolean DEFAULT false,
  group_approved     boolean DEFAULT false,

  -- 投标
  bid_date      date,

  -- 进展
  status        text CHECK (status IN ('tracking', 'bidding', 'contracted', 'operating', 'suspended', 'lost')),
  remark        text,
  win_probability numeric,
  manager_ready boolean DEFAULT false,

  -- 时间戳
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX idx_opp_ledger_snapshot ON opportunity_ledger(snapshot_date);
CREATE INDEX idx_opp_ledger_region ON opportunity_ledger(region);
CREATE INDEX idx_opp_ledger_type ON opportunity_ledger(item_type);
CREATE INDEX idx_opp_ledger_org ON opportunity_ledger(org_id);

-- RLS
ALTER TABLE opportunity_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view opportunity_ledger"
  ON opportunity_ledger FOR SELECT
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "managers can insert opportunity_ledger"
  ON opportunity_ledger FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "managers can update opportunity_ledger"
  ON opportunity_ledger FOR UPDATE
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- 初始数据：0206 Sheet（2026-02-06 快照）
INSERT INTO opportunity_ledger (snapshot_date, item_type, region, project_name, estimated_amount, logistics_approved, group_approved, bid_date, status, remark, win_probability, manager_ready)
VALUES
  ('2026-02-06', 'operation', '西南区域', '四川阿坝州若尔盖县后勤综合服务（食堂、安保、宿管全业态托管）', 1500, true, true, '2025-08-25', 'operating', '项目承接，开展运营工作。', 1.0, true),
  ('2026-02-06', 'operation', '西南区域', '镇沅县域教育食材配送项目', 1500, true, true, '2025-08-22', 'operating', '推进学校食堂大宗食材合同和社会餐饮食材合同签订，同步推动业务体量扩充。', 1.0, true),
  ('2026-02-06', 'expansion', '西南区域', '贵州黔南州长顺县后勤合作项目', 3600, true, true, NULL, 'contracted', '已完成商城基础架构布署工作，招标文件教育局内部会议已通过，待招投标挂网。', 1.0, false),
  ('2026-02-06', 'expansion', '西南区域', '镇沅一中食堂项目（增量）', 400, false, false, '2026-02-13', 'bidding', '投标文件已完成，2月13号开标，上会资料准备中。', 0.8, false),
  ('2026-02-06', 'expansion', '西南区域', '石屏县食材配送+小学热餐项目', NULL, false, false, NULL, 'tracking', NULL, 0.6, false),
  ('2026-02-06', 'expansion', '西南区域', '版纳州食材配送项目', NULL, false, false, NULL, 'tracking', NULL, 0.5, false),
  ('2026-02-06', 'expansion', '西南区域', '大姚县食材配送项目', 2300, false, false, NULL, 'tracking', '国资公司外包，运营能力、资金能力较差。与实际业务公司三轮洽谈，对方要求过高，持续跟进。', 0.5, false),
  ('2026-02-06', 'expansion', '西南区域', '普洱市宁洱县食材配送项目', NULL, false, false, NULL, 'tracking', '营养餐业务有合作可能，已拜访政府领导，了解目前当地在筛选合作供应商，从关系上看，竞争对手有一定优势，年前需确定合作单位。', 0.5, false),
  ('2026-02-06', 'expansion', '西南区域', '江陵一中食堂劳务项目', NULL, false, false, NULL, 'tracking', '计划近期前往江陵县教育局及学校，就新版测算方案沟通商务细节及合作模式。', 0.5, false),
  ('2026-02-06', 'operation', '东部区域', '安徽亳州N个食堂项目（劳务外包）', NULL, false, false, NULL, 'operating', NULL, 1.0, true),
  ('2026-02-06', 'operation', '东部区域', '安徽亳州利辛县教育食材配送项目', 3000, true, true, '2025-08-04', 'operating', '项目承接，开展运营工作。', 1.0, true),
  ('2026-02-06', 'expansion', '东部区域', '安徽亳州谯城区敬老院配送项目（增量）', 400, true, true, NULL, 'contracted', '项目承接，开展运营工作。', 1.0, true),
  ('2026-02-06', 'expansion', '东部区域', '安徽芜湖鸠江区教育食材配送项目', 2500, true, true, '2026-01-09', 'contracted', '对接中标后合同签订事项，同步筹备整体运营前期工作。', 1.0, true),
  ('2026-02-06', 'expansion', '东部区域', '安徽亳州谯城后勤合作（额外增量）', 500, false, false, NULL, 'tracking', E'福利商城业务：交投单位福利订单已锁定，寒假前上架并开单销售。\n食堂劳务：托管校亳州三中（第13个）准备投标。\n教育物资业务：接教育局通知暂缓推进。', 0.8, false),
  ('2026-02-06', 'expansion', '东部区域', '山东济宁高新区食材配送', 2000, false, false, '2026-01-31', 'bidding', '与济宁高新区社发集团战略合作协议签订中，同步推动后勤内部投决上会。', 0.7, false),
  ('2026-02-06', 'expansion', '东部区域', '安徽阜阳阜南县食材配送', 8000, true, false, '2026-02-06', 'bidding', '与渠道方确认合作意向，已投标，待开标。', 0.7, false),
  ('2026-02-06', 'expansion', '东部区域', '福建龙岩市上杭县食材配送', 2000, true, false, NULL, 'tracking', '招标预公告已发布，同步进行尽调及投决上会准备，仓库租赁事宜筹备中。', 0.5, false),
  ('2026-02-06', 'expansion', '东部区域', '上杭县学校后勤管理项目', NULL, false, false, NULL, 'tracking', NULL, 0.5, false),
  ('2026-02-06', 'expansion', '东部区域', '惠州市博罗县中小学综合后勤服务', NULL, false, false, NULL, 'tracking', NULL, 0.5, false),
  ('2026-02-06', 'expansion', '东部区域', '肇庆市广宁县食材配送项目', NULL, false, false, NULL, 'tracking', '已成功邀约唐副县长2月2日来我司考察。', 0.5, false),
  ('2026-02-06', 'operation', '北部区域', '周口腾飞路食堂、周口片区物业、桂圆二中食堂', 300, true, true, '2025-03-14', 'operating', '项目承接，开展运营工作。', 1.0, true),
  ('2026-02-06', 'operation', '北部区域', '兰州新区高级中学后勤综合服务', 1200, true, true, '2025-07-15', 'operating', '项目承接，开展运营工作。', 1.0, true),
  ('2026-02-06', 'operation', '北部区域', '山西省长治市潞城区项目、长治市沁县食材配送', 2200, true, true, '2025-08-04', 'operating', '已开展26所学校运营工作，持续推进第三方运营食堂纳入整体配送。', 1.0, true),
  ('2026-02-06', 'operation', '北部区域', '北京房山区食材配送项目', 3000, true, true, '2025-09-30', 'operating', '已开展运营工作', 1.0, true),
  ('2026-02-06', 'operation', '北部区域', '河南南阳市镇平县域配送项目', 4000, true, true, '2025-10-21', 'operating', '已开展运营工作。', 0.85, true),
  ('2026-02-06', 'expansion', '北部区域', '黑龙江鸡西市虎林市教育大宗食材采购', 2000, true, false, '2026-01-30', 'bidding', E'拟按平台咨询新模式承接业务，计划由我司中标，由政府指定公司实际运营。2月3日挂网，3月10日开标。集团上会资料准备中。', 0.8, false),
  ('2026-02-06', 'expansion', '北部区域', '甘肃兰州弘毅绿地学校', NULL, false, false, NULL, 'tracking', '尽调及测算已完成，预计年后邀请教卫委新主任考察。', 0.6, false),
  ('2026-02-06', 'expansion', '北部区域', '内蒙古鄂托克前旗食材配送与后勤科技项目', NULL, false, false, NULL, 'tracking', '目前初步合作方案已提供，待鄂托克前旗教育局向旗里汇报后进一步跟进。', 0.5, false),
  ('2026-02-06', 'expansion', '北部区域', '巴彦淖尔市临河区后勤综合项目', NULL, false, false, NULL, 'tracking', '截至12月17日项目进展，方案区长认可，沟通让我们直接和教育局王生局长对接，预约局长两周未有时间拜访，王局长安排分管的股长和我们对接，项目推进缓慢', 0.5, false),
  ('2026-02-06', 'expansion', '北部区域', '保定农发集团后勤综合项目（食材配送+食堂运营）', NULL, false, false, NULL, 'tracking', '保定市农发集团总经理率队考察亳州海谯汇项目，双方交流合作思路。', 0.5, false),
  ('2026-02-06', 'expansion', '北部区域', '江西市上饶、吉安后勤综合项目', 3000, false, false, NULL, 'tracking', NULL, 0.55, false),
  ('2026-02-06', 'expansion', '北部区域', '兰州新区高级中学中川校区食堂', NULL, false, false, NULL, 'tracking', '已与马金平校长接洽，计划邀约新任领导到访教育园。', 0.5, false);
