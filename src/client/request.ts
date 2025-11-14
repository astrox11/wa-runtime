import { request } from "node:https";
import { request as httpRequest } from "node:http";

export interface FetchOpts {
    headers?: Partial<BrowserHeaders>;
    maxRedirects?: number;
}

export type BrowserHeaders = {
    "accept": string;
    "accept-language": string;
    "sec-ch-ua"?: string;
    "sec-ch-ua-mobile"?: string;
    "sec-ch-ua-platform"?: string;
    "sec-fetch-dest"?: string;
    "sec-fetch-mode"?: string;
    "sec-fetch-site"?: string;
    "sec-fetch-user"?: string;
    "upgrade-insecure-requests"?: string;
    "user-agent": string;
    "cache-control"?: string;
    "pragma"?: string;
    "content-type"?: string;
    "dnt": string;
    [key: string]: string | undefined;
};

export const DefaultBrowserHeaders: BrowserHeaders = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.5",
    "upgrade-insecure-requests": "1",
    "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

    "sec-ch-ua": "\"Chromium\";v=\"120\", \"Not_A Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Linux\"",

    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    dnt: "1"
};


function applyHeaders(custom?: Partial<BrowserHeaders>): BrowserHeaders {
    return { ...DefaultBrowserHeaders, ...(custom || {}) };
}

function doRequest(method: string, urlStr: string, body: any, opts: FetchOpts, redirects = 0): Promise<{ status: number; headers: any; body: string }> {
    const max = opts.maxRedirects ?? 5;
    if (redirects > max) throw new Error("Too many redirects");

    const u = new URL(urlStr);
    const useHttps = u.protocol === "https:";
    const reqFn = useHttps ? request : httpRequest;

    const headers = applyHeaders(opts.headers);

    const reqOptions = {
        method,
        hostname: u.hostname,
        port: u.port || (useHttps ? 443 : 80),
        path: u.pathname + u.search,
        headers,
    };

    return new Promise((resolve, reject) => {
        const req = reqFn(reqOptions, async (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", async () => {
                const status = res.statusCode || 0;
                const location = res.headers.location;

                if (location && [301, 302, 303, 307, 308].includes(status)) {
                    const nextURL = new URL(location, urlStr).toString();
                    const nextMethod = status === 303 ? "GET" : method;
                    const nextBody = nextMethod === "GET" ? null : body;
                    const next = await doRequest(nextMethod, nextURL, nextBody, opts, redirects + 1);
                    resolve(next);
                    return;
                }

                resolve({ status, headers: res.headers, body: data });
            });
        });

        req.on("error", reject);

        if (method !== "GET" && body != null) {
            if (typeof body === "string" || Buffer.isBuffer(body)) req.write(body);
            else req.write(JSON.stringify(body));
        }

        req.end();
    });
}

export async function get(url: string, opts: FetchOpts = {}) {
    return doRequest("GET", url, null, opts);
}

export async function post(url: string, body: any, opts: FetchOpts = {}) {
    return doRequest("POST", url, body, opts);
}
