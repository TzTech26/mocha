import Ad from '../components/ad'

export default function Privacy() {
  return (
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 class="text-4xl font-bold">Privacy Policy</h1>
        <p class="pt-2 text-sm text-base-content/60">Last updated August 29, 2026</p>
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
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Advertising and cookies</h2>
        <p>Mocha shows ads served by Google AdSense.</p>
        <ul class="list-disc pl-6">
          <li>Google, as a third party vendor, uses cookies to serve ads on this site.</li>
          <li>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this site and other sites on the internet.</li>
          <li>
            You can opt out of personalized advertising by visiting{' '}
            <a class="link" href="https://www.google.com/settings/ads" rel="noreferrer" target="_blank">
              Google Ads Settings
            </a>
            .
          </li>
          <li>
            You can opt out of third party vendor cookies more broadly at{' '}
            <a class="link" href="https://www.aboutads.info/choices/" rel="noreferrer" target="_blank">
              aboutads.info
            </a>
            .
          </li>
          <li>
            More detail on how Google handles data is in{' '}
            <a class="link" href="https://policies.google.com/technologies/partner-sites" rel="noreferrer" target="_blank">
              Google's partner sites policy
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

      <Ad placement="legal" />
    </div>
  )
}
