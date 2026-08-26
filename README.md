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

## Tunneling with ngrok

`npm run tunnel` exposes locally running services through [ngrok](https://ngrok.com/download), which has to be installed and on your `PATH`. The script only opens tunnels, so start the server (`npm run start`) separately.

Copy `.env.example` to `.env` and fill it in:

```sh
NGROK_AUTHTOKEN=your_authtoken
NGROK_DOMAIN_1=mocha.ngrok.app
NGROK_PORT_1=3003
```

A tunnel is started for every `NGROK_PORT_N` that is set, up to three at once. `NGROK_DOMAIN_N` is the reserved domain that tunnel forwards from; leave it blank to get a random ngrok url. Ports may also be written as `host:port` or a full url to reach a service that isn't on localhost, and `NGROK_REGION` picks the agent region.

Note that more than one simultaneous tunnel requires a paid ngrok plan. Everything is passed to the agent through a temporary config file, and the authtoken is handed over through the environment so it never touches disk.

## Support us
If you like Mocha and would like to support the development, you can donate to me [here](https://buymeacoffee.com/proudparrot2). It helps with server costs, domains, and otherwise financially supports me.
