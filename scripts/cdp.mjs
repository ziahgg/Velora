// Minimal headless-Chrome driver over the DevTools protocol (Node 22+ has WebSocket built in).
// Used by scripts/e2e-web.mjs. Set CHROME to your Chrome/Chromium binary if it isn't the macOS default.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch(port = 9333) {
  const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank',
  ], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200)
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page') } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  })
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id
    pending.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)))
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  await send('Page.enable')
  const page = {
    send,
    async size(width, height, deviceScaleFactor = 1) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false })
    },
    async goto(url, wait = 4000) { await send('Page.navigate', { url }); await sleep(wait) },
    async eval(expression) {
      const body = expression.trim().split('\n')
      const last = body.pop()
      const wrapped = `(async () => { ${body.join('\n')}\n return (${last.replace(/;$/, '')}); })()`
      const r = await send('Runtime.evaluate', { expression: wrapped, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    },
    async shot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(file, Buffer.from(r.data, 'base64'))
    },
    close() { ws.close(); proc.kill() },
  }
  return page
}
export { sleep }
