/** Update `/?…` query without Next.js navigation (avoids Suspense remount flashes). */
export function replaceQueryParams(mutate: (params: URLSearchParams) => void): void {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  mutate(params)
  const qs = params.toString()
  const nextSearch = qs ? `?${qs}` : ''
  if (window.location.search === nextSearch) return

  window.history.replaceState({}, '', qs ? `/?${qs}` : '/')
}

export function readQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}
