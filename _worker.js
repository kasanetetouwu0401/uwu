import { connect } from "cloudflare:sockets";

// Variables
let serviceName = "";
let APP_DOMAIN = "";

let prxIP = "";

// Constant
const horse = "dHJvamFu";
const flash = "dm1lc3M=";
const neko = "dmxlc3M=";
const v2 = "djJyYXk=";

const PORTS = [443, 80];
const PROTOCOLS = [atob(horse), atob(flash), atob(neko), "ss"];

// Sumber data HANYA dari KV JSON
const KV_PRX_URL = "https://raw.githubusercontent.com/kasanetetouwu0401/miku/refs/heads/main/kvProxyList.json";
const DNS_SERVER_ADDRESS = "8.8.8.8";
const DNS_SERVER_PORT = 53;
const RELAY_SERVER_UDP = {
  host: "udp-relay.hobihaus.space", 
  port: 7300,
};

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
const CORS_HEADER_OPTIONS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// --- REGION MAPPING ---
const REGION_MAP = {
  ASIA: ["ID", "SG", "MY", "PH", "TH", "VN", "JP", "KR", "CN", "HK", "TW"],
  SOUTHASIA: ["IN", "BD", "PK", "LK", "NP", "AF", "BT", "MV"],
  CENTRALASIA: ["KZ", "UZ", "TM", "KG", "TJ"],
  NORTHASIA: ["RU"],
  MIDDLEEAST: ["AE", "SA", "IR", "IQ", "JO", "IL", "YE", "SY", "OM", "KW", "QA", "BH", "LB"],
  CIS: ["RU", "UA", "BY", "KZ", "UZ", "AM", "GE", "MD", "TJ", "KG", "TM", "AZ"],
  WESTEUROPE: ["FR", "DE", "NL", "BE", "AT", "CH", "IE", "LU", "MC"],
  EASTEUROPE: ["PL", "CZ", "SK", "HU", "RO", "BG", "MD", "UA", "BY"],
  NORTHEUROPE: ["SE", "FI", "NO", "DK", "EE", "LV", "LT", "IS"],
  SOUTHEUROPE: ["IT", "ES", "PT", "GR", "HR", "SI", "MT", "AL", "BA", "RS", "ME", "MK"],
  EUROPE: ["FR", "DE", "NL", "BE", "AT", "CH", "IE", "LU", "MC", "PL", "CZ", "SK", "HU", "RO", "BG", "MD", "UA", "BY", "SE", "FI", "NO", "DK", "EE", "LV", "LT", "IS", "IT", "ES", "PT", "GR", "HR", "SI", "MT", "AL", "BA", "RS", "ME", "MK"],
  AFRICA: ["ZA", "NG", "EG", "MA", "KE", "DZ", "TN", "GH", "CI", "SN", "ET"],
  NORTHAMERICA: ["US", "CA", "MX"],
  SOUTHAMERICA: ["BR", "AR", "CL", "CO", "PE", "VE", "EC", "UY", "PY", "BO"],
  LATAM: ["MX", "BR", "AR", "CL", "CO", "PE", "VE", "EC", "UY", "PY", "BO", "CR", "GT", "PA", "DO", "HN", "NI", "SV"],
  AMERICA: ["US", "CA", "MX", "BR", "AR", "CL", "CO", "PE", "VE", "EC"],
  OCEANIA: ["AU", "NZ", "PG", "FJ"],
  GLOBAL: []
};

// Encrypted Stream Constants (Base64 Encoded)
const SALT_A1 = atob("Vk1lc3MgSGVhZGVyIEFFQUQgS2V5X0xlbmd0aA==");
const SALT_A2 = atob("Vk1lc3MgSGVhZGVyIEFFQUQgTm9uY2VfTGVuZ3Ro");
const SALT_A3 = atob("Vk1lc3MgSGVhZGVyIEFFQUQgS2V5");
const SALT_A4 = atob("Vk1lc3MgSGVhZGVyIEFFQUQgTm9uY2U=");
const SALT_B1 = atob("QUVBRCBSZXNwIEhlYWRlciBMZW4gS2V5");
const SALT_B2 = atob("QUVBRCBSZXNwIEhlYWRlciBMZW4gSVY=");
const SALT_B3 = atob("QUVBRCBSZXNwIEhlYWRlciBLZXk=");
const SALT_B4 = atob("QUVBRCBSZXNwIEhlYWRlciBJVg==");

async function getKVPrxList(kvPrxUrl = KV_PRX_URL) {
  if (!kvPrxUrl) throw new Error("No URL Provided!");
  try {
    const kvPrx = await fetch(kvPrxUrl);
    if (kvPrx.status == 200) return await kvPrx.json();
  } catch(e) { console.error("KV Fetch Error", e); }
  return {};
}

