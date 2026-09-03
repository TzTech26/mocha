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
- [x] Game reports, so a broken game is flagged before somebody clicks it
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
| `DIAGNOSTICS_SECONDS` | `60` | Seconds between health lines, which report live connections, streams, memory and open file descriptors against the limits this process has. `0` turns them off. |
| `DIAGNOSTICS_IDLE_SECONDS` | `1800` | How often a health line is printed while the server is idle. A line whose counts have not moved says nothing the last one did not, so an idle server repeats itself this often instead of every `DIAGNOSTICS_SECONDS`. Anything with a live connection or stream is still reported every time. |
| `CDN_TARGET` | `https://gitlab.com/3kh0/3kh0-assets/-/raw/main` | Where `/cdn` fetches game assets from. The original host, `assets.3kh0.net`, stopped resolving, and the assets now live on GitLab. Point this at a mirror or a self-hosted copy if you have one. |
| `STATUS_DATA_FILE` | `.cache/status.json` | Where the counts and the uptime record are kept so a restart does not reset them. This is the only durable state Mocha has - see [What the status page counts](#what-the-status-page-counts). |
| `STATUS_PERSIST` | enabled | Set to `0` to keep everything in memory, so the totals and the uptime record start from zero on every restart. |
| `STATUS_ACTIVE_SECONDS` | `90` | How long since a browser's last ping still counts as being here. Browsers ping every 30 seconds, so this forgives one missed ping. |
| `STATUS_HEARTBEAT_SECONDS` | `30` | How often the server records that it is still alive. A gap longer than twice this is counted as downtime, so it also sets how precisely an outage can be measured. |
| `STATUS_MAX_VISITORS` | `100000` | How many people the totals remember individually. Past this the oldest are forgotten, and one of them returning is counted as new. |
| `STATUS_MAX_ACTIVE` | `50000` | Ceiling on tabs held for the live counts, so a script inventing ids cannot grow them without bound. |
| `STATUS_MAX_GAMES` | `2000` | Ceiling on how many different games are tracked, for the same reason. |
| `STATUS_MAX_GAMES_PER_VISITOR` | `100` | How many games one person's record remembers. Somebody who plays more different games than this starts counting as a new player of the next one. |
| `STATUS_TOP_GAMES` | `8` | How many games the status page's table lists. The home page asks for five regardless. |
| `STATUS_SAVE_SECONDS` | `60` | How long to wait after something changes before writing to disk, so a rush of arrivals is one write. |
| `REPORTS_DATA_FILE` | `.cache/reports.json` | Where game reports and how long people stay in each game are kept - see [How a game gets flagged](#how-a-game-gets-flagged). The other half of the durable state, so it wants the same volume. |
| `REPORTS_PERSIST` | enabled | Set to `0` to keep reports in memory, so they start from nothing on every restart. |
| `REPORTS_SAVE_SECONDS` | `60` | How long to wait after a report before writing to disk. |
| `REPORTS_CONFIRM_FLAGS` | `2` | How many people have to independently report a game before it is called not working rather than reported. |
| `REPORTS_DISPUTE_RATIO` | `2` | How much heavier the evidence has to be than the reports against a game before those reports are treated as answered. |
| `REPORTS_PROVEN_SECONDS` | `300` | A visit this long is a game that demonstrably ran, and counts for the game the way somebody saying it works does. |
| `REPORTS_PROVEN_WEIGHT` | `3` | How many long visits are allowed to stand in for people agreeing. Capped so a game that broke this morning cannot be defended forever by the visits it held before. |
| `REPORTS_BOUNCE_SECONDS` | `60` | A visit shorter than this is somebody leaving rather than playing. |
| `REPORTS_AUTO_SESSIONS` | `8` | How many measured visits a game needs before everybody walking out of it is worth flagging on its own. |
| `REPORTS_AUTO_BOUNCE` | `0.9` | What share of those visits have to be walk-outs for that to happen. |
| `REPORTS_VOTE_DAYS` | `30` | How long a report counts for. Games get fixed without anybody telling us, so they expire rather than pinning a game forever. |
| `REPORTS_SESSION_SECONDS` | `90` | How long since a tab's last ping before its visit is treated as over. Keep it in step with `STATUS_ACTIVE_SECONDS`. |
| `REPORTS_MAX_GAMES` | `2000` | Ceiling on how many games have reports tracked, so made up names cannot grow it without bound. |
| `REPORTS_MAX_VOTERS_PER_GAME` | `500` | Ceiling on how many people's reports one game remembers. |
| `REPORTS_MAX_SESSIONS` | `50000` | Ceiling on visits being measured at once, for the same reason. |
| `REPORTS_MAX_LISTED` | `250` | How many games the reports page is handed. Flagged games come first, so this only ever drops ones nobody has said anything about. |
| `CDN_CACHE_DIR` | `.cache/cdn` | Where fetched assets are cached on disk. |
| `CDN_CACHE` | enabled | Set to `0` to fetch from the upstream every time. |
| `EGRESS_PROXIES` | unset | Upstream proxies to route proxied traffic through, comma or newline separated. Unset means connections are made straight from this server. |
| `EGRESS_ROTATION` | `round-robin` | How to pick from the list: `round-robin`, `random`, or `sticky` (always the first). |
| `EGRESS_TIMEOUT` | `20000` | Milliseconds to wait for a proxy to open a tunnel. Also the budget for the whole stream: a proxy that hangs this long is not followed by a retry. |
| `EGRESS_ATTEMPTS` | `3` | How many proxies one stream may try before giving up. A pool always has some members that cannot reach a given destination, and without this a stream landing on one fails the request outright. |
| `EGRESS_BLOCK_ADS` | enabled | Refuses advertising, analytics and telemetry hosts before a proxy is picked, so they cost no dials and no bandwidth. Set to `0` to send them through the pool like anything else. |
| `EGRESS_BLOCK` | unset | Extra hosts to refuse the same way, comma or space separated. Each entry matches that host and any subdomain of it. |
| `EGRESS_FAILURE_TTL` | `30000` | Milliseconds to leave a destination alone after every proxy has refused to reach it. A page that keeps asking then costs one round of dials per window rather than one per request. |
| `EGRESS_FAILURE_MAX` | `900000` | Ceiling for that wait, which doubles each time the destination fails again. |
| `EGRESS_DNS_SERVERS` | unset | Resolvers for the private-IP check the stream filter performs, e.g. `1.1.1.1,1.0.0.1`. Unset means no local lookup happens at all while proxying, since the proxy does the resolution that decides where the connection goes. |
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

One thing this does not cover: `/cdn` fetches game assets directly, which
exposes the server's IP to that one host, though not to anything a visitor
chooses.

## What the pool is not spent on

A metered pool is spent by whatever the page asks for, and a game page asks for
a great deal that is not the game. The advertising, analytics and telemetry
hosts its SDK reports to are refused before a proxy is picked, so they cost
nothing at all rather than a dial and a response each. The list covers the
exchanges and the cookie-sync hosts that travel with them, which is where the
volume is - one ordinary page can touch a dozen in a second, each one a
redirect carrying an identifier and nothing a reader would miss.
`EGRESS_BLOCK_ADS=0` turns it off, and `EGRESS_BLOCK` adds hosts of your own. To the page it looks
the way an ad blocker does, and a game whose ad call fails still runs.

The other way a pool goes is on destinations that were never reachable. When
every proxy tried refuses a destination - which is what a proxy answers for a
hostname that does not resolve - asking again immediately spends `EGRESS_ATTEMPTS`
more dials on the same answer, and a page that retries every few seconds does
that for as long as it is open. Such a destination is left alone for
`EGRESS_FAILURE_TTL`, doubling up to `EGRESS_FAILURE_MAX` each time it fails
again after a hold runs out, and forgotten as soon as it can be reached. The
first hold is deliberately short: three refusals are good evidence but not
proof, and a working host that drew three bad exits should be out of reach for
seconds rather than minutes.

Failures that arrive while a hold is already running do not lengthen it. A page
opens several streams to the same host at once and they are all in flight
before the first comes back, so counting those as repeats would let one page
load reach the ceiling on its first attempt. Only refusals count either way: a
timeout says nothing about the destination, so it never holds one back.

While proxying, the server does not resolve destination hostnames at all. The
proxy performs the lookup that decides where the connection goes, from a network
this machine never touches, so an answer resolved here would be checked against
the private IP ranges and then thrown away. Worse, on a host whose resolver
filters - a Pi-hole, a filtering upstream, a hosts file - ad and tracker domains
come back as `0.0.0.0`, which reads as a private address, and the stream is
refused for a reason that has nothing to do with where it was actually going.
Set `EGRESS_DNS_SERVERS` to have the check performed anyway, against resolvers
you name.

Raw git hosts serve every text file as `text/plain` and attach their own
content security policy, so the `/cdn` proxy restores the content type from the
file extension and drops those headers on the way through. Without that a game
arrives as source code the browser refuses to run.

Those hosts also rate limit per IP, and every visitor's assets are fetched by
the server rather than the browser, so each asset is cached on disk the first
time it is requested and served locally afterwards. The games page pulls
hundreds of thumbnails in one view, so mount a volume on `CDN_CACHE_DIR` to keep
the cache across deploys instead of refetching all of them on every boot.

## What the status page counts

`/status` is not linked from the navbar - the way in is a dot under the buttons
at the bottom of the settings page. It answers three kinds of question: who is
here now, how much Mocha has been used, and how much of the time it has been up.

Nobody signs in, so people are counted the only way a proxy can. A browser makes
up a random id, keeps it in local storage, and pings every 30 seconds with the
kind of page it is on: an ordinary page, the proxy, a game, or the status page
itself. Someone sitting on the status page watching the numbers is deliberately
left out of them - they are reading, not using it. Pings are per tab and counts
are per person, so three windows are one of us. No IP address is stored and
nothing about which sites are proxied is recorded; opening a game records the
game's id, which is where the most-played row on the home page comes from.

Uptime is measured rather than assumed. The server writes the time beside
`STATUS_DATA_FILE` every `STATUS_HEARTBEAT_SECONDS`, and on the next start the
gap between that timestamp and now is downtime - anything longer than two
heartbeats, so swapping containers on a deploy is not counted as an outage. That
is what makes the percentage real: it is the share of measured time the server
was answering, kept across restarts along with the totals, how many people came
back, and what has been played.

**That, and what people have said about which games work, is the only state
Mocha keeps, and it needs a volume.** Without one the container's filesystem goes
away with the container, so every deploy resets the totals to zero, forgets which
games are broken, and starts the uptime record again - and, because uptime is
measured from a timestamp that no longer exists, the time the server was down is
not counted either. Mount a volume on the directory holding `STATUS_DATA_FILE`
(`/app/.cache` in the image, which also holds `REPORTS_DATA_FILE` and
`CDN_CACHE_DIR`) and all of it survives.
On Coolify that is a persistent storage entry with `/app/.cache` as the mount
path; in Compose it is a named volume on `/app/.cache`.

There are three files, all in that directory. The counts are written when they
change and at most once a minute, so a deploy loses at most the last minute of
them. Beside them sits a few hundred byte `.uptime` companion holding only the
uptime record, rewritten every heartbeat: that is what a kill leaves behind to
measure the outage from, and keeping it separate means an idle server with a
long history is not rewriting every visitor it has ever seen every 30 seconds.
Beside those is `REPORTS_DATA_FILE`, which holds the game reports and the visit
lengths behind them - see [How a game gets flagged](#how-a-game-gets-flagged).
All of them are written atomically, through a temporary file and a rename, so a
read that lands mid-write never sees half a file.

## How a game gets flagged

There are a few hundred games, they are folders on somebody else's CDN, and
they break without telling anybody. Nothing the server can do finds that out:
fetching `index.html` says the file is there, not that the game runs, keeps its
keyboard, or is playable. So `/reports` is built out of the only instrument
Mocha has, which is the people playing.

Anyone can flag a game with the flag in the corner of the viewer, and anyone can
say the same game works for them. **One report is a report, not a verdict.** It
takes `REPORTS_CONFIRM_FLAGS` people agreeing before a game is called not
working, and a report is answered when `REPORTS_DISPUTE_RATIO` times as many
people disagree - so one person flagging a game everybody else is playing moves
it to a list saying exactly that, rather than taking it down. Reports say what
is wrong, too: a game that loads and ignores the keyboard is a different problem
from one that never loads, and the page keeps them apart.

The other half is nobody's opinion. The status ping already says which game each
tab is on, so how long people stay is measurable, and that is the honest signal:
a visit past `REPORTS_PROVEN_SECONDS` is a game that ran, and up to
`REPORTS_PROVEN_WEIGHT` of those stand in for people agreeing. They are capped
there deliberately - a game that broke this morning still has every long visit it
ever held, so old evidence can outweigh a report or two and never a crowd of
them. It works the other way as well: a game `REPORTS_AUTO_SESSIONS` or more
people have opened and nearly all of them left inside `REPORTS_BOUNCE_SECONDS`
is flagged with nobody having reported it - which is the case a report system on
its own always misses, because the people it happens to just leave. Anybody
saying it works for them settles that, since a person is worth more than a
pattern.

Reports expire after `REPORTS_VOTE_DAYS`, so a game somebody fixed quietly stops
being flagged without anybody having to notice. They live in
`REPORTS_DATA_FILE`, written the same way the counts are, and want the same
volume - without one, every deploy forgets which games are broken.

## Games and the keyboard

Some games load, take the mouse, and ignore every key. That is usually not the
game being broken: the viewer shows everything in an iframe, and an iframe only hears the keyboard
while it holds focus. Arriving at a game leaves focus on the page around it, and
whether a click moves it depends on what is under the pointer, which is why this
was never all games - one that puts a canvas under the first click takes focus
from it, one that starts on a splash screen or draws into a frame of its own
does not.

`src/lib/keyboard.ts` handles both halves. The frame is handed focus when a game
loads, whenever a click lands anywhere that is not Mocha's own control bar, and
when the tab is returned to. Any key that still arrives at the page is copied
into the frame and into the same-origin frames inside it, `keyCode` included,
since the games this matters most for are old enough to read it. The copy only
ever happens when the frame did not have focus, so nothing is delivered twice.

## Support us
If you like Mocha and would like to support the development, you can donate to me [here](https://buymeacoffee.com/proudparrot2). It helps with server costs, domains, and otherwise financially supports me.
