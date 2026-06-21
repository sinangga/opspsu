const axios = require('axios');
const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://bmkgsatu.bmkg.go.id';
const STATION_ID = 51;
const STATION_NAME = 'Stasiun Meteorologi Pangsuma';
const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const PARAMETERS = [
    'temp_drybulb_c_tttttt',
    'relative_humidity_pc',
    'rainfall_24h_rrrr',
    'wind_dir_deg_dd',
    'wind_speed_ff',
    'present_weather_ww'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (quoted && text[i + 1] === '"') {
                cell += '"';
                i++;
            } else {
                quoted = !quoted;
            }
        } else if (char === ',' && !quoted) {
            row.push(cell);
            cell = '';
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && text[i + 1] === '\n') i++;
            row.push(cell);
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }
    if (cell || row.length) {
        row.push(cell);
        if (row.some(value => value !== '')) rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows[0].map(header => header.replace(/^\uFEFF/, '').trim());
    return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function validRange(value, min, max) {
    const number = numberOrNull(value);
    return number !== null && number >= min && number <= max ? number : null;
}

function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthRange(year, month) {
    const lastDay = daysInMonth(year, month);
    return {
        from: `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`,
        to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59Z`
    };
}

async function login(username, password) {
    if (!username || !password) throw new Error('Kredensial BMKG Satu belum dikonfigurasi');
    const response = await axios.post(
        `${BASE_URL}/api/v21/user/session/login`,
        { username, password },
        { timeout: 15000 }
    );
    const token = response.data?.data?.token;
    if (!token) throw new Error('Token BMKG Satu tidak diterima');
    return token;
}

async function fetchMonthlyRows(year, month, username, password, onProgress = async () => {}) {
    const token = await login(username, password);
    const api = axios.create({
        baseURL: `${BASE_URL}/api/v21/`,
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000
    });
    const range = monthRange(year, month);
    await onProgress('Meminta data bulanan dari BMKG Satu');
    const request = await api.post('export/observation/by-station', {
        data_type: 'sinoptik',
        parameter_names: PARAMETERS,
        station_ids: [STATION_ID],
        date_from: range.from,
        date_to: range.to
    });
    const jobId = request.data?.data?.job_id;
    if (!jobId) throw new Error('Job ekspor BMKG Satu tidak terbentuk');

    let job;
    for (let attempt = 0; attempt < 30; attempt++) {
        await sleep(attempt === 0 ? 1000 : 2000);
        const status = await api.get(`export/observation/job/${jobId}`);
        job = status.data?.data;
        if (job?.status === 'successful') break;
        if (job?.status === 'failed') throw new Error('Proses data bulanan gagal di BMKG Satu');
    }
    if (job?.status !== 'successful' || !job.file_url) {
        throw new Error('Proses data bulanan melewati batas waktu');
    }

    await onProgress('Mengunduh dan memeriksa data pengamatan');
    const filename = job.file_url.split('/').pop();
    const tokenResponse = await api.get(`export/observation/download-token/${filename}`);
    const downloadToken = tokenResponse.data?.data?.token;
    if (!downloadToken) throw new Error('Token unduhan data tidak diterima');
    const csv = await axios.get(
        `${BASE_URL}/api/v21/export/public/download/${filename}?token=${encodeURIComponent(downloadToken)}`,
        { responseType: 'text', timeout: 60000 }
    );
    return parseCsv(csv.data);
}

function weatherCategory(code) {
    const value = numberOrNull(code);
    if (value === null) return null;
    if (value <= 3) return 'Cerah–Berawan';
    if (value <= 9) return 'Udara Kabur';
    if (value <= 19) return 'Kabut/Asap';
    if (value <= 29) return 'Hujan Sekitar';
    if (value <= 49) return 'Kabut';
    if (value <= 59) return 'Gerimis';
    if (value <= 69) return 'Hujan';
    if (value <= 79) return 'Presipitasi Lain';
    if (value <= 89) return 'Hujan Lokal';
    return 'Hujan Petir';
}

function windSector(degrees) {
    const labels = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
    return labels[Math.round((degrees % 360) / 45) % 8];
}

function formatDay(dateText) {
    const day = Number(dateText.slice(8, 10));
    return `${day} ${MONTHS[Number(dateText.slice(5, 7)) - 1]}`;
}

function summarizeMonthly(rows, year, month) {
    if (!rows.length) throw new Error('Data pada bulan tersebut tidak tersedia');
    const temps = [], humidities = [], winds = [];
    const sectors = new Map(), weather = new Map(), daily = new Map();
    let tempMax = null, tempMin = null, windMax = null;
    let lastTimestamp = null;

    for (const row of rows) {
        const timestamp = row.data_timestamp?.replace(' ', 'T');
        if (!timestamp) continue;
        if (!lastTimestamp || timestamp > lastTimestamp) lastTimestamp = timestamp;
        const date = timestamp.slice(0, 10);
        const hour = Number(timestamp.slice(11, 13));
        if (!daily.has(date)) daily.set(date, { temps: [], rainfall: null, trace: false });
        const day = daily.get(date);

        const temp = validRange(row.temp_drybulb_c_tttttt, -10, 50);
        if (temp !== null) {
            temps.push(temp);
            day.temps.push(temp);
            if (!tempMax || temp > tempMax.value) tempMax = { value: temp, date };
            if (!tempMin || temp < tempMin.value) tempMin = { value: temp, date };
        }

        const humidity = validRange(row.relative_humidity_pc, 0, 100);
        if (humidity !== null) humidities.push(humidity);

        const speed = validRange(row.wind_speed_ff, 0, 150);
        const direction = validRange(row.wind_dir_deg_dd, 0, 360);
        if (speed !== null) {
            winds.push(speed);
            if (!windMax || speed > windMax.value) windMax = { value: speed, date, direction };
            if (direction !== null && speed > 0) {
                const sector = windSector(direction);
                sectors.set(sector, (sectors.get(sector) || 0) + 1);
            }
        }

        const category = weatherCategory(row.present_weather_ww);
        if (category) weather.set(category, (weather.get(category) || 0) + 1);

        // rainfall_24h_rrrr is read once per day at 00 UTC (07 WIB).
        if (hour === 0) {
            const rainfall = numberOrNull(row.rainfall_24h_rrrr);
            if (rainfall === 8888) {
                day.rainfall = 0;
                day.trace = true;
            } else if (rainfall !== null && rainfall >= 0 && rainfall < 1000) {
                day.rainfall = rainfall;
            }
        }
    }

    if (!temps.length) throw new Error('Parameter suhu bulanan tidak tersedia');
    const dailyEntries = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b));
    const rainDays = dailyEntries.filter(([, day]) => day.trace || (day.rainfall !== null && day.rainfall >= 0.1));
    const traceDays = dailyEntries.filter(([, day]) => day.trace);
    const measuredRain = dailyEntries.filter(([, day]) => day.rainfall !== null && !day.trace);
    const totalRain = measuredRain.reduce((sum, [, day]) => sum + day.rainfall, 0);
    const maxRain = measuredRain.reduce((best, [date, day]) => !best || day.rainfall > best.value ? { value: day.rainfall, date } : best, null);
    const dominantWind = [...sectors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Tenang/bervariasi';
    const dominantWeather = [...weather.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Tidak tersedia';
    const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const now = new Date();
    const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;
    const expected = isCurrentMonth
        ? ((now.getUTCDate() - 1) * 24 + now.getUTCHours() + 1)
        : daysInMonth(year, month) * 24;
    const completeness = Math.min(100, rows.length / expected * 100);
    const activeDays = dailyEntries.filter(([, day]) => day.temps.length).length;
    const chartDays = Array.from({ length: daysInMonth(year, month) }, (_, index) => {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
        const day = daily.get(date);
        return {
            day: index + 1,
            rain: day?.rainfall ?? null,
            trace: day?.trace || false,
            temp: day?.temps?.length ? avg(day.temps) : null
        };
    });

    const highlights = [];
    if (maxRain && maxRain.value >= 50) highlights.push(`Hujan tertinggi ${maxRain.value.toFixed(1)} mm terjadi pada ${formatDay(maxRain.date)}.`);
    if (rainDays.length) highlights.push(`Hujan tercatat pada ${rainDays.length} hari, termasuk ${traceDays.length} hari hujan tidak terukur.`);
    if (windMax) highlights.push(`Angin terkuat mencapai ${windMax.value.toFixed(0)} knot pada ${formatDay(windMax.date)}.`);
    if (!highlights.length) highlights.push('Kondisi cuaca bulanan cenderung stabil berdasarkan pengamatan yang tersedia.');

    return {
        year, month, period: `${MONTHS[month - 1]} ${year}`,
        isCurrentMonth,
        dataThrough: lastTimestamp ? lastTimestamp.slice(0, 10) : null,
        station: STATION_NAME,
        observationCount: rows.length,
        activeDays,
        completeness,
        temperature: { average: avg(temps), maximum: tempMax, minimum: tempMin },
        humidity: { average: avg(humidities) },
        rainfall: { total: totalRain, rainyDays: rainDays.length, traceDays: traceDays.length, maximum: maxRain },
        wind: { dominant: dominantWind, maximum: windMax },
        dominantWeather,
        highlights: highlights.slice(0, 3),
        chartDays
    };
}

function rainChart(days) {
    const width = 930, height = 170, base = 145;
    const values = days.map(day => day.rain || 0);
    const max = Math.max(10, ...values);
    const barWidth = width / days.length;
    const bars = days.map((day, index) => {
        const value = day.rain || 0;
        const barHeight = value > 0 ? Math.max(3, value / max * 120) : day.trace ? 3 : 0;
        const x = index * barWidth + 4;
        return `<rect x="${x.toFixed(1)}" y="${(base - barHeight).toFixed(1)}" width="${Math.max(3, barWidth - 7).toFixed(1)}" height="${barHeight.toFixed(1)}" rx="2" fill="${day.trace ? '#38bdf8' : '#2563eb'}"/>`;
    }).join('');
    const labels = days.filter(day => day.day === 1 || day.day % 5 === 0 || day.day === days.length)
        .map(day => `<text x="${((day.day - 0.5) * barWidth).toFixed(1)}" y="165" text-anchor="middle" font-size="16" fill="#64748b">${day.day}</text>`).join('');
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="170"><line x1="0" y1="${base}" x2="${width}" y2="${base}" stroke="#cbd5e1"/>${bars}${labels}</svg>`;
}

function temperatureChart(days) {
    const width = 930, height = 150, min = 20, max = 36;
    const step = width / Math.max(1, days.length - 1);
    const points = days.map((day, index) => {
        if (day.temp === null) return null;
        const y = 125 - ((Math.max(min, Math.min(max, day.temp)) - min) / (max - min) * 100);
        return { x: index * step, y, value: day.temp };
    });
    const segments = [];
    let current = [];
    for (const point of points) {
        if (point) current.push(`${point.x.toFixed(1)},${point.y.toFixed(1)}`);
        else if (current.length) { segments.push(current); current = []; }
    }
    if (current.length) segments.push(current);
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="150">
        <line x1="0" y1="125" x2="${width}" y2="125" stroke="#cbd5e1"/>
        ${segments.map(segment => `<polyline points="${segment.join(' ')}" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
        ${points.filter(Boolean).map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5" fill="#ea580c"/>`).join('')}
    </svg>`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function renderInfographic(summary) {
    const logoPath = path.join(__dirname, 'DashboardNextJS', 'public', 'bmkg.png');
    const logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
    const rainMax = summary.rainfall.maximum;
    const tempMax = summary.temperature.maximum;
    const tempMin = summary.temperature.minimum;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        *{box-sizing:border-box} body{margin:0;width:1080px;height:1350px;font-family:Arial,sans-serif;background:#eaf4fb;color:#0f172a}
        .page{width:1080px;height:1350px;background:linear-gradient(180deg,#f8fcff,#e9f5ff);overflow:hidden}
        header{height:205px;padding:28px 48px;color:white;background:linear-gradient(125deg,#0b2d4d,#075985 58%,#0ea5e9);display:flex;align-items:center;gap:28px}
        header img{width:105px;height:105px;object-fit:contain;background:white;border-radius:50%;padding:8px}
        h1{font-size:48px;margin:0 0 8px;letter-spacing:1px}.subtitle{font-size:25px;opacity:.92}.source{font-size:17px;margin-top:10px;opacity:.75}
        main{padding:28px 42px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card{background:white;border-radius:20px;padding:20px;box-shadow:0 8px 24px rgba(15,60,90,.09);border:1px solid #dbeafe}
        .metric{min-height:150px}.label{font-size:18px;color:#475569;font-weight:700}.value{font-size:36px;font-weight:800;margin:10px 0 5px;color:#075985}.detail{font-size:16px;color:#64748b;line-height:1.35}
        .wide{grid-column:span 2}.charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.chart{height:260px}.chart h2,.highlights h2{font-size:22px;margin:0 0 3px}.chart small{color:#64748b}
        .highlights{margin-top:18px;padding:22px 28px}.highlights ul{margin:10px 0 0;padding-left:24px}.highlights li{font-size:19px;line-height:1.45;margin:4px 0}
        footer{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:0 8px;color:#64748b;font-size:15px}.badge{background:#dcfce7;color:#166534;border-radius:99px;padding:8px 14px;font-weight:700}
        .trace{font-size:14px;color:#0369a1;margin-top:7px}
    </style></head><body><div class="page">
        <header>${logo ? `<img src="data:image/png;base64,${logo}">` : ''}<div><h1>KALEIDOSKOP CUACA</h1><div class="subtitle">Pangsuma • ${escapeHtml(summary.period)}${summary.isCurrentMonth && summary.dataThrough ? ` • data s.d. ${formatDay(summary.dataThrough)}` : ''}</div><div class="source">Hasil pengolahan data pengamatan Sinoptik BMKG Satu</div></div></header>
        <main>
            <section class="grid">
                <div class="card metric"><div class="label">🌡️ Suhu Rata-rata</div><div class="value">${summary.temperature.average.toFixed(1)}°C</div><div class="detail">${tempMin.value.toFixed(1)}°C – ${tempMax.value.toFixed(1)}°C</div></div>
                <div class="card metric"><div class="label">🔥 Suhu Tertinggi</div><div class="value">${tempMax.value.toFixed(1)}°C</div><div class="detail">${formatDay(tempMax.date)}</div></div>
                <div class="card metric"><div class="label">🌧️ Total Curah Hujan</div><div class="value">${summary.rainfall.total.toFixed(1)} mm</div><div class="detail">${summary.rainfall.rainyDays} hari hujan</div><div class="trace">${summary.rainfall.traceDays} hari hujan tidak terukur (&lt;0,1 mm)</div></div>
                <div class="card metric"><div class="label">☔ Hujan Tertinggi</div><div class="value">${rainMax ? `${rainMax.value.toFixed(1)} mm` : '–'}</div><div class="detail">${rainMax ? formatDay(rainMax.date) : 'Tidak tersedia'}</div></div>
                <div class="card metric"><div class="label">💧 Kelembapan Rata-rata</div><div class="value">${summary.humidity.average?.toFixed(0) || '–'}%</div><div class="detail">Kondisi udara bulanan</div></div>
                <div class="card metric"><div class="label">🧭 Angin Dominan</div><div class="value" style="font-size:30px">${escapeHtml(summary.wind.dominant)}</div><div class="detail">Berdasarkan frekuensi arah angin</div></div>
                <div class="card metric"><div class="label">💨 Angin Terkuat</div><div class="value">${summary.wind.maximum?.value.toFixed(0) || '–'} kt</div><div class="detail">${summary.wind.maximum ? formatDay(summary.wind.maximum.date) : 'Tidak tersedia'}</div></div>
                <div class="card metric"><div class="label">⛅ Cuaca Dominan</div><div class="value" style="font-size:27px">${escapeHtml(summary.dominantWeather)}</div><div class="detail">Kondisi yang paling sering tercatat</div></div>
            </section>
            <section class="charts">
                <div class="card chart"><h2>Curah Hujan Harian</h2><small>milimeter per hari</small>${rainChart(summary.chartDays)}</div>
                <div class="card chart"><h2>Suhu Rata-rata Harian</h2><small>derajat Celsius</small>${temperatureChart(summary.chartDays)}</div>
            </section>
            <section class="card highlights"><h2>Catatan Cuaca Bulan Ini</h2><ul>${summary.highlights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
            <footer><span>${escapeHtml(summary.station)} • Informasi cuaca untuk masyarakat</span><span class="badge">Kelengkapan data ${summary.completeness.toFixed(0)}%</span></footer>
        </main>
    </div></body></html>`;

    const output = path.join(__dirname, `kaleidoskop_${summary.year}_${String(summary.month).padStart(2, '0')}_${Date.now()}.png`);
    await nodeHtmlToImage({
        output,
        html,
        puppeteerArgs: {
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1080,1350']
        }
    });
    const buffer = fs.readFileSync(output);
    fs.unlinkSync(output);
    return buffer;
}

async function generateMonthlyKaleidoscope(year, month, username, password, onProgress) {
    const rows = await fetchMonthlyRows(year, month, username, password, onProgress);
    const summary = summarizeMonthly(rows, year, month);
    await onProgress('Menyusun infografis kaleidoskop');
    const image = await renderInfographic(summary);
    return { image, summary };
}

module.exports = {
    MONTHS,
    parseCsv,
    summarizeMonthly,
    generateMonthlyKaleidoscope
};
