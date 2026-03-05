"""
飞书通讯录同步脚本
从飞书开放平台获取部门和成员数据，同步到 Supabase（feishu_departments / feishu_members）
用法: python sync_feishu_contacts.py [--root-dept-id <id>]
      默认根部门 ID 为 "0"（整个公司），可通过参数指定
"""

import os
import json
import time
import httpx
from dotenv import load_dotenv

# ── 飞书 API 地址 ──────────────────────────────────────────────
# 部门详情: GET /contact/v3/departments/{department_id}
# 子部门列表: GET /contact/v3/departments/{department_id}/children
FEISHU_HOST = "https://open.feishu.cn/open-apis"
TOKEN_URL = f"{FEISHU_HOST}/auth/v3/tenant_access_token/internal"
DEPT_BASE_URL = f"{FEISHU_HOST}/contact/v3/departments"
USER_LIST_URL = f"{FEISHU_HOST}/contact/v3/users"
SCOPES_URL = f"{FEISHU_HOST}/contact/v3/scopes"


def _extract_parent_department_id(
    dept: dict,
    fallback_parent_id: str | None = None,
) -> str | None:
    """
    Normalize parent department id from Feishu payload.
    Feishu may return parent info as:
      - parent_department_id: str
      - parent_department_ids: list[str] | str
    """
    parent = dept.get("parent_department_id")
    if isinstance(parent, str) and parent:
        return parent

    parent_ids = dept.get("parent_department_ids")
    if isinstance(parent_ids, list):
        for value in parent_ids:
            if isinstance(value, str) and value:
                return value
    elif isinstance(parent_ids, str) and parent_ids:
        return parent_ids

    if isinstance(fallback_parent_id, str) and fallback_parent_id:
        return fallback_parent_id

    return None


def discover_root_departments(token: str) -> list[str]:
    """通过多种方式自动发现应用可访问的根部门 ID 列表"""
    headers = {"Authorization": f"Bearer {token}"}

    # 方式1: scopes API
    try:
        resp = httpx.get(SCOPES_URL, headers=headers, params={
            "department_id_type": "department_id",
            "user_id_type": "open_id",
        }, timeout=30)
        data = resp.json()
        if data.get("code") == 0:
            dept_ids = data.get("data", {}).get("department_ids", [])
            if dept_ids:
                print(f"[OK] scopes: {len(dept_ids)} root dept(s): {dept_ids}")
                return dept_ids
        print(f"  scopes API: code={data.get('code')}, msg={data.get('msg', '')}")
    except Exception as e:
        print(f"  scopes API failed: {e}")

    # 方式2: 搜索部门名称
    try:
        search_url = f"{FEISHU_HOST}/contact/v3/departments/search"
        resp = httpx.post(search_url, headers=headers, params={
            "department_id_type": "department_id",
            "user_id_type": "open_id",
            "page_size": 20,
        }, json={"query": ""}, timeout=30)
        data = resp.json()
        if data.get("code") == 0:
            items = data.get("data", {}).get("items", [])
            if items:
                # 找出没有 parent 或 parent 不在列表中的作为根
                all_ids = {d.get("department_id") for d in items}
                roots = []
                for d in items:
                    pid = d.get("parent_department_id", "")
                    if not pid or pid == "0" or pid not in all_ids:
                        roots.append(d.get("department_id"))
                        print(f"  found dept: {d.get('name')} ({d.get('department_id')}) parent={pid}")
                if roots:
                    return roots
                # 全部返回
                return [d.get("department_id") for d in items]
        print(f"  search API: code={data.get('code')}, msg={data.get('msg', '')}")
    except Exception as e:
        print(f"  search API failed: {e}")

    # 方式3: 列出根部门 0 的子部门（需要全公司通讯录权限）
    try:
        resp = httpx.get(f"{DEPT_BASE_URL}/0/children", headers=headers, params={
            "department_id_type": "department_id",
            "user_id_type": "open_id",
            "page_size": 50,
        }, timeout=30)
        data = resp.json()
        if data.get("code") == 0:
            items = data.get("data", {}).get("items", [])
            dept_ids = [d.get("department_id") for d in items]
            for d in items:
                print(f"  top-level dept: {d.get('name')} ({d.get('department_id')})")
            return dept_ids
        print(f"  children API: code={data.get('code')}, msg={data.get('msg', '')}")
    except Exception as e:
        print(f"  children API failed: {e}")

    return []


