export default function Privacy() {
  return (
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 class="text-4xl font-bold">Privacy Policy</h1>
        <p class="pt-2 text-sm text-base-content/60">Last updated September 7, 2026</p>
      </div>

      <p>This policy explains what Mocha does and does not collect when you use it.</p>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">What stays on your device</h2>
        <p>Your settings, bookmarks, tab cloak, theme, and proxy browsing data are stored in your own browser, in local storage and IndexedDB. They are never uploaded to us. Clearing your browser data, or using the delete option in settings, removes them permanently.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Proxied traffic</h2>
        <p>
          Pages you open through the proxy pass through our server so they can be fetched and returned to you. We do not keep logs of the URLs you visit, and we do not build a browsing history tied to you. Traffic between your browser and the destination is encrypted, so the contents of what you browse are
          not readable by us.
        </p>
        <p>Our host may keep short lived operational records such as IP addresses and request timing for the purpose of keeping the server running and stopping abuse.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Analytics</h2>
        <p>We use Plausible Analytics to count page views. Plausible does not use cookies and does not collect personal data or track people across sites. It tells us how many people visit, not who they are.</p>
        <p>
          Our own server also keeps a count of how many people are using Mocha. Your browser makes up a random id, keeps it in local storage, and sends it so that two visits from you are not counted as two people. The id is not tied to your name, your account, or anything you browse, and clearing your browser
          data replaces it with a new one.
        </p>
        <p>
          Along with it we record which page of Mocha you have open - the home page, the proxy, a game, or the status page - and, when you open a game, which game it was. That is what the counts on the status page and the most played row on the home page are built from. We do not record the addresses you
          visit through the proxy.
        </p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Advertising and cookies</h2>
        <p>Mocha shows ads served by two advertising networks, Monetag and Adsterra. They appear only as a banner down each side of the screen, and only while a game or a proxied page is open. No other part of the site carries advertising.</p>
        <ul class="list-disc pl-6">
          <li>Both networks, and the advertisers buying through them, are third parties, and they set their own cookies and similar identifiers when an ad is served.</li>
          <li>Those identifiers are used to decide which ads to show you, to limit how often you see the same one, and to measure whether an ad was clicked. They are not set or read by us, and we do not receive them.</li>
          <li>Ads are shown by Mocha itself, in the margins beside the proxy rather than inside it. Nothing is injected into the pages you open through the proxy, and the ad networks are not told which sites those are.</li>
          <li>
            How each network handles this data is described in the{' '}
            <a class="link" href="https://monetag.com/privacy-policy/" rel="noreferrer" target="_blank">
              Monetag privacy policy
            </a>{' '}
            and the{' '}
            <a class="link" href="https://adsterra.com/privacy-policy/" rel="noreferrer" target="_blank">
              Adsterra privacy policy
            </a>
            .
          </li>
          <li>
            You can opt out of interest based advertising from participating vendors at{' '}
            <a class="link" href="https://www.aboutads.info/choices/" rel="noreferrer" target="_blank">
              aboutads.info
            </a>{' '}
            and{' '}
            <a class="link" href="https://www.youronlinechoices.com/" rel="noreferrer" target="_blank">
              youronlinechoices.com
            </a>
            .
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Third party sites</h2>
        <p>Sites you reach through the proxy have their own privacy practices, which we do not control and are not responsible for. Anything you type into them, including logins, goes to them.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Children</h2>
        <p>Mocha is not directed at children under 13, and we do not knowingly collect personal information from them.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Changes</h2>
        <p>This policy may change. The date at the top reflects the most recent revision.</p>
      </section>
    </div>
  )
}
