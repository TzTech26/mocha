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

Raw git hosts serve every text file as `text/plain` and attach their own
content security policy, so the `/cdn` proxy restores the content type from the
file extension and drops those headers on the way through. Without that a game
arrives as source code the browser refuses to run.

## Support us
If you like Mocha and would like to support the development, you can donate to me [here](https://buymeacoffee.com/proudparrot2). It helps with server costs, domains, and otherwise financially supports me.