def get_tenant_token(app_id: str, app_secret: str) -> str:
    """获取 tenant_access_token"""
    resp = httpx.post(TOKEN_URL, json={"app_id": app_id, "app_secret": app_secret})
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"获取 token 失败: {data}")
    token = data["tenant_access_token"]
    print(f"[OK] tenant_access_token (expire {data.get('expire', '?')}s)")
    return token


def feishu_get(token: str, url: str, params: dict | None = None) -> dict:
    """带 token 的 GET 请求，含简单速率限制重试"""
    headers = {"Authorization": f"Bearer {token}"}
    for attempt in range(3):
        resp = httpx.get(url, headers=headers, params=params or {}, timeout=30)
        if resp.status_code == 429:
            wait = 2 ** attempt
            print(f"  限流，等待 {wait}s 后重试…")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(f"API 错误: {data}")
        return data.get("data", {})
    raise RuntimeError("重试次数用尽")


# ── 拉取部门树 ─────────────────────────────────────────────────

def fetch_departments(token: str, root_dept_id: str) -> list[dict]:
    """递归获取所有子部门，并获取每个部门的详细信息（包含 order）"""
    all_depts = []

    # 先获取根部门自身信息（部门 0 无详情接口，跳过）
    if root_dept_id != "0":
        try:
            root_data = feishu_get(token, f"{DEPT_BASE_URL}/{root_dept_id}", {
                "department_id_type": "department_id",
                "user_id_type": "open_id",
            })
            if root_data:
                dept = root_data.get("department", {})
                if dept:
                    dept = dict(dept)
                    parent_department_id = _extract_parent_department_id(dept)
                    if parent_department_id:
                        dept["parent_department_id"] = parent_department_id
                    all_depts.append(dept)
                    print(f"  根部门: {dept.get('name')} ({dept.get('department_id')})")
        except Exception as e:
            print(f"  获取根部门信息失败: {e}")

    def _crawl(parent_id: str):
        page_token = None
        while True:
            params = {
                "department_id_type": "department_id",
                "user_id_type": "open_id",
                "page_size": 50,
            }
            if page_token:
                params["page_token"] = page_token

            # 飞书: 子部门列表 GET /departments/{department_id}/children
            data = feishu_get(token, f"{DEPT_BASE_URL}/{parent_id}/children", params)
            items = data.get("items", [])
            for dept in items:
                dept_id = dept.get("department_id", "")
                normalized_parent = _extract_parent_department_id(
                    dept,
                    None if parent_id == "0" else parent_id,
                )
                # 获取部门详情以获得 order 字段
                try:
                    detail_data = feishu_get(token, f"{DEPT_BASE_URL}/{dept_id}", {
                        "department_id_type": "department_id",
                        "user_id_type": "open_id",
                    })
                    dept_detail = detail_data.get("department", {})
                    if dept_detail:
                        merged = {**dept, **dept_detail}
                        merged_parent = _extract_parent_department_id(
                            merged,
                            normalized_parent,
                        )
                        if merged_parent:
                            merged["parent_department_id"] = merged_parent
                        all_depts.append(merged)
                    else:
                        dept = dict(dept)
                        if normalized_parent:
                            dept["parent_department_id"] = normalized_parent
                        all_depts.append(dept)
                except Exception:
                    dept = dict(dept)
                    if normalized_parent:
                        dept["parent_department_id"] = normalized_parent
                    all_depts.append(dept)
                print(f"  部门: {dept.get('name')} ({dept_id}) <- {parent_id}")
                _crawl(dept_id)

            if not data.get("has_more"):
                break
            page_token = data.get("page_token")

    _crawl(root_dept_id)
    return all_depts


# ── 拉取成员 ──────────────────────────────────────────────────

def fetch_members(token: str, department_id: str) -> list[dict]:
    """获取指定部门的直属成员（不含子部门）"""
    members = []
    page_token = None
    while True:
        params = {
            "department_id_type": "department_id",
            "user_id_type": "open_id",
            "department_id": department_id,
            "page_size": 50,
        }
        if page_token:
            params["page_token"] = page_token

        data = feishu_get(token, f"{USER_LIST_URL}/find_by_department", params)
        items = data.get("items", [])
        members.extend(items)

        if not data.get("has_more"):
            break
        page_token = data.get("page_token")

    return members


# ── 写入 Supabase ─────────────────────────────────────────────

