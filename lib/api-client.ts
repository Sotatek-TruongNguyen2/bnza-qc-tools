import { formatRpcError } from '@/lib/rpc'

export async function apiGetJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    throw new Error(formatRpcError(err))
  }

  let data: { error?: string } & T
  try {
    data = (await res.json()) as { error?: string } & T
  } catch {
    throw new Error(
      res.ok
        ? 'Invalid JSON from API'
        : `API error ${res.status}. Is the server running on this page’s origin?`,
    )
  }

  if (!res.ok) {
    throw new Error(formatRpcError(new Error(data.error ?? `Request failed (${res.status})`)))
  }

  return data
}
