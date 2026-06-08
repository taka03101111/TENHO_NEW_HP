// TENHO HP - MORE

const NOTE_URL = 'https://note.com/tenho_ai';
const NOTE_RSS = 'https://note.com/tenho_ai/rss';
const CARD_LIMIT = 3;
const RSS_TIMEOUT = 32000000;
const OG_TIMEOUT = 220000000;

const PROXIES = [
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
  (url) => 'https://thingproxy.freeboard.io/fetch/' + url,
];

const LOADING_ITEMS = Array.from({ length: CARD_LIMIT }, (_, index) => ({
  date: '',
  category: 'NOTE',
  title: '読み込み中',
  link: NOTE_URL,
  image: null,
  loading: true,
  art: ['orbit', 'circuit', 'grid'][index],
}));

function fmtDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function withCacheBust(url) {
  const glue = url.includes('?') ? '&' : '?';
  return `${url}${glue}_=${Date.now()}`;
}

function normalizeImageUrl(url, width = 900) {
  if (!url) return null;

  try {
    const parsed = new URL(url.trim());
    parsed.searchParams.set('width', String(width));
    return parsed.toString();
  } catch (_) {
    const clean = url.trim();
    return clean + (clean.includes('?') ? '&' : '?') + `width=${width}`;
  }
}

function parseSrcset(srcset) {
  return srcset
    ?.split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .find(Boolean) || null;
}

function imageFromElement(image) {
  if (!image) return null;

  return image.getAttribute('src')
    || image.getAttribute('data-src')
    || image.getAttribute('data-original')
    || image.getAttribute('data-lazy-src')
    || parseSrcset(image.getAttribute('data-srcset'))
    || parseSrcset(image.getAttribute('srcset'));
}

function imageFromHtml(html) {
  if (!html) return null;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const ogImage = doc.querySelector('meta[property="og:image"]')
      || doc.querySelector('meta[name="og:image"]')
      || doc.querySelector('meta[name="twitter:image"]');
    return ogImage?.getAttribute('content')?.trim()
      || imageFromElement(doc.querySelector('img'));
  } catch (_) {
    return null;
  }
}

function extractRssImage(item) {
  const encoded = item.getElementsByTagName('content:encoded')[0]?.textContent;
  const description = item.querySelector('description')?.textContent;
  const htmlImage = imageFromHtml(encoded || description);
  if (htmlImage) return normalizeImageUrl(htmlImage);

  const media = item.getElementsByTagName('media:thumbnail')[0]
    || item.getElementsByTagName('media:content')[0];
  const mediaUrl = media?.getAttribute('url') || media?.textContent?.trim();
  if (mediaUrl) return normalizeImageUrl(mediaUrl);

  const enclosureUrl = item.getElementsByTagName('enclosure')[0]?.getAttribute('url');
  return normalizeImageUrl(enclosureUrl);
}

function requestSignal(timeout) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  return {
    signal: controller.signal,
    abort: () => {
      window.clearTimeout(timer);
      controller.abort();
    },
  };
}

async function fetchProxyText(targetUrl, timeout, isUsable) {
  const requests = PROXIES.map((build) => {
    const controller = requestSignal(timeout);

    return fetch(build(withCacheBust(targetUrl)), {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!isUsable(text)) throw new Error('Unusable response');
        return text;
      })
      .finally(controller.abort);
  });

  return Promise.any(requests);
}

