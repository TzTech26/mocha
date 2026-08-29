<div align="center">
  <img src="public/icon.png" height=75 width=75 />
  <h1>Mocha</h1>
</div>
The simplicity and power you expect from a web proxy.

## Features

- [x] Sleek and simple UI
- [x] Browsing data import, export, and deletion 
- [x] Bookmarks
- [x] Proxy control bar
- [x] Tab cloaking
- [x] about:blank
- [x] Site shortcuts and games
- [x] Panic key (works inside the proxy)
- [x] Devtools 
- [x] End-to-end encryption with Epoxy and Libcurl
- [x] Site compatability alerts and suggestions
- [ ] Script injections (Extensions)
- [ ] Rammerhead

## Run locally

You need [NodeJS](https://nodejs.org) and [Git](https://git-scm.com/download) installed on your system.

```sh
# Clone repository and install packages
git clone https://github.com/cafe-labs/mocha.git
npm install

# Build static files and start the server
npm run start
```

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3003` | Port the server listens on. |
| `CDN_TARGET` | `https://gitlab.com/3kh0/3kh0-assets/-/raw/main` | Where `/cdn` fetches game assets from. The original host, `assets.3kh0.net`, stopped resolving, and the assets now live on GitLab. Point this at a mirror or a self-hosted copy if you have one. |
| `CDN_CACHE_DIR` | `.cache/cdn` | Where fetched assets are cached on disk. |
| `CDN_CACHE` | enabled | Set to `0` to fetch from the upstream every time. |
| `EGRESS_PROXIES` | unset | Upstream proxies to route proxied traffic through, comma or newline separated. Unset means connections are made straight from this server. |
| `EGRESS_ROTATION` | `round-robin` | How to pick from the list: `round-robin`, `random`, or `sticky` (always the first). |
| `EGRESS_SCOPE` | `connection` | How long a pick lasts. `connection` keeps one proxy for a whole browsing session, which is what sites that pin a session to an IP need. `stream` picks again for every request. |
| `EGRESS_TIMEOUT` | `10000` | Milliseconds to wait for a proxy to open a tunnel. |
| `EGRESS_ATTEMPTS` | `3` | How many proxies to try before giving up on a connection. |
| `EGRESS_FAILURE_LIMIT` | `3` | Consecutive failures before a proxy is taken out of the rotation. |
| `EGRESS_BENCH_SECONDS` | `120` | How long a proxy stays out once it has been benched. |
| `EGRESS_DNS_SERVERS` | unset | Resolvers for the destination lookup the stream filter performs, e.g. `1.1.1.1,1.0.0.1`. Only used when egress proxies are in use. |
| `WEBSHARE_API_KEY` | unset | Webshare API key. Setting it pulls the proxy pool from their API instead of listing proxies by hand. |
| `WEBSHARE_REFRESH_HOURS` | `24` | How often to pull a fresh list. |
| `WEBSHARE_MODE` | `direct` | The `mode` passed to Webshare's proxy list endpoint. |
| `WEBSHARE_PROTOCOL` | `http` | How to talk to the proxies Webshare returns. Only change this if your plan serves the same endpoints over SOCKS5. |
| `WEBSHARE_TIMEOUT` | `30000` | Milliseconds to wait on the Webshare API. |

## Hiding the server's IP

Every page a visitor opens is fetched by this server, so by default the site
they visit sees this machine's public IP. Anyone can read it off a site like
ipinfo.io from inside the proxy. Putting the site behind Cloudflare or a tunnel
does not change that: those hide the address people connect *to*, not the one
the server goes out from. It matters most when the server runs on a home
connection, where the outbound address is the operator's own.

Set `EGRESS_PROXIES` to send those connections through proxies you control:

```sh
# One proxy
EGRESS_PROXIES="socks5://user:pass@proxy.example.com:1080"

# A pool, used round robin
EGRESS_PROXIES="socks5://user:pass@a.example.com:1080,socks5://user:pass@b.example.com:1080"
```

SOCKS5, SOCKS4, HTTP `CONNECT`, and HTTPS `CONNECT` proxies are supported. An
entry written as a bare `host:port` is treated as SOCKS5. Destination hostnames
are handed to the proxy unresolved, so the lookup happens there rather than
here.

### One address per session

A pool is only useful if a single browsing session stays behind a single
address. Plenty of sites tie a session to the IP that started it: YouTube signs
its video URLs with it, and Google and Cloudflare pin their challenge pages the
same way. If every image, script and video segment left through a different
proxy, those sites would load part way and then stall.

So a proxy is leased for the life of a wisp connection rather than per request,
and the next connection gets the next proxy in the rotation. Set
`EGRESS_SCOPE=stream` to go back to a fresh proxy per request.

Rented proxies also fail often, and refusing `CONNECT` with a 502 is the usual
way. A connection that fails is retried through a different proxy up to
`EGRESS_ATTEMPTS` times, and a proxy that fails `EGRESS_FAILURE_LIMIT` times in
a row is taken out of the rotation for `EGRESS_BENCH_SECONDS` so it stops being
handed out at all.

While a proxy list is set, UDP streams are turned off. UDP cannot travel through
an HTTP `CONNECT` tunnel, and allowing it to fall back to a direct socket would
hand out the real IP anyway.

### Pulling the pool from Webshare

Rather than pasting proxies into `EGRESS_PROXIES`, set `WEBSHARE_API_KEY` and
the pool is fetched from [Webshare's proxy list
API](https://apidocs.webshare.io/proxy-list) when the server starts, then again
every `WEBSHARE_REFRESH_HOURS`.

Each refresh replaces the list outright, so proxies that have been rotated out
of your plan stop being used; proxies Webshare has marked invalid are skipped.
A refresh that fails, whether the API is down, rate limiting, or rejecting the
key, leaves the previous list in place and logs a warning, so an outage at
Webshare does not take the site down with it.

Anything in `EGRESS_PROXIES` stays in the pool alongside the fetched proxies,
which is a convenient way to keep one proxy of your own in the rotation.

Keep the key out of the repository. Pass it as an environment variable in your
host's dashboard, a Docker secret, or a local `.env` file, which is already
gitignored:

```sh
WEBSHARE_API_KEY=your-key-here
```

The key is only ever sent to Webshare as an `Authorization` header, and is kept
out of log output.

One consequence worth knowing: once `WEBSHARE_API_KEY` is set the server treats
egress proxying as required. If the very first fetch fails there are no proxies
to use, and proxied requests are refused rather than being sent out directly,
because falling back would leak the address this is all meant to hide. Put a
proxy in `EGRESS_PROXIES` as well if you would rather always have a fallback.

Two things this does not cover. The stream filter still resolves destination
hostnames locally to check them against the private IP ranges, so set
`EGRESS_DNS_SERVERS` if you would rather that not go through your ISP's
resolver. And `/cdn` fetches game assets directly, which exposes the server's IP
to that one host, though not to anything a visitor chooses.

Raw git hosts serve every text file as `text/plain` and attach their own
content security policy, so the `/cdn` proxy restores the content type from the
file extension and drops those headers on the way through. Without that a game
arrives as source code the browser refuses to run.

Those hosts also rate limit per IP, and every visitor's assets are fetched by
the server rather than the browser, so each asset is cached on disk the first
time it is requested and served locally afterwards. The games page pulls
hundreds of thumbnails in one view, so mount a volume on `CDN_CACHE_DIR` to keep
the cache across deploys instead of refetching all of them on every boot.

## Support us
If you like Mocha and would like to support the development, you can donate to me [here](https://buymeacoffee.com/proudparrot2). It helps with server costs, domains, and otherwise financially supports me.
