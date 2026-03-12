/* eslint-disable no-sync */

import http from 'http'

/** Fixed port used for the mock update server during e2e tests. */
export const MOCK_UPDATE_PORT = 51789
export const MOCK_UPDATE_URL = `http://127.0.0.1:${MOCK_UPDATE_PORT}/update`

type UpdateBehavior = 'no-update'

export interface IMockUpdateServer {
  readonly server: http.Server
  readonly url: string

  /** All requests received by the mock server. */
  readonly requests: ReadonlyArray<{ method: string; url: string }>

  /** Change how the server responds to update checks. */
  setBehavior(behavior: UpdateBehavior): void

  close(): Promise<void>
}

/**
 * Create a mock update server that mimics the responses from
 * central.github.com for Squirrel (macOS) and Squirrel.Windows.
 *
 * By default, it responds with "no update available" (HTTP 204).
 */
export function createMockUpdateServer(): Promise<IMockUpdateServer> {
  return new Promise((resolve, reject) => {
    let behavior: UpdateBehavior = 'no-update'
    const requests: Array<{ method: string; url: string }> = []

    const server = http.createServer((req, res) => {
      requests.push({ method: req.method ?? 'GET', url: req.url ?? '/' })

      if (behavior === 'no-update') {
        // Squirrel.Mac interprets 204 as "no update available".
        // Squirrel.Windows interprets an empty RELEASES file similarly.
        if (req.method === 'HEAD') {
          // Priority update status check — no priority update.
          res.writeHead(200, {
            'x-prioritize-update': 'false',
          })
          res.end()
        } else {
          res.writeHead(204)
          res.end()
        }
        return
      }

      res.writeHead(204)
      res.end()
    })

    server.on('error', reject)
    server.listen(MOCK_UPDATE_PORT, '127.0.0.1', () => {
      resolve({
        server,
        url: MOCK_UPDATE_URL,
        requests,
        setBehavior(b: UpdateBehavior) {
          behavior = b
        },
        close() {
          return new Promise<void>((res, rej) =>
            server.close(err => (err ? rej(err) : res()))
          )
        },
      })
    })
  })
}
