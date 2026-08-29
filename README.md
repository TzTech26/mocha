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
| `EGRESS_TIMEOUT` | `20000` | Milliseconds to wait for a proxy to open a tunnel. |
| `EGRESS_DNS_SERVERS` | unset | Resolvers for the destination lookup the stream filter performs, e.g. `1.1.1.1,1.0.0.1`. Only used when `EGRESS_PROXIES` is set. |

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

# A pool, used round robin, one proxy per connection
EGRESS_PROXIES="socks5://user:pass@a.example.com:1080,socks5://user:pass@b.example.com:1080"
```

SOCKS5, SOCKS4, HTTP `CONNECT`, and HTTPS `CONNECT` proxies are supported. An
entry written as a bare `host:port` is treated as SOCKS5. Destination hostnames
are handed to the proxy unresolved, so the lookup happens there rather than
here.

While a proxy list is set, UDP streams are turned off. UDP cannot travel through
an HTTP `CONNECT` tunnel, and allowing it to fall back to a direct socket would
hand out the real IP anyway.

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