def upsert_departments(
    base_url: str,
    headers: dict,
    departments: list[dict],
    member_counts: dict[str, int] | None = None,
):
    """将部门数据 upsert 到 feishu_departments"""
    rows = []
    for d in departments:
        dept_id = d.get("department_id", "") or ""
        parent_department_id = _extract_parent_department_id(d)
        parent_id = parent_department_id if parent_department_id and parent_department_id != "0" else None

        # 处理排序字段，兼容字符串 / 数字
        order_raw = d.get("order", 0)
        try:
            order_value = int(order_raw)
        except (TypeError, ValueError):
            order_value = 0

        # 优先使用计算得到的成员数量，其次回落到接口返回字段
        if member_counts is not None:
            mc = member_counts.get(dept_id, 0)
        else:
            mc_raw = d.get("member_count", 0)
            try:
                mc = int(mc_raw)
            except (TypeError, ValueError):
                mc = 0

        rows.append({
            "department_id": dept_id,
            "name": d.get("name", ""),
            "parent_id": parent_id,
            "order_value": order_value,
            "member_count": mc,
            "leader_user_id": d.get("leader_user_id", None),
            "status": json.dumps(d.get("status", {})),
        })

    if not rows:
        print("无部门数据")
        return

    # 分批 upsert（每批 100）
    for i in range(0, len(rows), 100):
        batch = rows[i:i+100]
        # 使用 on_conflict=department_id 来做 upsert
        resp = httpx.post(
            f"{base_url}/feishu_departments",
            headers={**headers, "Prefer": "return=representation,resolution=merge-duplicates"},
            json=batch,
            timeout=30,
        )
        if resp.status_code in [200, 201]:
            print(f"  [OK] dept upsert {len(batch)}")
        else:
            print(f"  [FAIL] dept upsert: {resp.status_code} {resp.text[:300]}")


def _is_missing_column_error(resp: httpx.Response, column_name: str) -> bool:
    if resp.status_code != 400:
        return False
    text = (resp.text or "").lower()
    return (
        '"code":"42703"' in text
        and "does not exist" in text
        and column_name.lower() in text
    )


def detect_member_department_column(base_url: str, headers: dict) -> str:
    """探测 feishu_members 使用 department_id 还是 department_ids 列。"""
    candidates = ("department_id", "department_ids")
    for column in candidates:
        try:
            resp = httpx.get(
                f"{base_url}/feishu_members",
                headers=headers,
                params={"select": column, "limit": 1},
                timeout=30,
            )
        except Exception as e:
            print(f"  [WARN] detect column failed for {column}: {e}")
            continue

        if resp.status_code == 200:
            print(f"  [OK] feishu_members column: {column}")
            return column
        if _is_missing_column_error(resp, column):
            continue

    # 默认优先使用 department_id，兼容当前库结构
    print("  [WARN] failed to auto-detect department column, fallback to department_id")
    return "department_id"


def build_member_rows(members: list[dict], dept_column: str) -> list[dict]:
    """构建 feishu_members upsert 数据，按指定部门字段写入。"""
    rows = []
    seen_open_ids = set()
    for m in members:
        open_id = m.get("open_id", "")
        if not open_id or open_id in seen_open_ids:
            continue
        seen_open_ids.add(open_id)

        avatar = m.get("avatar", {})
        dept_ids = m.get("department_ids", [])

        # 目前约定：每个员工只归属一个部门
        # 飞书返回的是列表，这里取第一个部门 ID，作为与部门表 department_id 一致的文本字段
        primary_dept_id: str | None
        if isinstance(dept_ids, list):
            primary_dept_id = dept_ids[0] if dept_ids else None
        else:
            # 兼容后端未来可能直接返回字符串的情况
            primary_dept_id = dept_ids or None

        rows.append({
            "open_id": open_id,
            "user_id": m.get("user_id", None),
            "name": m.get("name", ""),
            "en_name": m.get("en_name", None),
            "employee_no": m.get("employee_no", None),
            "email": m.get("email", None),
            "avatar_url": avatar.get("avatar_origin") or avatar.get("avatar_240") or avatar.get("avatar_72") or None,
            dept_column: primary_dept_id,
            "job_title": m.get("job_title", None),
            "gender": m.get("gender", 0),
            "employee_type": m.get("employee_type", None),
            "status": json.dumps(m.get("status", {})),
            "join_time": m.get("join_time", None),
        })
    return rows


