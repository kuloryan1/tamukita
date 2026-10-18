import { readFileSync } from "node:fs";

const [appConfigPath, tunnelConfigPath, productionConfigPath] = process.argv.slice(2);

if (!appConfigPath || !tunnelConfigPath || !productionConfigPath) {
  throw new Error("Pass the normalized staging app, staging tunnel, and production Compose JSON files.");
}

const app = JSON.parse(readFileSync(appConfigPath, "utf8"));
const tunnel = JSON.parse(readFileSync(tunnelConfigPath, "utf8"));
const production = JSON.parse(readFileSync(productionConfigPath, "utf8"));
const appOrigin = app.networks?.["staging-origin"];
const tunnelOrigin = tunnel.networks?.["staging-origin"];
const appOriginName = appOrigin?.name;
const tunnelOriginName = tunnelOrigin?.name;
const productionOriginName = production.networks?.["staging-origin"]?.name;

if (!appOriginName || !tunnelOriginName || appOriginName !== tunnelOriginName) {
  throw new Error("The web service and Cloudflare Tunnel must use the same named staging-origin network.");
}

if (appOriginName === "dokploy-network" || app.networks?.default?.name === appOriginName) {
  throw new Error("The staging-origin network must be distinct from Dokploy and the app's private network.");
}

if (!productionOriginName || productionOriginName === appOriginName) {
  throw new Error("The staging-origin network must be unique from the production Compose project's network.");
}

if (appOrigin?.external || tunnelOrigin?.external !== true) {
  throw new Error("Compose must create the app origin network and the Tunnel must attach to it as an external network.");
}

const appOriginUsers = Object.entries(app.services ?? {})
  .filter(([, service]) => Object.hasOwn(service.networks ?? {}, "staging-origin"))
  .map(([serviceName]) => serviceName)
  .sort();

if (appOriginUsers.length !== 1 || appOriginUsers[0] !== "web") {
  throw new Error(`Only the web service may join staging-origin; found: ${appOriginUsers.join(", ") || "none"}.`);
}

if (!Object.hasOwn(app.services?.web?.networks ?? {}, "default")) {
  throw new Error("The web service must retain its private Compose network for database and Redis access.");
}

const tunnelNetworks = Object.keys(tunnel.services?.cloudflared?.networks ?? {});

if (tunnelNetworks.length !== 1 || tunnelNetworks[0] !== "staging-origin") {
  throw new Error("The Cloudflare Tunnel must use only staging-origin so it cannot reach the app's private services.");
}

console.log(`Staging tunnel is limited to the web service on ${appOriginName}; production uses ${productionOriginName}.`);
