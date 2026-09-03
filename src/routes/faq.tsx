import { A } from '@solidjs/router'
import Ad from '../components/ad'

export default function FAQ() {
  return (
    <div class="flex flex-col gap-4 p-8">
      <h1 class="-mt-2 pb-2 text-4xl font-bold">FAQ</h1>
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" name="faq" />
        <div class="collapse-title text-xl font-medium">What is Mocha?</div>
        <div class="collapse-content">
          <p>Mocha is a web proxy used to unblock websites at work or school. Your traffic is encrypted so no one can read it, not even us. </p>
        </div>
      </div>

      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" name="faq" />
        <div class="collapse-title text-xl font-medium">How do I use it?</div>
        <div class="collapse-content">
          <p>
            Navigate to the home page and type in a URL or search query. You can also launch a preset{' '}
            <A href="/shortcuts" class="underline underline-offset-2">
              shortcut
            </A>{' '}
            or{' '}
            <A href="/game" class="underline underline-offset-2">
              game
            </A>
            .
          </p>
        </div>
      </div>

      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" name="faq" />
        <div class="collapse-title text-xl font-medium">A game doesn't work. What now?</div>
        <div class="collapse-content">
          <p>
            Games are hosted somewhere else and break without telling anybody, so the flag in the bottom left corner while you are playing one is how to say so. Everything anybody has reported is on the{' '}
            <A href="/reports" class="underline underline-offset-2">
              reports page
            </A>
            , along with the games somebody flagged that everybody else is playing fine. One report never takes a game down on its own - if one works for you, say that instead, and it counts.
          </p>
        </div>
      </div>

      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" name="faq" />
        <div class="collapse-title text-xl font-medium">A game ignores my keyboard</div>
        <div class="collapse-content">
          <p>
            A game only hears the keyboard while it holds focus, and some of them never take it. Mocha hands it over when the game loads and again whenever you click, and copies any key that still lands on the page around it into the game, so this should fix itself. If a game is still deaf, report it with the
            flag on the control bar and say so in the box - that is the kind of thing nobody else can see from the outside.
          </p>
        </div>
      </div>

      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" name="faq" />
        <div class="collapse-title text-xl font-medium">Why is the proxy slow?</div>
        <div class="collapse-content">
          <p>The proxy is hosted on a shared server that serves all users. If there is a significant amount of users at one time, it can cause network congestion and slow down requests. </p>
        </div>
      </div>
      <Ad placement="faq" />
    </div>
  )
}