function parseRss(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  return Array.from(doc.querySelectorAll('item'))
    .map((item) => {
      const title = item.querySelector('title')?.textContent?.trim() || 'TENHO note';
      const link = item.querySelector('link')?.textContent?.trim() || NOTE_URL;
      const pubDate = item.querySelector('pubDate')?.textContent?.trim();
      const timestamp = Date.parse(pubDate || '');

      return {
        timestamp: Number.isNaN(timestamp) ? 0 : timestamp,
        date: fmtDate(pubDate),
        category: 'NOTE',
        title,
        link,
        image: extractRssImage(item),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, CARD_LIMIT)
    .map((item, index) => ({
      ...item,
      art: ['orbit', 'circuit', 'grid'][index % 3],
    }));
}

async function fetchLatestNotes() {
  const rss = await fetchProxyText(
    NOTE_RSS,
    RSS_TIMEOUT,
    (text) => text?.includes('<item')
  );

  return parseRss(rss);
}

async function fetchOgImage(link) {
  try {
    const html = await fetchProxyText(
      link,
      OG_TIMEOUT,
      (text) => text?.includes('og:image') || text?.includes('<img')
    );
    return normalizeImageUrl(imageFromHtml(html));
  } catch (_) {
    return null;
  }
}

function ThumbFallback({ kind }) {
  if (kind === 'orbit') {
    return (
      <div className="more-thumb-art">
        <svg viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <circle cx="0" cy="0" r="34" fill="#BEDCFF" opacity="0.35" />
          <ellipse cx="0" cy="0" rx="38" ry="22" fill="none" stroke="#0E0E0E" strokeWidth="0.4" />
          <ellipse cx="0" cy="0" rx="28" ry="16" fill="none" stroke="#76736B" strokeWidth="0.25" transform="rotate(28)" />
          <circle cx="0" cy="0" r="4" fill="#0E0E0E" />
        </svg>
      </div>
    );
  }

  if (kind === 'circuit') {
    return (
      <div className="more-thumb-art">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g fill="none" stroke="#0E0E0E" strokeWidth="0.4">
            <path d="M10 20 L30 20 L30 40 L60 40 L60 20 L90 20" />
            <path d="M10 50 L25 50 L25 70 L55 70 L55 50 L75 50 L75 30 L90 30" />
            <path d="M10 80 L40 80 L40 60 L80 60 L80 80 L90 80" />
          </g>
          <g fill="#0E0E0E">
            <circle cx="30" cy="20" r="1.8" />
            <circle cx="60" cy="40" r="1.8" />
            <circle cx="75" cy="30" r="1.8" />
            <circle cx="80" cy="60" r="1.8" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className="more-thumb-art">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect x="20" y="20" width="20" height="20" fill="#0E0E0E" opacity="0.85" />
        <rect x="42" y="20" width="14" height="14" fill="none" stroke="#0E0E0E" strokeWidth="0.4" />
        <rect x="42" y="36" width="14" height="14" fill="#BEDCFF" opacity="0.7" />
        <rect x="58" y="20" width="22" height="30" fill="none" stroke="#76736B" strokeWidth="0.3" />
        <rect x="20" y="50" width="36" height="20" fill="none" stroke="#0E0E0E" strokeWidth="0.4" />
        <rect x="58" y="52" width="22" height="18" fill="#0E0E0E" />
      </svg>
    </div>
  );
}

function MoreCard({ item, index }) {
  return (
    <a
      href={item.link || NOTE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="more-card reveal"
      data-delay={index + 1}
      aria-busy={item.loading ? 'true' : undefined}
    >
      <div className="more-thumb">
        {item.image ? (
          <div
            className="more-thumb-img"
            style={{ backgroundImage: `url("${item.image}")` }}
          />
        ) : (
          <ThumbFallback kind={item.art} />
        )}
      </div>

      <div className="more-body">
        <div className="more-meta">
          {item.date ? <span>{item.date}</span> : null}
          {item.date ? <span>/</span> : null}
          <span>{item.category || 'NOTE'}</span>
        </div>
        <div className="more-title">{item.title}</div>
        <div className="more-tag">READ <span>-&gt;</span></div>
      </div>
    </a>
  );
}

function More() {
  const [items, setItems] = React.useState(LOADING_ITEMS);

  React.useEffect(() => {
    let active = true;

    fetchLatestNotes()
      .then((notes) => {
        if (!active || !notes.length) return;
        const latestNotes = notes.slice(0, CARD_LIMIT);
        setItems(latestNotes);

        const missingImageJobs = latestNotes.map(async (note) => {
          if (note.image) return note;
          const image = await fetchOgImage(note.link);
          return image ? { ...note, image } : note;
        });

        Promise.all(missingImageJobs).then((notesWithImages) => {
          if (active) setItems(notesWithImages);
        });
      })
      .catch(() => {
        if (active) setItems([]);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="more" data-screen-label="07 MORE">
      <div className="shell">
        <div className="section-index">07 / 09 - MORE</div>

        <div className="section-head">
          <div className="head-left">
            <span className="eyebrow reveal">RECENT NOTES</span>
            <div className="head-en reveal" data-delay="1">
              Case
            </div>
          </div>

          <div className="head-jp is-serif reveal" data-delay="2">
            実践事例や最新情報を、<br />
            <span className="em">発信</span>しています。
          </div>
        </div>

        {items.length ? (
          <div className="more-grid">
            {items.map((item, index) => (
              <MoreCard key={item.link || `${item.title}-${index}`} item={item} index={index} />
            ))}
          </div>
        ) : (
          <div className="more-cta reveal in" data-delay="1">
            <a href={NOTE_URL} target="_blank" rel="noopener noreferrer">
              noteで最新情報を見る <span>-&gt;</span>
            </a>
          </div>
        )}

        <div className="more-cta reveal" data-delay="4">
          <a href={NOTE_URL} target="_blank" rel="noopener noreferrer">
            さらに事例を見る <span>-&gt;</span>
          </a>
        </div>
      </div>
    </section>
  );
}

window.More = More;
