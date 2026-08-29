import Ad from '../components/ad'

export default function Terms() {
  return (
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 class="text-4xl font-bold">Terms of Service</h1>
        <p class="pt-2 text-sm text-base-content/60">Last updated August 29, 2026</p>
      </div>

      <p>By using Mocha you agree to these terms. If you do not agree with them, do not use the service.</p>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">The service</h2>
        <p>Mocha is a free web proxy. It fetches pages on your behalf and displays them back to you. It is provided as is, with no warranty of any kind, and we do not promise that it will be available, complete, secure, or free of errors at any given moment.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Acceptable use</h2>
        <p>You are responsible for everything you do through Mocha. You agree not to use it to:</p>
        <ul class="list-disc pl-6">
          <li>break any law that applies to you</li>
          <li>access, store, or distribute material that is illegal where you are</li>
          <li>harass, threaten, defraud, or impersonate anyone</li>
          <li>attack, overload, or attempt to gain unauthorized access to any system, including ours</li>
          <li>run automated traffic, scrapers, or bulk downloads through the proxy</li>
          <li>bypass a restriction you are contractually or legally required to respect</li>
        </ul>
        <p>We may block traffic or restrict access at any time, for any reason, without notice.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Third party content</h2>
        <p>Sites, games, and shortcuts reached through Mocha are not ours. We do not host, control, endorse, or vet them, and we are not responsible for what they contain or do. Their own terms and policies apply to you when you use them.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Advertising</h2>
        <p>Mocha is supported by ads served through Google AdSense. Interfering with how those ads are served, including clicking them artificially or blocking them programmatically for others, is not permitted.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Liability</h2>
        <p>To the fullest extent the law allows, we are not liable for any loss or damage arising out of your use of Mocha, including lost data, lost accounts, or anything that happens on a site you reached through it. You use the service at your own risk.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-2xl font-semibold">Changes</h2>
        <p>These terms may change. Continuing to use Mocha after a change means you accept the updated terms.</p>
      </section>

      <Ad placement="legal" />
    </div>
  )
}