async function reverseWeb(request, target, targetPath) {
  const targetUrl = new URL(request.url);
  const targetChunk = target.split(":");

  targetUrl.hostname = targetChunk[0];
  targetUrl.port = targetChunk[1]?.toString() || "443";
  targetUrl.pathname = targetPath || targetUrl.pathname;

  const modifiedRequest = new Request(targetUrl, request);
  modifiedRequest.headers.set("X-Forwarded-Host", request.headers.get("Host"));

  const response = await fetch(modifiedRequest);
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADER_OPTIONS)) {
    newResponse.headers.set(key, value);
  }
  newResponse.headers.set("X-Proxied-By", "Cloudflare Worker");
  return newResponse;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      APP_DOMAIN = url.hostname;
      serviceName = APP_DOMAIN.split(".")[0];
      const path = url.pathname;
      const upgradeHeader = request.headers.get("Upgrade");

      // === WEBSOCKET HANDLER ===
      if (upgradeHeader === "websocket") {
        
        // 1. /PROXYLIST/ID,SG
        const proxyListMatch = path.match(/^\/PROXYLIST\/([A-Z]{2}(,[A-Z]{2})*)$/i);
        if (proxyListMatch) {
          const countryCodes = proxyListMatch[1].toUpperCase().split(",");
          const kvPrx = await getKVPrxList();
          
          const availableCountries = countryCodes.filter(code => kvPrx[code] && kvPrx[code].length > 0);
          if (availableCountries.length === 0) return new Response(`No proxies`, { status: 404 });
          
          const prxKey = availableCountries[Math.floor(Math.random() * availableCountries.length)];
          // Format KV biasanya "ip:port" string
          const rawAddress = kvPrx[prxKey][Math.floor(Math.random() * kvPrx[prxKey].length)];
          prxIP = rawAddress;
          
          return await websocketHandler(request);
        }

        // 2. /ALL atau /ALLn
        const allMatch = path.match(/^\/ALL(\d+)?$/i);
        if (allMatch) {
          const index = allMatch[1] ? parseInt(allMatch[1], 10) - 1 : null;
          const kvPrx = await getKVPrxList();
          const all = Object.values(kvPrx).flat(); // Flatten semua array IP

          if (all.length === 0) return new Response("No proxies", { status: 404 });
          
          if (index !== null) {
              if (index < 0 || index >= all.length) return new Response("Index out of range", { status: 400 });
              prxIP = all[index];
          } else {
              prxIP = all[Math.floor(Math.random() * all.length)];
          }
          return await websocketHandler(request);
        }

        // 3. /PUTAR
        const putarMatch = path.match(/^\/PUTAR(\d+)?$/i);
        if (putarMatch) {
          const count = putarMatch[1] ? parseInt(putarMatch[1], 10) : null;
          const kvPrx = await getKVPrxList();
          const countries = Object.keys(kvPrx).filter(k => kvPrx[k].length > 0);
          
          if (countries.length === 0) return new Response("No proxies", { status: 404 });

          let selectedCountries = count === null ? countries : [...countries].sort(() => Math.random() - 0.5).slice(0, Math.min(count, countries.length));
          
          // Ambil random key (negara) dari selected, lalu random IP
          const randomKey = selectedCountries[Math.floor(Math.random() * selectedCountries.length)];
          prxIP = kvPrx[randomKey][Math.floor(Math.random() * kvPrx[randomKey].length)];
          
          return await websocketHandler(request);
        }

        // 4. /REGION
        const regionMatch = path.match(/^\/([A-Z]+)(\d+)?$/i);
        if (regionMatch && REGION_MAP[regionMatch[1].toUpperCase()]) {
          const regionKey = regionMatch[1].toUpperCase();
          const index = regionMatch[2] ? parseInt(regionMatch[2], 10) - 1 : null;
          const countries = REGION_MAP[regionKey];
          const kvPrx = await getKVPrxList();
          
          let pool = [];
          if (regionKey === "GLOBAL") pool = Object.values(kvPrx).flat();
          else countries.forEach(c => { if(kvPrx[c]) pool.push(...kvPrx[c]); });
          
          if (pool.length === 0) return new Response("No proxies for region", { status: 404 });
          if (index !== null && (index < 0 || index >= pool.length)) return new Response("Out of range", {status:400});
          
          prxIP = index === null ? pool[Math.floor(Math.random() * pool.length)] : pool[index];
          return await websocketHandler(request);
        }

        // 5. /CC (Country Code)
        const countryMatch = path.match(/^\/([A-Z]{2})(\d+)?$/);
        if (countryMatch) {
          const cc = countryMatch[1].toUpperCase();
          const index = countryMatch[2] ? parseInt(countryMatch[2], 10) - 1 : null;
          const kvPrx = await getKVPrxList();
          
          if (!kvPrx[cc] || kvPrx[cc].length === 0) return new Response("No proxies", {status:404});
          
          if (index !== null && index >= kvPrx[cc].length) return new Response("Out of range", {status:400});
          prxIP = index === null ? kvPrx[cc][Math.floor(Math.random() * kvPrx[cc].length)] : kvPrx[cc][index];
          
          return await websocketHandler(request);
        }

        // 6. Direct IP /ip:port
        const ipPortMatch = path.match(/^\/(.+[:=-]\d+)$/);
        if (ipPortMatch) {
          prxIP = ipPortMatch[1].replace(/[=:-]/, ":");
          return await websocketHandler(request);
        }

        // 7. Legacy (Comma separated)
        if (url.pathname.length === 3 || url.pathname.includes(',')) {
          const keys = url.pathname.replace("/", "").toUpperCase().split(",");
          const key = keys[Math.floor(Math.random() * keys.length)];
          const kvPrx = await getKVPrxList();
          if (kvPrx[key] && kvPrx[key].length > 0) {
            prxIP = kvPrx[key][Math.floor(Math.random() * kvPrx[key].length)];
            return await websocketHandler(request);
          }
        }
      }

      // === API HANDLER (GENERATOR CONFIG) ===
      if (url.pathname.startsWith("/api/v1")) {
        const apiPath = url.pathname.replace("/api/v1", "");

        if (apiPath.startsWith("/sub")) {
          const filterCC = url.searchParams.get("cc")?.split(",") || [];
          const filterPort = url.searchParams.get("port")?.split(",") || PORTS;
          const filterVPN = url.searchParams.get("vpn")?.split(",") || PROTOCOLS;
          const filterLimit = parseInt(url.searchParams.get("limit")) || 10;
          const filterFormat = url.searchParams.get("format") || "raw";
          const fillerDomain = url.searchParams.get("domain") || APP_DOMAIN;

          // Fetch Data dari KV
          const kvPrx = await getKVPrxList();
          
          // Flatten data berdasarkan filter CC
          let filteredList = [];
          Object.keys(kvPrx).forEach(cc => {
            if (filterCC.length === 0 || filterCC.includes(cc)) {
                // Map array string IP:PORT menjadi object {ip, port, cc}
                const countryProxies = kvPrx[cc].map(addr => {
                    const [ip, port] = addr.split(":");
                    return { ip, port, cc, org: "KV Node" };
                });
                filteredList.push(...countryProxies);
            }
          });

          // Shuffle
          shuffleArray(filteredList);

          const uuid = crypto.randomUUID();
          const result = [];
          
          for (const prx of filteredList) {
            const uri = new URL(`${atob(horse)}://${fillerDomain}`);
            uri.searchParams.set("encryption", "none");
            uri.searchParams.set("type", "ws");
            uri.searchParams.set("host", APP_DOMAIN);

            for (const portStr of filterPort) {
              const port = parseInt(portStr);
              // Cek jika port proxy sama dengan port filter, atau jika KV tidak punya port spesifik
              // Namun KV format biasanya sudah spesifik IP:PORT. Kita pakai PORT dari KV jika sesuai, atau skip jika beda.
              // Logic: KV = "IP:PORT". Config = "IP:PORT_FILTER". 
              // Biasanya config generator memakai IP Proxy sebagai endpoint, tapi portnya mengikuti port service (80/443).
              // Disini kita ikuti logic awal: prxIP-prxPort adalah PATH. Endpoint adalah fillerDomain:portFilter.

              for (const protocol of filterVPN) {
                if (result.length >= filterLimit) break;
                uri.protocol = protocol;
                uri.port = port.toString();
                if (protocol == "ss") {
                  uri.username = btoa(`none:${uuid}`);
                  uri.searchParams.set("plugin", `${atob(v2)}-plugin${port == 80 ? "" : ";tls"};mux=0;mode=websocket;path=/${prx.ip}-${prx.port};host=${APP_DOMAIN}`);
                } else {
                  uri.username = uuid;
                }
                uri.searchParams.set("security", port == 443 ? "tls" : "none");
                uri.searchParams.set("sni", port == 80 && protocol == atob(flash) ? "" : APP_DOMAIN);
                uri.searchParams.set("path", `/${prx.ip}-${prx.port}`);
                uri.hash = `${result.length + 1} ${getFlagEmoji(prx.cc)} ${prx.org} WS ${port == 443 ? "TLS" : "NTLS"} [${serviceName}]`;
                result.push(uri.toString());
              }
            }
          }

          let finalResult = "";
          switch (filterFormat) {
            case "raw":
              finalResult = result.join("\n");
              break;
            case atob(v2): // Base64
              finalResult = btoa(result.join("\n"));
              break;
            default:
              finalResult = result.join("\n");
              break;
          }

          return new Response(finalResult, {
            status: 200,
            headers: { ...CORS_HEADER_OPTIONS },
          });
        } 
        else if (apiPath.startsWith("/myip")) {
          return new Response(
            JSON.stringify({
              ip: request.headers.get("cf-connecting-ipv6") || request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip"),
              colo: request.headers.get("cf-ray")?.split("-")[1],
              ...request.cf,
            }),
            { headers: { ...CORS_HEADER_OPTIONS } }
          );
        }
      }

      const targetReversePrx = env.REVERSE_PRX_TARGET || "example.com";
      return await reverseWeb(request, targetReversePrx);
    } catch (err) {
      return new Response(`An error occurred: ${err.toString()}`, {
        status: 500,
        headers: { ...CORS_HEADER_OPTIONS },
      });
    }
  },
};
