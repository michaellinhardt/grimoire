/**
 * Derives a human-readable display name from a session's folder path.
 * Extracts the last path segment as the project name.
 * Handles both Unix (/) and Windows (\) path separators for cross-platform compatibility.
 * @param folderPath - The full folder path of the session
 * @returns The display name (last path segment or 'Unknown Project')
 */
export function getSessionDisplayName(folderPath: string): string {
  // Handle both Unix (/) and Windows (\) path separators
  const segments = folderPath.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] || 'Unknown Project'
}
