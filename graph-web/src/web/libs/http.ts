import type { IncomingMessage, ServerResponse } from 'node:http'

const MAX_BODY = 64 * 1024

export function send(res: ServerResponse, status: number, type: string, value: unknown): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(typeof value === 'string' ? value : JSON.stringify(value))
}

export async function readJson<T>(req: IncomingMessage, limit = MAX_BODY): Promise<T> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buf.length
    if (length > limit) throw new Error('request body too large')
    chunks.push(buf)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (raw.length === 0) throw new Error('empty request body')
  return JSON.parse(raw) as T
}
