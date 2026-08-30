import { BareMuxConnection } from '@mercuryworkshop/bare-mux'
import store from 'store2'
import { setProxyStatus } from '../routes/route'
import { transports } from './transport'
import type { TransportData } from './types'

export const wispUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/wisp/`

// Nothing under /~/ exists on the server: those requests only become pages
// because the service worker answers them. So the page is not ready to open one
// until a worker is actually controlling it, and a worker being registered, or
// even active, is not the same thing - a worker only controls the pages it has
// claimed. Waiting on the wrong signal is what made the viewer load on the
// second visit but not the first.
const controlWait = 10000

function controlled() {
  if (navigator.serviceWorker.controller) return Promise.resolve(true)

  return new Promise<boolean>((resolve) => {
    const done = (value: boolean) => {
      clearTimeout(timer)
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      resolve(value)
    }

    const onChange = () => done(true)
    // Giving up beats hanging: without a controller the viewer gets the
    // server's "the proxy did not answer" page, which at least says so.
    const timer = setTimeout(() => done(false), controlWait)

    navigator.serviceWorker.addEventListener('controllerchange', onChange)
  })
}

export async function setupProxy() {
  if (!('serviceWorker' in navigator)) return

  // Registering the same script again updates it in place, and install's
  // skipWaiting plus activate's claim put the new worker in charge without a
  // reload. Unregistering first, as this used to, throws away the worker that
  // is currently intercepting for this page and leaves a gap with no
  // controller at all - every /~/ request made during that gap misses the
  // worker and reaches the server, which is exactly what a back navigation
  // into the viewer does.
  const registration = await navigator.serviceWorker.register('/sw.js')
  await registration.update().catch(() => {})

  if (!(await controlled())) {
    console.error('No service worker is controlling this page, so proxied requests will not be intercepted')
  }

  const transportData = store('transport') as TransportData
  console.log('Using', transports[transportData.transport])

  const connection = new BareMuxConnection('/bare-mux/worker.js')
  await connection.setTransport(transports[transportData.transport], [{ wisp: wispUrl }])

  setProxyStatus(true)
}
