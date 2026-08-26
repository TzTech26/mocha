import { type ChildProcess, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { consola } from 'consola'

const MAX_TUNNELS = 3

type Tunnel = {
  name: string
  addr: string
  domain?: string
}

// Minimal .env reader so this script stays dependency free. Real environment
// variables always win over anything defined in the file.
function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed
      .slice(0, separator)
      .trim()
      .replace(/^export\s+/, '')
    let value = trimmed.slice(separator + 1).trim()

    if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1)
    }

    if (key && !(key in process.env)) process.env[key] = value
  }
}

// A bare port is the common case, but host:port and full URLs are valid ngrok
// upstreams too, so anything that isn't a plain number is passed straight through.
function parseAddr(raw: string, variable: string): string {
  if (!/^\d+$/.test(raw)) return raw

  const port = Number(raw)
  if (port < 1 || port > 65535) {
    consola.error(`${variable} must be a port between 1 and 65535, got ${raw}`)
    process.exit(1)
  }

  return raw
}

function collectTunnels(): Tunnel[] {
  const tunnels: Tunnel[] = []

  for (let index = 1; index <= MAX_TUNNELS; index++) {
    const domain = process.env[`NGROK_DOMAIN_${index}`]?.trim()
    const addr = process.env[`NGROK_PORT_${index}`]?.trim()

    if (!addr) {
      if (domain) consola.warn(`NGROK_DOMAIN_${index} is set but NGROK_PORT_${index} is missing, skipping tunnel ${index}`)
      continue
    }

    tunnels.push({
      name: `mocha-${index}`,
      addr: parseAddr(addr, `NGROK_PORT_${index}`),
      domain: domain ? domain.replace(/^https?:\/\//, '').replace(/\/+$/, '') : undefined
    })
  }

  return tunnels
}

loadEnvFile(path.resolve('.env'))

const authtoken = process.env.NGROK_AUTHTOKEN?.trim()
const tunnels = collectTunnels()

if (!tunnels.length) {
  consola.error(`No tunnels configured. Set at least NGROK_PORT_1 (and optionally NGROK_DOMAIN_1) in .env, up to ${MAX_TUNNELS} tunnels.`)
  process.exit(1)
}

if (!authtoken) {
  consola.info('NGROK_AUTHTOKEN is not set, falling back to the token saved by `ngrok config add-authtoken`')
}

// Each tunnel gets its own agent, driven entirely by command line flags. The
// agent config file is left alone so there is no config schema to keep in sync,
// and a token in the environment still overrides whatever the agent has saved.
if (tunnels.length > 1) {
  consola.warn('Running more than one simultaneous tunnel requires a paid ngrok plan, since every tunnel opens its own agent session')
}

const label = (tunnel: Tunnel) => (tunnels.length > 1 ? `${tunnel.name}: ` : '')

const processes: ChildProcess[] = []
let shuttingDown = false
let reportedMissingAgent = false

const shutdown = (signal: NodeJS.Signals = 'SIGTERM') => {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of processes) child.kill(signal)
}

function start(tunnel: Tunnel) {
  const args = ['http', tunnel.addr, '--log=stdout', '--log-format=json']
  if (tunnel.domain) args.push(`--domain=${tunnel.domain}`)

  const child = spawn('ngrok', args, {
    env: authtoken ? { ...process.env, NGROK_AUTHTOKEN: authtoken } : process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  child.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      if (!reportedMissingAgent) {
        reportedMissingAgent = true
        consola.error('The ngrok agent was not found on your PATH. Install it from https://ngrok.com/download and try again.')
      }
    } else {
      consola.error(error)
    }

    shutdown()
    process.exitCode = 1
  })

  if (child.stdout) {
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      let entry: Record<string, string>

      try {
        entry = JSON.parse(line)
      } catch {
        consola.log(`${label(tunnel)}${line}`)
        return
      }

      if (entry.msg === 'started tunnel') {
        consola.success(`${label(tunnel)}${entry.url} -> ${tunnel.addr}`)
        return
      }

      if (entry.lvl === 'eror' || entry.lvl === 'crit') {
        consola.error(`${label(tunnel)}${entry.err ?? entry.msg}`)
        return
      }

      if (entry.lvl === 'warn') consola.warn(`${label(tunnel)}${entry.msg}`)
    })
  }

  if (child.stderr) {
    readline.createInterface({ input: child.stderr }).on('line', (line) => consola.error(`${label(tunnel)}${line}`))
  }

  child.on('close', (code) => {
    // One dead agent leaves the setup half up, so take the rest down with it.
    if (!shuttingDown) {
      if (code) consola.error(`${label(tunnel)}ngrok exited with code ${code}`)
      shutdown()
    }

    // A failed spawn closes with a negative errno, which would wrap around
    // into a nonsense exit code.
    if (code) process.exitCode = code > 0 ? code : 1
  })

  processes.push(child)
}

for (const tunnel of tunnels) {
  consola.start(`${tunnel.name}: ${tunnel.domain ?? 'ngrok assigned url'} -> ${tunnel.addr}`)
  start(tunnel)
}

consola.info('Inspect requests on http://127.0.0.1:4040')

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    consola.info('Shutting down tunnels')
    shutdown()
  })
}
