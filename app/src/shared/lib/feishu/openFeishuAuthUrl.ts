export async function openFeishuAuthUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return false

  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(trimmed)
    return true
  } catch {
    try {
      await navigator.clipboard.writeText(trimmed)
    } catch {
      // The visible URL remains available in the UI when clipboard access fails.
    }
    return false
  }
}
