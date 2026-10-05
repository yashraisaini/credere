import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/photo?q=Lisbon&skip=0
 * -> { photo: { id, url, color, alt, credit: { name, link }, query } }
 * -> { photo: null } when the search has nothing for this term
 *
 * Unsplash search, free tier. The access key is server-only, same rule as the
 * Anthropic key: it never reaches the browser.
 *
 * Two things their API terms require and we do here:
 *   - credit the photographer with a link back, carrying our utm parameters
 *   - ping `download_location` whenever a photo actually gets used
 */

const APP = "credere";
const UTM = `utm_source=${APP}&utm_medium=referral`;

export async function GET(req: NextRequest) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Group photos need UNSPLASH_ACCESS_KEY in .env.local." },
      { status: 503 },
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "Pass a search term, like ?q=Lisbon." }, { status: 400 });
  }
  // Lets the user re-roll past a photo they didn't like.
  const skip = Math.min(9, Math.max(0, Number(req.nextUrl.searchParams.get("skip")) || 0));

  let res: Response;
  try {
    res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}` +
        `&per_page=10&orientation=landscape&content_filter=high`,
      {
        headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
        next: { revalidate: 86400 },
      },
    );
  } catch {
    return NextResponse.json({ error: "Couldn't reach Unsplash." }, { status: 502 });
  }

  if (res.status === 401) {
    return NextResponse.json({ error: "Unsplash rejected the access key." }, { status: 502 });
  }
  if (res.status === 403) {
    return NextResponse.json({ error: "Unsplash rate limit reached. Try again in an hour." }, { status: 429 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "Unsplash search failed." }, { status: 502 });
  }

  const data = (await res.json()) as { results?: UnsplashPhoto[] };
  const results = data.results ?? [];
  if (results.length === 0) return NextResponse.json({ photo: null });

  const hit = results[skip % results.length];

  // Unsplash asks for this ping when a photo gets used. Fire and forget: a
  // failure here shouldn't cost the user their photo.
  if (hit.links?.download_location) {
    fetch(hit.links.download_location, {
      headers: { Authorization: `Client-ID ${key}` },
    }).catch(() => {});
  }

  return NextResponse.json({
    photo: {
      id: hit.id,
      url: hit.urls.raw,
      color: hit.color ?? "#0b2a1f",
      alt: hit.alt_description ?? hit.description ?? q,
      credit: {
        name: hit.user.name,
        link: `${hit.user.links.html}?${UTM}`,
      },
      query: q,
    },
  });
}

interface UnsplashPhoto {
  id: string;
  color: string | null;
  alt_description: string | null;
  description: string | null;
  urls: { raw: string; full: string; regular: string; small: string };
  links: { download_location: string };
  user: { name: string; links: { html: string } };
}
