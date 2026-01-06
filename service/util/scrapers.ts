import * as cheerio from "cheerio";

export async function tiktok(url: string): Promise<string | null> {
  try {
    const form = new URLSearchParams({
      id: url,
      locale: "en",
      tt: Math.random().toString(36).slice(2, 10),
    });

    const res = await fetch("https://ssstik.io/abc?url=dl", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://ssstik.io",
        referer: "https://ssstik.io/en-1",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      },
      body: form.toString(),
    });

    if (!res.ok) return null;

    const html: string = await res.text();
    const $ = cheerio.load(html);

    const normal: string | undefined = $(
      "a.download_link.without_watermark",
    ).attr("href");
    if (normal) return normal;

    return null;
  } catch {
    return null;
  }
}