def upsert_members(base_url: str, headers: dict, members: list[dict]):
    """将成员数据 upsert 到 feishu_members"""
    dept_column = detect_member_department_column(base_url, headers)
    attempted_columns = {dept_column}
    rows = build_member_rows(members, dept_column)

    if not rows:
        print("无成员数据")
        return

    i = 0
    while i < len(rows):
        batch = rows[i:i+100]
        resp = httpx.post(
            f"{base_url}/feishu_members",
            headers={**headers, "Prefer": "return=representation,resolution=merge-duplicates"},
            json=batch,
            timeout=30,
        )
        if resp.status_code in [200, 201]:
            print(f"  [OK] member upsert {len(batch)}")
            i += 100
            continue

        # 兼容历史库字段命名：department_id <-> department_ids
        if _is_missing_column_error(resp, dept_column):
            fallback_column = "department_ids" if dept_column == "department_id" else "department_id"
            if fallback_column not in attempted_columns:
                print(
                    f"  [WARN] column {dept_column} not found, retry with {fallback_column}"
                )
                attempted_columns.add(fallback_column)
                dept_column = fallback_column
                rows = build_member_rows(members, dept_column)
                i = 0
            else:
                print(
                    f"  [FAIL] member upsert: missing both department_id and department_ids columns, detail={resp.text[:300]}"
                )
                i += 100
        else:
            print(f"  [FAIL] member upsert: {resp.status_code} {resp.text[:300]}")
            i += 100


# ── 主流程 ────────────────────────────────────────────────────

def sync(root_dept_id: str = "0"):
    load_dotenv("app/.env")

    app_id = os.getenv("FEISHU_APP_ID") or os.getenv("VITE_FEISHU_APP_ID")
    app_secret = os.getenv("FEISHU_APP_SECRET")
    supabase_url = os.getenv("VITE_SUPABASE_URL")
    supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY")

    if not app_id or not app_secret:
        print("错误: 缺少 FEISHU_APP_ID / FEISHU_APP_SECRET")
        print("请在 app/.env 中添加：")
        print("  FEISHU_APP_ID=cli_xxxx")
        print("  FEISHU_APP_SECRET=xxxx")
        return
    if not supabase_url or not supabase_key:
        print("错误: 缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY")
        return

    sb_headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }
    sb_base = f"{supabase_url}/rest/v1"

    # 1) 获取 token
    token = get_tenant_token(app_id, app_secret)

    # 2) 自动发现可访问的根部门（当 root_dept_id=0 时）
    root_ids = [root_dept_id]
    if root_dept_id == "0":
        discovered = discover_root_departments(token)
        if discovered:
            root_ids = discovered
            print(f"  auto-discovered root dept IDs: {root_ids}")
        else:
            print("  no scoped depts found, using 0")

    # 3) 拉取部门
    departments = []
    for rid in root_ids:
        print(f"\n-- fetch dept tree (root: {rid}) --")
        depts = fetch_departments(token, rid)
        departments.extend(depts)
    print(f"\ntotal departments: {len(departments)}\n")

    # 3) 拉取成员（遍历每个部门）
    print("── 拉取成员 ──")
    all_members = []
    dept_ids_to_crawl = [d.get("department_id", "") for d in departments]
    # 也包含根部门自身
    if root_dept_id != "0" and root_dept_id not in dept_ids_to_crawl:
        dept_ids_to_crawl.insert(0, root_dept_id)

    for dept_id in dept_ids_to_crawl:
        if not dept_id:
            continue
        members = fetch_members(token, dept_id)
        dept_name = next((d["name"] for d in departments if d.get("department_id") == dept_id), dept_id)
        print(f"  {dept_name}: {len(members)} 人")
        all_members.extend(members)

    # 去重（同一人可能在多个部门）
    unique_map = {}
    for m in all_members:
        oid = m.get("open_id", "")
        if oid:
            unique_map[oid] = m
    unique_members = list(unique_map.values())
    print(f"共获取 {len(unique_members)} 个唯一成员\n")

    # 基于成员数据计算各部门成员数
    dept_member_counts: dict[str, int] = {}
    for m in unique_members:
        dept_ids = m.get("department_ids", [])
        # 兼容新格式：department_ids 现在是单个字符串而非数组
        if isinstance(dept_ids, str):
            dept_ids = [dept_ids] if dept_ids else []
        for dept_id in dept_ids:
            if not dept_id:
                continue
            dept_member_counts[dept_id] = dept_member_counts.get(dept_id, 0) + 1

    # 4) 写入 Supabase
    print("── 写入 Supabase ──")
    upsert_departments(sb_base, sb_headers, departments, dept_member_counts)
    upsert_members(sb_base, sb_headers, unique_members)

    print(f"\n完成! 部门 {len(departments)} 个, 成员 {len(unique_members)} 人")


if __name__ == "__main__":
    import sys
    root = "0"
    if "--root-dept-id" in sys.argv:
        idx = sys.argv.index("--root-dept-id")
        if idx + 1 < len(sys.argv):
            root = sys.argv[idx + 1]
    sync(root)
