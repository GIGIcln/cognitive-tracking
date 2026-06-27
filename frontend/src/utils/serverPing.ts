export async function checkServerReachable(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', {
      signal: AbortSignal.timeout(5000),
      credentials: 'omit',
    })
    return res.ok
  } catch {
    return false
  }
}
