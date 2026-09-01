const fs = require('fs');
const path = require('path');
const nodeHtmlToImage = require('node-html-to-image');

const DESIGN_WIDTH = 2160;
const DESIGN_HEIGHT = 2700;
const OUTPUT_SCALE = 2;
const OUTPUT_WIDTH = DESIGN_WIDTH * OUTPUT_SCALE;
const OUTPUT_HEIGHT = DESIGN_HEIGHT * OUTPUT_SCALE;

function assetDataUri(...segments) {
    const filePath = path.join(__dirname, ...segments);
    if (!fs.existsSync(filePath)) return '';
    const ext = path.extname(filePath).slice(1).toLowerCase() || 'png';
    return `data:image/${ext};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDateLong(dateStr) {
    const date = new Date(`${dateStr}T00:00:00Z`);
    return date.toLocaleDateString('id-ID', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function cleanNumber(value) {
    if (value === null || value === undefined || value === '' || Number.isNaN(value)) return '-';
    const number = Number(value);
    if (!Number.isFinite(number)) return escapeHtml(value);
    return number.toFixed(1).replace(/\.0$/, '');
}

function roundedNumber(value) {
    if (value === null || value === undefined || value === '' || Number.isNaN(value)) return '-';
    const number = Number(value);
    if (!Number.isFinite(number)) return escapeHtml(value);
    return String(Math.round(number));
}

function metric(value, suffix = '') {
    const clean = cleanNumber(value);
    return clean === '-' ? clean : `${clean}${suffix}`;
}

function roundedMetric(value, suffix = '') {
    const clean = roundedNumber(value);
    return clean === '-' ? clean : `${clean}${suffix}`;
}

function formatWindDirectionFull(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return '-';

    const sector = raw.match(/^(N|NE|E|SE|S|SW|W|NW)\b/i)?.[1]?.toUpperCase();
    const sectorMap = {
        N: 'Utara',
        NE: 'Timur Laut',
        E: 'Timur',
        SE: 'Tenggara',
        S: 'Selatan',
        SW: 'Barat Daya',
        W: 'Barat',
        NW: 'Barat Laut'
    };
    if (sector && sectorMap[sector]) return sectorMap[sector];

    const degrees = Number(raw.match(/(\d+(?:\.\d+)?)\s*(?:deg|°)?/)?.[1]);
    if (Number.isFinite(degrees)) {
        const labels = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
        const index = Math.floor(((degrees + 22.5) % 360) / 45);
        return labels[index];
    }

    return escapeHtml(raw);
}

function svgIcon(type) {
    const icons = {
        temp: `
<svg viewBox="0 0 128 128" aria-hidden="true">
  <defs><linearGradient id="gTemp" x1="35" y1="16" x2="91" y2="114" gradientUnits="userSpaceOnUse"><stop stop-color="#ffd75b"/><stop offset="1" stop-color="#f04444"/></linearGradient></defs>
  <path d="M64 15c-15 0-27 12-27 27v33a39 39 0 1 0 54 0V42c0-15-12-27-27-27Z" fill="#fff4d4"/>
  <path d="M64 15c-15 0-27 12-27 27v33a39 39 0 1 0 54 0V42c0-15-12-27-27-27Z" fill="none" stroke="#09395f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M64 46v43" stroke="url(#gTemp)" stroke-width="15" stroke-linecap="round"/>
  <circle cx="64" cy="89" r="20" fill="url(#gTemp)"/>
</svg>`,
        rain: `
<svg viewBox="0 0 128 128" aria-hidden="true">
  <path d="M34 79h58a25 25 0 0 0 2-50 35 35 0 0 0-65 14 18 18 0 0 0 5 36Z" fill="#e6f9ff" stroke="#09395f" stroke-width="8" stroke-linejoin="round"/>
  <path d="M35 96l-7 14M64 94l-8 18M94 96l-7 14" stroke="#1a9edb" stroke-width="8" stroke-linecap="round"/>
</svg>`,
        visibility: `
<svg viewBox="0 0 128 128" aria-hidden="true">
  <path d="M13 66s21-35 51-35 51 35 51 35-21 35-51 35S13 66 13 66Z" fill="#eafaf1" stroke="#09395f" stroke-width="8" stroke-linejoin="round"/>
  <circle cx="64" cy="66" r="20" fill="#fff" stroke="#20a56d" stroke-width="8"/>
  <circle cx="64" cy="66" r="8" fill="#09395f"/>
  <path d="M28 27l14 14M100 27 86 41M64 17v20" stroke="#f0bb27" stroke-width="8" stroke-linecap="round"/>
</svg>`,
        humidity: `
<svg viewBox="0 0 128 128" aria-hidden="true">
  <path d="M64 11s35 40 35 68a35 35 0 0 1-70 0c0-28 35-68 35-68Z" fill="#dcf8ff" stroke="#09395f" stroke-width="8" stroke-linejoin="round"/>
  <path d="M49 80c4 12 14 18 26 18" stroke="#24a8e0" stroke-width="8" stroke-linecap="round"/>
</svg>`,
        wind: `
<svg viewBox="0 0 128 128" aria-hidden="true">
  <path d="M17 45h55c15 0 15-23 1-23-8 0-12 5-14 11" fill="none" stroke="#09395f" stroke-width="8" stroke-linecap="round"/>
  <path d="M16 68h86c18 0 18 28 0 28-11 0-16-7-18-14" fill="none" stroke="#15a6d9" stroke-width="8" stroke-linecap="round"/>
  <path d="M28 91h35" stroke="#09395f" stroke-width="8" stroke-linecap="round"/>
</svg>`
    };
    return icons[type] || '';
}

function buildMetricRows(summary) {
    const windDirection = formatWindDirectionFull(summary.wind?.dominant || summary.wind?.direction);
    const windSpeed = summary.wind?.maxKt ?? summary.wind?.maxSpeed;

    return [
        {
            type: 'temp',
            title: 'Suhu Udara',
            accent: 'orange',
            variant: 'temperature',
            values: [
                ['Maksimum', metric(summary.temperature?.max, '\u00B0C')],
                ['Minimum', metric(summary.temperature?.min, '\u00B0C')],
                ['Rata-rata', metric(summary.temperature?.avg, '\u00B0C')]
            ]
        },
        {
            type: 'rain',
            title: 'Curah Hujan',
            accent: 'cyan',
            value: metric(summary.rainfall?.total, 'mm'),
            meta: 'Akumulasi 24 jam'
        },
        {
            type: 'visibility',
            title: 'Jarak Pandang',
            accent: 'green',
            value: `${escapeHtml(summary.visibility?.rangeText || '-')}km`
        },
        {
            type: 'humidity',
            title: 'Kelembapan',
            accent: 'blue',
            value: `${metric(summary.humidity?.min, '%')} - ${metric(summary.humidity?.max, '%')}`,
            meta: 'Minimum - maksimum'
        },
        {
            type: 'wind',
            title: 'Angin Dominan',
            accent: 'yellow',
            value: windDirection === '-' ? roundedMetric(windSpeed, 'KT') : `${windDirection} / ${roundedMetric(windSpeed, 'KT')}`,
            meta: 'Arah / kecepatan maksimum'
        }
    ];
}

function renderCard(row) {
    if (row.variant === 'temperature') {
        return `
<article class="card temperature-card accent-${row.accent}">
  <div class="card-head">
    <div class="icon">${svgIcon(row.type)}</div>
    <div>
      <p>${row.title}</p>
      <h3>${row.values[0][1]}</h3>
    </div>
  </div>
  <div class="temp-grid">
    ${row.values.map(([label, value]) => `
    <div>
      <strong>${value}</strong>
      <span>${label}</span>
    </div>`).join('')}
  </div>
</article>`;
    }

    return `
<article class="card metric-card accent-${row.accent}">
  <div class="icon">${svgIcon(row.type)}</div>
  <div class="metric-copy">
    <p>${row.title}</p>
    <h3>${row.value}</h3>
    ${row.meta ? `<span>${row.meta}</span>` : ''}
  </div>
</article>`;
}

function buildHtml(summary) {
    const bmkgLogo = assetDataUri('DashboardNextJS', 'public', 'bmkg.png');
    const dateLabel = formatDateLong(summary.dateStr);
    const metricRows = buildMetricRows(summary);
    const weatherSummary = summary.weather?.narrative
        ? summary.weather.narrative
        : 'Data cuaca harian belum tersedia.';

    return `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body { width: ${OUTPUT_WIDTH}px; height: ${OUTPUT_HEIGHT}px; margin: 0; }
  body {
    font-family: Inter, "Segoe UI", Arial, Helvetica, sans-serif;
    color: #0b2238;
    background: #f5f1e8;
  }
  .poster {
    position: relative;
    width: ${DESIGN_WIDTH}px;
    height: ${DESIGN_HEIGHT}px;
    transform: scale(${OUTPUT_SCALE});
    transform-origin: top left;
    overflow: hidden;
    background:
      linear-gradient(180deg, #fffaf0 0%, #f5f1e8 53%, #e8edf0 100%);
  }
  .hero {
    position: relative;
    height: 650px;
    padding: 66px 132px 48px;
    color: #ffffff;
    overflow: hidden;
    background:
      radial-gradient(circle at 82% 18%, rgba(255,214,73,.42) 0 230px, transparent 236px),
      radial-gradient(circle at 12% 82%, rgba(86,151,165,.3) 0 230px, transparent 236px),
      linear-gradient(135deg, #183b58 0%, #b64e2e 52%, #e7a72d 100%);
  }
  .hero::before {
    content: "";
    position: absolute;
    right: -300px;
    top: -420px;
    width: 1050px;
    height: 1050px;
    border-radius: 999px;
    border: 70px solid rgba(255,255,255,.2);
    box-shadow: inset 0 0 0 78px rgba(89,38,28,.16);
  }
  .hero::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,255,255,.26) 4px, transparent 5px);
    background-size: 72px 72px;
    opacity: .38;
  }
  .hero-content {
    position: relative;
    z-index: 1;
    height: 100%;
    display: grid;
    grid-template-columns: 330px 1fr;
    gap: 76px;
    align-items: center;
  }
  .logo-panel {
    width: 310px;
    height: 310px;
    border-radius: 58px;
    background: rgba(255,255,255,.97);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 36px 80px rgba(4,44,82,.28);
  }
  .logo-panel img { width: 260px; height: 260px; object-fit: contain; display: block; }
  .logo-panel b { font-size: 64px; color: #a9422a; }
  .kicker {
    display: inline-flex;
    width: fit-content;
    height: 64px;
    padding: 0 38px;
    align-items: center;
    border-radius: 999px;
    background: rgba(255,255,255,.18);
    border: 2px solid rgba(255,255,255,.36);
    font-size: 30px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: 2px;
  }
  h1 {
    margin: 30px 0 24px;
    color: #ffd13d;
    font-size: 118px;
    line-height: .9;
    font-weight: 950;
    letter-spacing: 0;
    text-shadow: 0 14px 0 rgba(4,63,111,.28), 0 28px 52px rgba(4,44,82,.22);
  }
  .station {
    margin: 0;
    max-width: 1400px;
    color: #ffffff;
    font-size: 58px;
    line-height: 1.08;
    font-weight: 950;
    letter-spacing: 0;
  }
  .date-row { display: flex; align-items: center; margin-top: 44px; }
  .date-pill {
    display: inline-flex;
    height: 112px;
    min-width: 720px;
    padding: 0 50px;
    align-items: center;
    justify-content: center;
    border-radius: 28px;
    background: #ffffff;
    color: #a9422a;
    font-size: 56px;
    font-weight: 950;
    box-shadow: 0 18px 38px rgba(4,44,82,.18);
  }
  .content {
    position: relative;
    padding: 70px 132px 168px;
  }
  .summary-band {
    min-height: 224px;
    border-radius: 42px;
    background: #0b2238;
    color: #ffffff;
    display: flex;
    align-items: center;
    padding: 46px 62px;
    box-shadow: 0 30px 80px rgba(6,54,94,.18);
  }
  .summary-band p {
    margin: 0 0 14px;
    color: #f5cf63;
    font-size: 34px;
    font-weight: 900;
    letter-spacing: 1px;
  }
  .summary-band h2 {
    margin: 0;
    color: #ffffff;
    font-size: 68px;
    line-height: 1.08;
    font-weight: 950;
    letter-spacing: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-top: 38px;
  }
  .card {
    position: relative;
    min-height: 390px;
    border-radius: 38px;
    background: rgba(255,255,255,.98);
    border: 3px solid rgba(255,255,255,.95);
    box-shadow: 0 24px 70px rgba(6,54,94,.15);
    overflow: hidden;
  }
  .card::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 18px;
  }
  .accent-orange::before { background: #e8792f; }
  .accent-cyan::before { background: #3d9db5; }
  .accent-green::before { background: #7aa34f; }
  .accent-blue::before { background: #517fa3; }
  .accent-yellow::before { background: #f2b52c; }
  .temperature-card {
    grid-column: 1 / -1;
    min-height: 480px;
    padding: 58px 62px 64px;
  }
  .card-head {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 40px;
    align-items: center;
  }
  .icon {
    width: 150px;
    height: 150px;
    border-radius: 34px;
    background: #fff5e5;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
  }
  .icon svg { width: 100%; height: 100%; display: block; }
  .card p {
    margin: 0 0 14px;
    color: #486579;
    font-size: 40px;
    line-height: 1.1;
    font-weight: 900;
  }
  .card h3 {
    margin: 0;
    color: #071927;
    font-size: 96px;
    line-height: .95;
    font-weight: 950;
    letter-spacing: 0;
  }
  .temperature-card h3 { display: none; }
  .temp-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
    margin-top: 44px;
  }
  .temp-grid div {
    min-height: 164px;
    border-radius: 28px;
    background: #f3f9fd;
    border: 2px solid #d6ebf5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .temp-grid strong {
    color: #071927;
    font-size: 76px;
    line-height: 1;
    font-weight: 950;
  }
  .temp-grid span {
    margin-top: 14px;
    color: #5f7484;
    font-size: 30px;
    font-weight: 900;
  }
  .metric-card {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 40px;
    align-items: center;
    padding: 58px 56px 54px;
  }
  .metric-copy { min-width: 0; }
  .metric-card h3 {
    font-size: 76px;
    white-space: nowrap;
  }
  .metric-card span {
    display: block;
    margin-top: 20px;
    color: #5f7484;
    font-size: 32px;
    font-weight: 850;
    line-height: 1.12;
  }
  .accent-yellow h3 { font-size: 66px; }
  .footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 142px;
    background: #fffdf8;
    border-top: 12px solid #b64e2e;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: center;
    gap: 26px;
    padding: 0 126px;
    color: #a9422a;
    font-size: 38px;
    font-weight: 900;
    box-shadow: 0 -24px 58px rgba(3,43,78,.12);
  }
  .footer span {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    white-space: nowrap;
  }
  .footer svg {
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    fill: none;
    stroke: #6e9b57;
    stroke-width: 3.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
</head>
<body>
  <main class="poster">
    <section class="hero">
      <div class="hero-content">
        <div class="logo-panel">${bmkgLogo ? `<img src="${bmkgLogo}" alt="BMKG">` : '<b>BMKG</b>'}</div>
        <div>
          <h1>IKHTISAR<br>CUACA HARIAN</h1>
          <p class="station">Stasiun Meteorologi Pangsuma<br>Kapuas Hulu</p>
          <div class="date-row">
            <div class="date-pill">${escapeHtml(dateLabel)}</div>
          </div>
        </div>
      </div>
    </section>
    <section class="content">
      <section class="summary-band">
        <div>
          <p>RANGKUMAN CUACA</p>
          <h2>${escapeHtml(weatherSummary)}</h2>
        </div>
      </section>
      <section class="grid">
        ${metricRows.map(renderCard).join('')}
      </section>
    </section>
    <footer class="footer">
      <span>
        <svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L9 10.5a16 16 0 0 0 4.5 4.5l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2Z"/></svg>
        0857-8730-8413
      </span>
      <span>
        <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1 0l2.8-2.8a5 5 0 0 0-7.1-7.1L11 4.9"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.8 2.8a5 5 0 0 0 7.1 7.1L13 19.1"/></svg>
        stamet-pangsuma.bmkg.go.id
      </span>
      <span>
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>
        @bmkg_kapuashulu
      </span>
    </footer>
  </main>
</body>
</html>`;
}

async function generateIkhtisarImage(summary) {
    const outputPath = path.join(__dirname, `ikhtisar_ig_${Date.now()}.png`);

    await nodeHtmlToImage({
        output: outputPath,
        html: buildHtml(summary),
        puppeteerArgs: {
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--force-device-scale-factor=1',
                `--window-size=${OUTPUT_WIDTH},${OUTPUT_HEIGHT}`
            ]
        }
    });

    const buffer = fs.readFileSync(outputPath);
    fs.unlinkSync(outputPath);
    return buffer;
}

module.exports = { generateIkhtisarImage, OUTPUT_WIDTH, OUTPUT_HEIGHT };
