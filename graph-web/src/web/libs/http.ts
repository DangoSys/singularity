import type { ServerResponse } from 'node:http'

export function send(res: ServerResponse, status: number, type: string, value: unknown): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(typeof value === 'string' ? value : JSON.stringify(value))
}
