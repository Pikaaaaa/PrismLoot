/**
 * Startup file for Plesk / Passenger / Firehost Node apps.
 * VPS with a reverse proxy can keep using `npm start` (`next start`).
 */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "0.0.0.0";
const passenger = typeof globalThis.PhusionPassenger !== "undefined";

if (passenger) {
  globalThis.PhusionPassenger.configure({ autoInstall: false });
}

const app = next({
  dev: false,
  hostname: passenger ? "127.0.0.1" : hostname,
  port: passenger ? 3000 : port,
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url || "/", true));
  });
  if (passenger) {
    server.listen("passenger");
  } else {
    server.listen(port, hostname, () => {
      console.log(`PrismLoot listening on http://${hostname}:${port}`);
    });
  }
});
