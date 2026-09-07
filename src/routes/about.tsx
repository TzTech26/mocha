import { A } from '@solidjs/router'
import Ad from '../components/ad'

export default function About() {
  return (
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 class="text-4xl font-bold">About Mocha</h1>
        <p class="pt-2 text-sm text-base-content/60">What Mocha is, and how the parts of it actually work</p>
      </div>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">What it is</h2>
        <p>
          Mocha is a web proxy: type a URL or a search into the box on the home page, and the page you asked for is fetched by our server and handed back to you, so a network that only sees a connection to Mocha never sees which sites you actually visited. It is built and maintained as a small, independent
          project rather than a company product, and it is free to use.
        </p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">How a page actually gets to you</h2>
        <p>
          The connection between your browser and Mocha is end-to-end encrypted using Epoxy and Libcurl, so nothing sitting on the network between the two - a router, an access point, a school's filtering box - can read what is inside it, only that a connection to Mocha exists. The server then fetches the
          destination page and streams it back through that same encrypted channel.
        </p>
        <p>
          Where that outbound fetch actually leaves from is a separate question from encryption, and one most proxies do not answer honestly: by default it leaves from the server itself, so a site you visit can read the server's own address off it the same way it would read anyone else's. Mocha can be
          configured to route that outbound leg through a pool of proxies instead, picked round-robin per connection, so the server's own network address is never the one a destination site sees.
        </p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">What the ad and tracker blocking does</h2>
        <p>
          A typical page, and especially a typical browser game, calls out to a dozen advertising, analytics and telemetry hosts before it ever shows you anything. Those calls are refused before a proxy connection is even opened for them, so they cost the server nothing rather than a dial and a response each
          - which is also, incidentally, why a game whose own ad slot fails to load still runs fine through Mocha.
        </p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">How a broken game gets flagged</h2>
        <p>
          There are a few hundred games on the{' '}
          <A href="/games" class="link">
            games page
          </A>
          , hosted as folders on somebody else's CDN, and they break without telling anybody - Mocha fetching a game's page successfully says the file exists, not that the game runs or keeps its keyboard. So the{' '}
          <A href="/reports" class="link">
            reports page
          </A>{' '}
          is built entirely out of the people playing: a flag on the control bar next to the home button, and how long people actually stay in a game once they open it. A game only counts as reported because somebody said so, one report never takes a game down on its own, and anyone who opens the same game
          and finds it working can say that instead - once enough people have, the report is answered rather than deleted, so what was typed stays visible in case the game breaks again later.
        </p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Why some games ignore the keyboard</h2>
        <p>
          Games run inside an iframe, and an iframe only hears the keyboard while it holds focus. Mocha hands focus to the game's frame when it loads, whenever you click anywhere that is not Mocha's own control bar, and again when you return to the tab, and copies through any key that still lands on the page
          around it. That is usually enough - a game that still seems deaf to the keyboard is worth reporting, since that is the kind of thing nobody running the site can see from outside.
        </p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">What the numbers on the status page mean</h2>
        <p>
          Nobody signs in to Mocha, so people are counted the only way a proxy honestly can: a browser makes up a random id, keeps it in local storage, and pings roughly every 30 seconds saying what kind of page it is on. No IP address is stored, and nothing about which sites are proxied is recorded - opening
          a game only records the game's id, which is where the most-played row on the home page comes from. See the{' '}
          <A href="/status" class="link">
            status page
          </A>{' '}
          for the current counts, and the{' '}
          <A href="/privacy" class="link">
            privacy policy
          </A>{' '}
          for the full account of what is and is not collected.
        </p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Supporting it</h2>
        <p>
          Mocha is free and ad-supported. If it's useful to you, the project also takes donations at{' '}
          <a class="link" href="https://buymeacoffee.com/proudparrot2" rel="noreferrer" target="_blank">
            Buy Me a Coffee
          </a>
          , which goes toward server costs and domains rather than ads.
        </p>
      </section>

      <Ad placement="about" />
    </div>
  )
}
