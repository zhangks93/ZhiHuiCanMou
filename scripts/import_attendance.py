"""
考勤数据导入脚本
从Excel文件导入员工和考勤数据到Supabase
支持两种格式：行政人员格式、一线标准格式
"""

import os
import httpx
from dotenv import load_dotenv
import pandas as pd


def detect_format(df: pd.DataFrame) -> str:
    """检测Excel文件格式"""
    first_val = df.iloc[0, 0] if pd.notna(df.iloc[0, 0]) else df.iloc[1, 0]

    # 行政格式：第一列是工号（8开头数字）
    if isinstance(first_val, (int, float)) and str(int(first_val)).startswith('8'):
        return 'admin'
    # 一线格式：第四列是工号
    fourth_val = df.iloc[0, 3] if pd.notna(df.iloc[0, 3]) else df.iloc[1, 3]
    if isinstance(fourth_val, (int, float)) and str(int(fourth_val)).startswith('8'):
        return 'line'
    return 'unknown'


def parse_admin_format(df: pd.DataFrame) -> list[dict]:
    """解析行政人员格式 (24列)"""
    # 列映射: 0-工号, 1-姓名, 2-公司, 3-部门, 7-开始日期, 9-应出勤, 10-实出勤, 12-请假, 22-迟到, 23-早退
    if pd.isna(df.iloc[0, 0]):
        df = df.iloc[1:].reset_index(drop=True)

    records = []
    for _, row in df.iterrows():
        if pd.isna(row.iloc[0]) or pd.isna(row.iloc[1]):
            continue

        # 从开始日期提取年月
        period_start = row.iloc[7]
        if pd.notna(period_start):
            year_month = int(period_start.strftime('%Y%m'))
        else:
            continue

        # 计算请假天数（列12-21各类请假之和，排除加班）
        leave_sum = 0
        for i in range(12, 22):
            if pd.notna(row.iloc[i]):
                leave_sum += float(row.iloc[i])

        records.append({
            'employee_code': str(int(row.iloc[0])),
            'name': row.iloc[1],
            'company': row.iloc[2] if pd.notna(row.iloc[2]) else None,
            'department': row.iloc[3] if pd.notna(row.iloc[3]) else None,
            'year_month': year_month,
            'expected_days': float(row.iloc[9]) if pd.notna(row.iloc[9]) else 0,
            'actual_days': float(row.iloc[11]) if pd.notna(row.iloc[11]) else 0,  # 列11是实际工作天数
            'leave_days': leave_sum,
            'absent_days': 0,  # 行政表旷工数据不明显
            'late_times': int(row.iloc[22]) if pd.notna(row.iloc[22]) else 0,
            'early_leave_times': int(row.iloc[23]) if pd.notna(row.iloc[23]) else 0,
        })
    return records


def parse_line_format(df: pd.DataFrame) -> list[dict]:
    """解析一线标准格式 (50列)"""
    # 列映射: 0-公司, 1-部门, 3-工号, 4-姓名, 6-年月, 7-应出勤, 8-实出勤, 28-迟到, 29-早退, 31-旷工
    if pd.isna(df.iloc[0, 0]):
        df = df.iloc[1:].reset_index(drop=True)

    records = []
    for _, row in df.iterrows():
        if pd.isna(row.iloc[3]) or pd.notna(row.iloc[4]):
            pass
        if pd.isna(row.iloc[3]) or pd.isna(row.iloc[4]):
            continue

        year_month = int(row.iloc[6]) if pd.notna(row.iloc[6]) else None
        if not year_month:
            continue

        records.append({
            'employee_code': str(int(row.iloc[3])),
            'name': row.iloc[4],
            'company': row.iloc[0] if pd.notna(row.iloc[0]) else None,
            'department': row.iloc[1] if pd.notna(row.iloc[1]) else None,
            'year_month': year_month,
            'expected_days': float(row.iloc[7]) if pd.notna(row.iloc[7]) else 0,
            'actual_days': float(row.iloc[8]) if pd.notna(row.iloc[8]) else 0,
            'leave_days': 0,  # 一线表请假数据分散，暂不统计
            'absent_days': float(row.iloc[31]) if df.shape[1] > 31 and pd.notna(row.iloc[31]) else 0,
            'late_times': int(row.iloc[28]) if df.shape[1] > 28 and pd.notna(row.iloc[28]) else 0,
            'early_leave_times': int(row.iloc[29]) if df.shape[1] > 29 and pd.notna(row.iloc[29]) else 0,
        })
    return records


def import_data(excel_path: str):
    """导入考勤数据"""
    load_dotenv('app/.env')
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')

    if not supabase_url or not supabase_key:
        print("错误: 缺少环境变量 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY")
        return

    headers = {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation,resolution=merge-duplicates'
    }
    base_url = f"{supabase_url}/rest/v1"

    # 读取并解析Excel
    print(f"读取: {excel_path}")
    df = pd.read_excel(excel_path, header=None)

    fmt = detect_format(df)
    print(f"格式: {fmt}")

    if fmt == 'admin':
        records = parse_admin_format(df)
    elif fmt == 'line':
        records = parse_line_format(df)
    else:
        print("错误: 无法识别格式")
        return

    print(f"记录数: {len(records)}")
    if not records:
        return

    # 统计摘要
    print(f"\n摘要:")
    print(f"  员工数: {len(set(r['employee_code'] for r in records))}")
    print(f"  年月: {records[0]['year_month']}")
    print(f"  迟到: {sum(r['late_times'] for r in records)}次")
    print(f"  早退: {sum(r['early_leave_times'] for r in records)}次")
    print(f"  旷工: {sum(r['absent_days'] for r in records)}天")

    # 获取现有员工
    resp = httpx.get(f"{base_url}/employees?select=id,employee_code", headers=headers)
    employee_map = {e['employee_code']: e['id'] for e in resp.json()} if resp.status_code == 200 else {}
    print(f"\n现有员工: {len(employee_map)}")

    # 插入新员工
    new_employees = []
    for r in records:
        if r['employee_code'] not in employee_map:
            new_employees.append({
                'employee_code': r['employee_code'],
                'name': r['name'],
                'company': r['company'],
                'department': r['department'],
            })

    if new_employees:
        # 去重
        seen = set()
        unique_emps = []
        for e in new_employees:
            if e['employee_code'] not in seen:
                seen.add(e['employee_code'])
                unique_emps.append(e)

        print(f"新增员工: {len(unique_emps)}")
        resp = httpx.post(f"{base_url}/employees", headers=headers, json=unique_emps)
        if resp.status_code in [200, 201]:
            for e in resp.json():
                employee_map[e['employee_code']] = e['id']
        else:
            print(f"插入员工失败: {resp.status_code}")

    # 插入考勤记录
    attendance_records = []
    for r in records:
        emp_id = employee_map.get(r['employee_code'])
        if emp_id:
            attendance_records.append({
                'employee_id': emp_id,
                'year_month': r['year_month'],
                'expected_days': r['expected_days'],
                'actual_days': r['actual_days'],
                'leave_days': r['leave_days'],
                'absent_days': r['absent_days'],
                'late_times': r['late_times'],
                'early_leave_times': r['early_leave_times'],
            })

    if attendance_records:
        print(f"插入考勤: {len(attendance_records)}")
        resp = httpx.post(f"{base_url}/attendance_records", headers=headers, json=attendance_records)
        if resp.status_code in [200, 201]:
            print("成功!")
        else:
            print(f"失败: {resp.status_code} {resp.text[:200]}")

    print("完成!")


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("用法: python import_attendance.py <excel文件>")
        sys.exit(1)
    import_data(sys.argv[1])