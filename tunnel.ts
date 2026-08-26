import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
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

function buildConfig(tunnels: Tunnel[]): string {
  const region = process.env.NGROK_REGION?.trim()
  const lines = ['version: "2"']

  if (region) lines.push(`region: ${region}`)
  lines.push('tunnels:')

  for (const tunnel of tunnels) {
    lines.push(`  ${tunnel.name}:`)
    lines.push('    proto: http')
    lines.push(`    addr: "${tunnel.addr}"`)
    if (tunnel.domain) lines.push(`    domain: ${tunnel.domain}`)
  }

  return `${lines.join('\n')}\n`
}

loadEnvFile(path.resolve('.env'))

const authtoken = process.env.NGROK_AUTHTOKEN?.trim()

if (!authtoken) {
  consola.error('NGROK_AUTHTOKEN is not set. Copy .env.example to .env and paste the token from https://dashboard.ngrok.com/get-started/your-authtoken')
  process.exit(1)
}

const tunnels = collectTunnels()

if (!tunnels.length) {
  consola.error(`No tunnels configured. Set at least NGROK_PORT_1 (and optionally NGROK_DOMAIN_1) in .env, up to ${MAX_TUNNELS} tunnels.`)
  process.exit(1)
}

if (tunnels.length > 1) {
  consola.warn('Running more than one simultaneous tunnel requires a paid ngrok plan')
}

// The authtoken is handed to the agent through the environment instead of the
// config file so the secret never touches disk.
const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mocha-ngrok-'))
const configPath = path.join(configDir, 'ngrok.yml')

fs.writeFileSync(configPath, buildConfig(tunnels), { mode: 0o600 })

const cleanup = () => {
  try {
    fs.rmSync(configDir, { recursive: true, force: true })
  } catch {}
}

for (const tunnel of tunnels) {
  consola.start(`${tunnel.name}: ${tunnel.domain ?? 'ngrok assigned url'} -> ${tunnel.addr}`)
}

const ngrok = spawn('ngrok', ['start', '--all', '--config', configPath, '--log', 'stdout', '--log-format', 'json'], {
  env: { ...process.env, NGROK_AUTHTOKEN: authtoken },
  stdio: ['ignore', 'pipe', 'pipe']
})

ngrok.on('error', (error: NodeJS.ErrnoException) => {
  cleanup()

  if (error.code === 'ENOENT') {
    consola.error('The ngrok agent was not found on your PATH. Install it from https://ngrok.com/download and try again.')
    process.exit(1)
  }

  consola.error(error)
  process.exit(1)
})

if (ngrok.stdout) {
  readline.createInterface({ input: ngrok.stdout }).on('line', (line) => {
    let entry: Record<string, string>

    try {
      entry = JSON.parse(line)
    } catch {
      consola.log(line)
      return
    }

    if (entry.msg === 'started tunnel') {
      consola.success(`${entry.name?.replace(/ \(http\)$/, '') ?? 'tunnel'}: ${entry.url}`)
      return
    }

    if (entry.lvl === 'eror' || entry.lvl === 'crit') {
      consola.error(entry.err ?? entry.msg)
      return
    }

    if (entry.lvl === 'warn') consola.warn(entry.msg)
    if (entry.msg === 'client session established') consola.info('Inspect requests on http://127.0.0.1:4040')
  })
}

if (ngrok.stderr) {
  readline.createInterface({ input: ngrok.stderr }).on('line', (line) => consola.error(line))
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    consola.info('Shutting down tunnels')
    ngrok.kill('SIGTERM')
  })
}

ngrok.on('close', (code) => {
  cleanup()
  process.exit(code ?? 0)
})
