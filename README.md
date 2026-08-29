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
| `EGRESS_SCOPE` | `stream` | How long a pick lasts. `stream` picks again for every request. `connection` keeps one proxy for a whole browsing session, which some sites need - read the warning below before turning it on. |
| `EGRESS_TIMEOUT` | `10000` | Milliseconds to wait for a proxy to open a tunnel. |
| `EGRESS_ATTEMPTS` | `2` | How many proxies to try before giving up on a connection. |
| `EGRESS_FAILURE_LIMIT` | `3` | Failures before a proxy is taken out of the rotation. Only failures the proxy is answerable for count. |
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

### Surviving a bad proxy

Rented proxies fail, and a pool is mostly a way of not caring when one does. A
connection that cannot be opened is retried through a different proxy up to
`EGRESS_ATTEMPTS` times. A proxy that keeps failing is benched for
`EGRESS_BENCH_SECONDS` and stops being handed out.

Only failures the proxy is answerable for count towards that: not being
reachable, never answering, or dropping a tunnel it had already opened. A proxy
refusing `CONNECT` to one host is usually the host's doing rather than the
proxy's, and benching on those would empty the pool the first time a popular
site turned unfriendly.

### One address per session (`EGRESS_SCOPE=connection`)

By default a proxy is picked per request. Some sites do not like that, because
they tie a session to the address that started it: YouTube signs its video URLs
with it, and Google and Cloudflare pin their challenge pages the same way. A
page whose subresources each arrive from a different address can load part way
and then stall.

`EGRESS_SCOPE=connection` leases one proxy for the life of a wisp connection
instead, so a whole browsing session shares one address.

**It is off by default because it fails hard.** Per request, a bad proxy takes a
share of the requests with it and the page mostly still works. Pinned, a session
that lands on a bad proxy loses *everything* until the proxy is benched, and the
requests already in flight cannot be rescued - a page load that fires thirty
subresources at once has picked its proxy before the first failure is known.
Benching moves later requests onto a healthy proxy, but only for failures that
can be detected: a proxy that closes tunnels cleanly and early looks exactly
like a destination that did, and will not be caught.

Turn it on if you need it for a specific site, and watch the logs for benching
warnings afterwards.

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
