"""
飞书通讯录同步脚本

功能:
1. 每次同步都刷新当前态表: feishu_departments / feishu_members / profiles
2. 当本次同步时间距离上次已保存快照 >= 7 天时，额外写入历史快照:
   - feishu_sync_runs
   - feishu_department_snapshots
   - feishu_member_snapshots
3. 应用端可基于最近两次快照查看部门人数变动

用法:
  python scripts/sync_feishu_contacts.py [--root-dept-id <id>]
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv


FEISHU_HOST = "https://open.feishu.cn/open-apis"
TOKEN_URL = f"{FEISHU_HOST}/auth/v3/tenant_access_token/internal"
DEPT_BASE_URL = f"{FEISHU_HOST}/contact/v3/departments"
USER_LIST_URL = f"{FEISHU_HOST}/contact/v3/users"
SCOPES_URL = f"{FEISHU_HOST}/contact/v3/scopes"

SNAPSHOT_INTERVAL = timedelta(days=7)
REQUEST_TIMEOUT = 30
UPSERT_BATCH_SIZE = 100
SNAPSHOT_BATCH_SIZE = 200
DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def chunked(items: list[dict], size: int) -> list[list[dict]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def normalize_department_ids(value: object) -> list[str]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str) and item]
    if isinstance(value, str) and value:
        return [value]
    return []


def _extract_parent_department_id(
    dept: dict,
    fallback_parent_id: str | None = None,
) -> str | None:
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
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp = httpx.get(
            SCOPES_URL,
            headers=headers,
            params={"department_id_type": "department_id", "user_id_type": "open_id"},
            timeout=REQUEST_TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0:
            dept_ids = data.get("data", {}).get("department_ids", [])
            if dept_ids:
                print(f"[OK] scopes: {len(dept_ids)} root dept(s): {dept_ids}")
                return dept_ids
        print(f"  scopes API: code={data.get('code')}, msg={data.get('msg', '')}")
    except Exception as exc:
        print(f"  scopes API failed: {exc}")

    try:
        search_url = f"{FEISHU_HOST}/contact/v3/departments/search"
        resp = httpx.post(
            search_url,
            headers=headers,
            params={
                "department_id_type": "department_id",
                "user_id_type": "open_id",
                "page_size": 20,
            },
            json={"query": ""},
            timeout=REQUEST_TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0:
            items = data.get("data", {}).get("items", [])
            if items:
                all_ids = {d.get("department_id") for d in items}
                roots: list[str] = []
                for dept in items:
                    parent_id = dept.get("parent_department_id", "")
                    if not parent_id or parent_id == "0" or parent_id not in all_ids:
                        roots.append(dept.get("department_id"))
                        print(
                            f"  found dept: {dept.get('name')} ({dept.get('department_id')}) parent={parent_id}"
                        )
                if roots:
                    return roots
                return [d.get("department_id") for d in items if d.get("department_id")]
        print(f"  search API: code={data.get('code')}, msg={data.get('msg', '')}")
    except Exception as exc:
        print(f"  search API failed: {exc}")

    try:
        resp = httpx.get(
            f"{DEPT_BASE_URL}/0/children",
            headers=headers,
            params={
                "department_id_type": "department_id",
                "user_id_type": "open_id",
                "page_size": 50,
            },
            timeout=REQUEST_TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0:
            items = data.get("data", {}).get("items", [])
            dept_ids = [d.get("department_id") for d in items if d.get("department_id")]
            for dept in items:
                print(f"  top-level dept: {dept.get('name')} ({dept.get('department_id')})")
            return dept_ids
        print(f"  children API: code={data.get('code')}, msg={data.get('msg', '')}")
    except Exception as exc:
        print(f"  children API failed: {exc}")

    return []


def get_tenant_token(app_id: str, app_secret: str) -> str:
    resp = httpx.post(TOKEN_URL, json={"app_id": app_id, "app_secret": app_secret}, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"获取 token 失败: {data}")
    token = data["tenant_access_token"]
    print(f"[OK] tenant_access_token (expire {data.get('expire', '?')}s)")
    return token


def feishu_get(token: str, url: str, params: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    for attempt in range(3):
        resp = httpx.get(url, headers=headers, params=params or {}, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 429:
            wait_seconds = 2 ** attempt
            print(f"  限流，等待 {wait_seconds}s 后重试…")
            time.sleep(wait_seconds)
            continue
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(f"API 错误: {data}")
        return data.get("data", {})
    raise RuntimeError("重试次数用尽")


def rest_get(base_url: str, headers: dict, table: str, params: dict) -> list[dict]:
    resp = httpx.get(f"{base_url}/{table}", headers=headers, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else []


def rest_insert(base_url: str, headers: dict, table: str, rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    resp = httpx.post(
        f"{base_url}/{table}",
        headers={**headers, "Prefer": "return=representation"},
        json=rows,
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else []


def fetch_departments(token: str, root_dept_id: str) -> list[dict]:
    all_depts: list[dict] = []
    seen_department_ids: set[str] = set()

    if root_dept_id != "0":
        try:
            root_data = feishu_get(
                token,
                f"{DEPT_BASE_URL}/{root_dept_id}",
                {"department_id_type": "department_id", "user_id_type": "open_id"},
            )
            dept = root_data.get("department", {})
            if dept and dept.get("department_id") not in seen_department_ids:
                dept = dict(dept)
                parent_department_id = _extract_parent_department_id(dept)
                if parent_department_id:
                    dept["parent_department_id"] = parent_department_id
                seen_department_ids.add(dept["department_id"])
                all_depts.append(dept)
                print(f"  根部门: {dept.get('name')} ({dept.get('department_id')})")
        except Exception as exc:
            print(f"  获取根部门信息失败: {exc}")

    def crawl(parent_id: str):
        page_token = None
        while True:
            params = {
                "department_id_type": "department_id",
                "user_id_type": "open_id",
                "page_size": 50,
            }
            if page_token:
                params["page_token"] = page_token

            data = feishu_get(token, f"{DEPT_BASE_URL}/{parent_id}/children", params)
            items = data.get("items", [])
            for dept in items:
                dept_id = dept.get("department_id", "")
                if not dept_id:
                    continue

                normalized_parent = _extract_parent_department_id(
                    dept,
                    None if parent_id == "0" else parent_id,
                )
                try:
                    detail_data = feishu_get(
                        token,
                        f"{DEPT_BASE_URL}/{dept_id}",
                        {"department_id_type": "department_id", "user_id_type": "open_id"},
                    )
                    dept_detail = detail_data.get("department", {})
                    merged = {**dept, **dept_detail} if dept_detail else dict(dept)
                except Exception:
                    merged = dict(dept)

                merged_parent = _extract_parent_department_id(merged, normalized_parent)
                if merged_parent:
                    merged["parent_department_id"] = merged_parent

                if dept_id not in seen_department_ids:
                    seen_department_ids.add(dept_id)
                    all_depts.append(merged)
                print(f"  部门: {merged.get('name')} ({dept_id}) <- {parent_id}")
                crawl(dept_id)

            if not data.get("has_more"):
                break
            page_token = data.get("page_token")

    crawl(root_dept_id)
    return all_depts


def fetch_members(token: str, department_id: str) -> list[dict]:
    members: list[dict] = []
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
        members.extend(data.get("items", []))

        if not data.get("has_more"):
            break
        page_token = data.get("page_token")

    return members


def upsert_departments(
    base_url: str,
    headers: dict,
    departments: list[dict],
    member_counts: dict[str, int],
):
    rows: list[dict] = []
    for dept in departments:
        dept_id = dept.get("department_id", "") or ""
        if not dept_id:
            continue

        parent_department_id = _extract_parent_department_id(dept)
        parent_id = parent_department_id if parent_department_id and parent_department_id != "0" else None

        order_raw = dept.get("order", 0)
        try:
            order_value = int(order_raw)
        except (TypeError, ValueError):
            order_value = 0

        rows.append(
            {
                "department_id": dept_id,
                "name": dept.get("name", ""),
                "parent_id": parent_id,
                "order_value": order_value,
                "member_count": member_counts.get(dept_id, 0),
                "leader_user_id": dept.get("leader_user_id"),
                "status": dept.get("status", {}),
            }
        )

    if not rows:
        print("无部门数据")
        return

    for batch in chunked(rows, UPSERT_BATCH_SIZE):
        resp = httpx.post(
            f"{base_url}/feishu_departments",
            headers={**headers, "Prefer": "return=representation,resolution=merge-duplicates"},
            params={"on_conflict": "department_id"},
            json=batch,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            print(f"  [OK] dept upsert {len(batch)}")
        else:
            print(f"  [FAIL] dept upsert: {resp.status_code} {resp.text[:300]}")


def _is_missing_column_error(resp: httpx.Response, column_name: str) -> bool:
    if resp.status_code != 400:
        return False
    text = (resp.text or "").lower()
    return '"code":"42703"' in text and "does not exist" in text and column_name.lower() in text


def detect_member_department_column(base_url: str, headers: dict) -> str:
    for column in ("department_id", "department_ids"):
        try:
            resp = httpx.get(
                f"{base_url}/feishu_members",
                headers=headers,
                params={"select": column, "limit": 1},
                timeout=REQUEST_TIMEOUT,
            )
        except Exception as exc:
            print(f"  [WARN] detect column failed for {column}: {exc}")
            continue

        if resp.status_code == 200:
            print(f"  [OK] feishu_members column: {column}")
            return column
        if _is_missing_column_error(resp, column):
            continue

    print("  [WARN] failed to auto-detect department column, fallback to department_id")
    return "department_id"


def build_member_rows(members: list[dict], dept_column: str) -> list[dict]:
    rows: list[dict] = []
    seen_open_ids: set[str] = set()
    for member in members:
        open_id = member.get("open_id", "")
        if not open_id or open_id in seen_open_ids:
            continue
        seen_open_ids.add(open_id)

        avatar = member.get("avatar", {})
        dept_ids = normalize_department_ids(member.get("department_ids"))
        primary_dept_id = dept_ids[0] if dept_ids else None

        rows.append(
            {
                "open_id": open_id,
                "user_id": member.get("user_id"),
                "name": member.get("name", ""),
                "en_name": member.get("en_name"),
                "employee_no": member.get("employee_no"),
                "email": member.get("email"),
                "avatar_url": avatar.get("avatar_origin") or avatar.get("avatar_240") or avatar.get("avatar_72"),
                dept_column: primary_dept_id,
                "job_title": member.get("job_title"),
                "gender": member.get("gender", 0),
                "employee_type": member.get("employee_type"),
                "status": member.get("status", {}),
                "join_time": member.get("join_time"),
            }
        )
    return rows


def list_existing_profiles(base_url: str, headers: dict) -> list[dict]:
    rows = rest_get(
        base_url,
        headers,
        "profiles",
        {
            "select": "id,feishu_open_id",
            "feishu_open_id": "not.is.null",
            "limit": "10000",
        },
    )
    print(f"  [OK] profiles loaded: {len(rows)} existing profile(s) with feishu_open_id")
    return rows


def build_profile_rows(members: list[dict], existing_profiles: list[dict]) -> list[dict]:
    profile_by_open_id: dict[str, dict] = {}
    for profile in existing_profiles:
        open_id = profile.get("feishu_open_id")
        profile_id = profile.get("id")
        if isinstance(open_id, str) and open_id and isinstance(profile_id, str) and profile_id:
            profile_by_open_id[open_id] = profile

    rows: list[dict] = []
    synced_profile_ids: set[str] = set()
    unmatched_members = 0

    for member in members:
        open_id = member.get("open_id")
        if not isinstance(open_id, str) or not open_id:
            continue

        profile = profile_by_open_id.get(open_id)
        if profile is None:
            unmatched_members += 1
            continue

        profile_id = profile.get("id")
        if not isinstance(profile_id, str) or not profile_id or profile_id in synced_profile_ids:
            continue
        synced_profile_ids.add(profile_id)

        avatar = member.get("avatar", {})
        avatar_url = None
        if isinstance(avatar, dict):
            avatar_url = avatar.get("avatar_origin") or avatar.get("avatar_240") or avatar.get("avatar_72")

        rows.append(
            {
                "id": profile_id,
                "feishu_open_id": open_id,
                "name": member.get("name", ""),
                "avatar_url": avatar_url,
                "org_id": DEFAULT_ORG_ID,
                "updated_at": to_iso(utc_now()),
            }
        )

    print(
        f"  [OK] profiles prepared: {len(rows)} matched existing profiles, "
        f"{unmatched_members} members skipped (no existing profile)"
    )
    return rows


def upsert_profiles(base_url: str, headers: dict, members: list[dict]):
    existing_profiles = list_existing_profiles(base_url, headers)
    profile_rows = build_profile_rows(members, existing_profiles)

    if not profile_rows:
        print("无可同步 profiles 数据（未匹配到已有 public.profiles 用户）")
        return

    for batch in chunked(profile_rows, UPSERT_BATCH_SIZE):
        resp = httpx.post(
            f"{base_url}/profiles",
            headers={**headers, "Prefer": "return=representation,resolution=merge-duplicates"},
            json=batch,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            print(f"  [OK] profiles upsert {len(batch)}")
        else:
            print(f"  [FAIL] profiles upsert: {resp.status_code} {resp.text[:300]}")


def upsert_members(base_url: str, headers: dict, members: list[dict]):
    dept_column = detect_member_department_column(base_url, headers)
    attempted_columns = {dept_column}
    rows = build_member_rows(members, dept_column)

    if not rows:
        print("无成员数据")
        return

    index = 0
    while index < len(rows):
        batch = rows[index:index + UPSERT_BATCH_SIZE]
        resp = httpx.post(
            f"{base_url}/feishu_members",
            headers={**headers, "Prefer": "return=representation,resolution=merge-duplicates"},
            params={"on_conflict": "open_id"},
            json=batch,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            print(f"  [OK] member upsert {len(batch)}")
            index += UPSERT_BATCH_SIZE
            continue

        if _is_missing_column_error(resp, dept_column):
            fallback_column = "department_ids" if dept_column == "department_id" else "department_id"
            if fallback_column not in attempted_columns:
                print(f"  [WARN] column {dept_column} not found, retry with {fallback_column}")
                attempted_columns.add(fallback_column)
                dept_column = fallback_column
                rows = build_member_rows(members, dept_column)
                index = 0
                continue

            print(f"  [FAIL] member upsert: missing both department columns, detail={resp.text[:300]}")
            index += UPSERT_BATCH_SIZE
            continue

        print(f"  [FAIL] member upsert: {resp.status_code} {resp.text[:300]}")
        index += UPSERT_BATCH_SIZE


def get_latest_snapshot_run(base_url: str, headers: dict) -> dict | None:
    rows = rest_get(
        base_url,
        headers,
        "feishu_sync_runs",
        {
            "select": "id,snapshot_at,created_at",
            "snapshot_taken": "eq.true",
            "order": "snapshot_at.desc,created_at.desc",
            "limit": "1",
        },
    )
    return rows[0] if rows else None


def should_take_snapshot(last_snapshot_at: datetime | None, current_time: datetime) -> tuple[bool, str]:
    if last_snapshot_at is None:
        return True, "首个可用快照"

    elapsed = current_time - last_snapshot_at
    if elapsed >= SNAPSHOT_INTERVAL:
        return True, f"距离上次快照已 {elapsed.days} 天"

    remaining = SNAPSHOT_INTERVAL - elapsed
    remaining_days = max(1, int(remaining.total_seconds() // 86400) + (1 if remaining.total_seconds() % 86400 else 0))
    return False, f"距离 7 天阈值还差约 {remaining_days} 天"


def insert_sync_run(
    base_url: str,
    headers: dict,
    *,
    started_at: datetime,
    finished_at: datetime,
    snapshot_taken: bool,
    snapshot_at: datetime | None,
    last_snapshot_at: datetime | None,
    snapshot_reason: str,
    root_department_ids: list[str],
    department_count: int,
    member_count: int,
) -> dict:
    rows = rest_insert(
        base_url,
        headers,
        "feishu_sync_runs",
        [
            {
                "started_at": to_iso(started_at),
                "finished_at": to_iso(finished_at),
                "snapshot_taken": snapshot_taken,
                "snapshot_at": to_iso(snapshot_at) if snapshot_at else None,
                "last_snapshot_at": to_iso(last_snapshot_at) if last_snapshot_at else None,
                "snapshot_reason": snapshot_reason,
                "root_department_ids": root_department_ids,
                "department_count": department_count,
                "member_count": member_count,
            }
        ],
    )
    if not rows:
        raise RuntimeError("创建 feishu_sync_runs 记录失败")
    return rows[0]


def build_department_snapshot_rows(sync_run_id: str, snapshot_at: datetime, departments: list[dict], member_counts: dict[str, int]) -> list[dict]:
    rows: list[dict] = []
    snapshot_at_value = to_iso(snapshot_at)
    for dept in departments:
        dept_id = dept.get("department_id", "") or ""
        if not dept_id:
            continue

        order_raw = dept.get("order", 0)
        try:
            order_value = int(order_raw)
        except (TypeError, ValueError):
            order_value = 0

        parent_id = _extract_parent_department_id(dept)
        rows.append(
            {
                "sync_run_id": sync_run_id,
                "snapshot_at": snapshot_at_value,
                "department_id": dept_id,
                "name": dept.get("name", ""),
                "parent_id": parent_id if parent_id and parent_id != "0" else None,
                "order_value": order_value,
                "member_count": member_counts.get(dept_id, 0),
                "leader_user_id": dept.get("leader_user_id"),
                "status": dept.get("status", {}),
            }
        )
    return rows


def build_member_snapshot_rows(sync_run_id: str, snapshot_at: datetime, members: list[dict]) -> list[dict]:
    rows: list[dict] = []
    snapshot_at_value = to_iso(snapshot_at)
    seen_open_ids: set[str] = set()
    for member in members:
        open_id = member.get("open_id", "")
        if not open_id or open_id in seen_open_ids:
            continue
        seen_open_ids.add(open_id)

        dept_ids = normalize_department_ids(member.get("department_ids"))
        rows.append(
            {
                "sync_run_id": sync_run_id,
                "snapshot_at": snapshot_at_value,
                "open_id": open_id,
                "user_id": member.get("user_id"),
                "name": member.get("name", ""),
                "employee_no": member.get("employee_no"),
                "email": member.get("email"),
                "primary_department_id": dept_ids[0] if dept_ids else None,
                "department_ids": dept_ids,
                "job_title": member.get("job_title"),
                "gender": member.get("gender", 0),
                "employee_type": member.get("employee_type"),
                "status": member.get("status", {}),
                "join_time": member.get("join_time"),
            }
        )
    return rows


def insert_snapshot_rows(base_url: str, headers: dict, table: str, rows: list[dict]):
    if not rows:
        print(f"  [SKIP] {table}: no rows")
        return

    for batch in chunked(rows, SNAPSHOT_BATCH_SIZE):
        inserted = rest_insert(base_url, headers, table, batch)
        print(f"  [OK] {table} insert {len(inserted) or len(batch)}")


def sync(root_dept_id: str = "0"):
    started_at = utc_now()
    load_dotenv("app/.env")

    app_id = os.getenv("FEISHU_APP_ID") or os.getenv("VITE_FEISHU_APP_ID")
    app_secret = os.getenv("FEISHU_APP_SECRET")
    supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    supabase_key = (
        os.getenv("VITE_SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
    )

    if not app_id or not app_secret:
        print("错误: 缺少 FEISHU_APP_ID / FEISHU_APP_SECRET")
        print("请在 app/.env 中添加：")
        print("  FEISHU_APP_ID=cli_xxxx")
        print("  FEISHU_APP_SECRET=xxxx")
        return
    if not supabase_url or not supabase_key:
        print("错误: 缺少 Supabase 配置（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）")
        return

    sb_headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }
    sb_base = f"{supabase_url}/rest/v1"

    token = get_tenant_token(app_id, app_secret)

    root_ids = [root_dept_id]
    if root_dept_id == "0":
        discovered = discover_root_departments(token)
        if discovered:
            root_ids = discovered
            print(f"  auto-discovered root dept IDs: {root_ids}")
        else:
            print("  no scoped depts found, using 0")

    departments: list[dict] = []
    for root_id in root_ids:
        print(f"\n-- fetch dept tree (root: {root_id}) --")
        departments.extend(fetch_departments(token, root_id))
    print(f"\ntotal departments: {len(departments)}\n")

    print("── 拉取成员 ──")
    all_members: list[dict] = []
    dept_ids_to_crawl = [dept.get("department_id", "") for dept in departments if dept.get("department_id")]
    if root_dept_id != "0" and root_dept_id not in dept_ids_to_crawl:
        dept_ids_to_crawl.insert(0, root_dept_id)

    for dept_id in dept_ids_to_crawl:
        members = fetch_members(token, dept_id)
        dept_name = next((dept["name"] for dept in departments if dept.get("department_id") == dept_id), dept_id)
        print(f"  {dept_name}: {len(members)} 人")
        all_members.extend(members)

    unique_map: dict[str, dict] = {}
    for member in all_members:
        open_id = member.get("open_id", "")
        if open_id:
            unique_map[open_id] = member
    unique_members = list(unique_map.values())
    print(f"共获取 {len(unique_members)} 个唯一成员\n")

    dept_member_counts: dict[str, int] = {}
    for member in unique_members:
        for dept_id in normalize_department_ids(member.get("department_ids")):
            dept_member_counts[dept_id] = dept_member_counts.get(dept_id, 0) + 1

    print("── 写入当前态 Supabase ──")
    upsert_departments(sb_base, sb_headers, departments, dept_member_counts)
    upsert_members(sb_base, sb_headers, unique_members)
    upsert_profiles(sb_base, sb_headers, unique_members)

    current_time = utc_now()
    latest_snapshot_run = get_latest_snapshot_run(sb_base, sb_headers)
    last_snapshot_at = parse_iso_datetime(latest_snapshot_run.get("snapshot_at")) if latest_snapshot_run else None
    take_snapshot, snapshot_reason = should_take_snapshot(last_snapshot_at, current_time)

    sync_run = insert_sync_run(
        sb_base,
        sb_headers,
        started_at=started_at,
        finished_at=current_time,
        snapshot_taken=take_snapshot,
        snapshot_at=current_time if take_snapshot else None,
        last_snapshot_at=last_snapshot_at,
        snapshot_reason=snapshot_reason,
        root_department_ids=root_ids,
        department_count=len(departments),
        member_count=len(unique_members),
    )

    if take_snapshot:
        print(f"── 写入历史快照 ── ({snapshot_reason})")
        department_snapshot_rows = build_department_snapshot_rows(
            sync_run["id"],
            current_time,
            departments,
            dept_member_counts,
        )
        member_snapshot_rows = build_member_snapshot_rows(sync_run["id"], current_time, unique_members)
        insert_snapshot_rows(sb_base, sb_headers, "feishu_department_snapshots", department_snapshot_rows)
        insert_snapshot_rows(sb_base, sb_headers, "feishu_member_snapshots", member_snapshot_rows)
    else:
        print(f"── 跳过历史快照 ── ({snapshot_reason})")

    print(f"\n完成! 部门 {len(departments)} 个, 成员 {len(unique_members)} 人")


if __name__ == "__main__":
    import sys

    root = "0"
    if "--root-dept-id" in sys.argv:
        index = sys.argv.index("--root-dept-id")
        if index + 1 < len(sys.argv):
            root = sys.argv[index + 1]
    sync(root)
