// Skill Asset Registry
// Skills register their asset files here; the read_file tool reads from this registry.

/** Global map: virtual path → file content */
const assetStore: Record<string, string> = {}

/**
 * Register assets for a skill.
 * @param skillId  Skill identifier (used as namespace)
 * @param assets   Map of filename → raw content
 */
export function registerAssets(skillId: string, assets: Record<string, string>) {
  for (const [filename, content] of Object.entries(assets)) {
    // Virtual path: /assets/<skillId>/<filename>
    assetStore[`/assets/${skillId}/${filename}`] = content
    // Also register legacy /templates/<filename> path for backward compat
    assetStore[`/templates/${filename}`] = content
  }
}

/**
 * Read an asset by virtual path.
 * Returns undefined if not found.
 */
export function readAsset(path: string): string | undefined {
  return assetStore[path]
}

/**
 * List all registered asset paths.
 */
export function listAssets(): string[] {
  return Object.keys(assetStore)
}
