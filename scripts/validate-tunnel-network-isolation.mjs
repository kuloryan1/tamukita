import { readFileSync } from "node:fs";

const [appConfigPath, tunnelConfigPath, productionConfigPath, productionTunnelConfigPath] = process.argv.slice(2);

if (!appConfigPath || !tunnelConfigPath || !productionConfigPath || !productionTunnelConfigPath) {
  throw new Error("Pass normalized staging app/tunnel and production app/tunnel Compose JSON files.");
}

const app = JSON.parse(readFileSync(appConfigPath, "utf8"));
const tunnel = JSON.parse(readFileSync(tunnelConfigPath, "utf8"));
const production = JSON.parse(readFileSync(productionConfigPath, "utf8"));
const productionTunnel = JSON.parse(readFileSync(productionTunnelConfigPath, "utf8"));
const appOrigin = app.networks?.["staging-origin"];
const tunnelOrigin = tunnel.networks?.["staging-origin"];
const appOriginName = appOrigin?.name;
const tunnelOriginName = tunnelOrigin?.name;
const productionOriginName = production.networks?.["staging-origin"]?.name;
const productionOrigin = production.networks?.["staging-origin"];
const productionTunnelOrigin = productionTunnel.networks?.["production-origin"];
const productionTunnelOriginName = productionTunnelOrigin?.name;

if (!appOriginName || !tunnelOriginName || appOriginName !== tunnelOriginName) {
  throw new Error("The web service and Cloudflare Tunnel must use the same named staging-origin network.");
}

if (appOriginName === "dokploy-network" || app.networks?.default?.name === appOriginName) {
  throw new Error("The staging-origin network must be distinct from Dokploy and the app's private network.");
}

if (!productionOriginName || productionOriginName === appOriginName) {
  throw new Error("Staging and production origin networks must have different names.");
}

if (!productionOriginName || productionOriginName !== productionTunnelOriginName) {
  throw new Error("The production web service and Cloudflare Tunnel must use the same named origin network.");
}

if (productionOriginName === "dokploy-network" || productionOriginName === production.networks?.default?.name) {
  throw new Error("The production origin network must be distinct from Dokploy and the app's private network.");
}

if (appOrigin?.external || tunnelOrigin?.external !== true || productionOrigin?.external) {
  throw new Error("Each app Compose file must create its origin network; the staging Tunnel must attach externally.");
}

if (productionTunnelOrigin?.external !== true) {
  throw new Error("The production Tunnel must attach to the app-created origin network as an external network.");
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
const productionTunnelNetworks = Object.keys(productionTunnel.services?.cloudflared?.networks ?? {});

if (tunnelNetworks.length !== 1 || tunnelNetworks[0] !== "staging-origin") {
  throw new Error("The Cloudflare Tunnel must use only staging-origin so it cannot reach the app's private services.");
}

if (productionTunnelNetworks.length !== 1 || productionTunnelNetworks[0] !== "production-origin") {
  throw new Error("The production Cloudflare Tunnel must use only production-origin so it cannot reach private services.");
}

const productionOriginUsers = Object.entries(production.services ?? {})
  .filter(([, service]) => Object.hasOwn(service.networks ?? {}, "staging-origin"))
  .map(([serviceName]) => serviceName)
  .sort();

if (productionOriginUsers.length !== 1 || productionOriginUsers[0] !== "web") {
  throw new Error(`Only the production web service may join its origin network; found: ${productionOriginUsers.join(", ") || "none"}.`);
}

if (!Object.hasOwn(production.services?.web?.networks ?? {}, "default")) {
  throw new Error("The production web service must retain its private Compose network for database and Redis access.");
}

console.log(`Staging and production tunnels are isolated to their web services on ${appOriginName} and ${productionOriginName}.`);
