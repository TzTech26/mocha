import { A } from '@solidjs/router'

// The server answers an address it does not have with a 404, so this is what
// that page looks like. Without it the router renders nothing and a wrong link
// is a blank screen, which reads as the site being broken.
export default function NotFound() {
  return (
    <div class="mx-auto flex max-w-2xl flex-col items-start gap-4 px-6 py-10">
      <h1 class="text-4xl font-bold">Page not found</h1>
      <p class="text-base-content/70">That address is not here. The proxy, the games and the shortcuts are.</p>
      <div class="flex flex-wrap gap-2">
        <A href="/" class="btn btn-primary">
          Home
        </A>
        <A href="/games" class="btn">
          Games
        </A>
        <A href="/shortcuts" class="btn">
          Shortcuts
        </A>
        <A href="/faq" class="btn btn-ghost">
          FAQ
        </A>
      </div>
    </div>
  )
}
