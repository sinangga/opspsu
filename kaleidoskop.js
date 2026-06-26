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
    'temp_min_c_tntntn',
    'temp_max_c_txtxtx',
    'relative_humidity_pc',
    'visibility_vv',
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

function normalizeFieldName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function fieldValue(row, names) {
    for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
    }
    const normalized = new Map(Object.keys(row).map(key => [normalizeFieldName(key), row[key]]));
    for (const name of names) {
        const value = normalized.get(normalizeFieldName(name));
        if (value !== undefined) return value;
    }
    return undefined;
}

function validRange(value, min, max) {
    const number = numberOrNull(value);
    return number !== null && number >= min && number <= max ? number : null;
}

function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthRange(year, month) {
    const nextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    return {
        from: `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`,
        to: nextMonth.toISOString().replace('.000', '')
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
    return {
        rows: parseCsv(csv.data)
    };
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

function windSectorIndex(degrees) {
    return Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
}

function formatDay(dateText) {
    const day = Number(dateText.slice(8, 10));
    return `${day} ${MONTHS[Number(dateText.slice(5, 7)) - 1]}`;
}

function formatDayShort(dateText) {
    return String(Number(dateText.slice(8, 10)));
}

function shiftDate(dateText, offsetDays) {
    const date = new Date(`${dateText}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

function isDateInMonth(dateText, year, month) {
    return dateText.startsWith(`${year}-${String(month).padStart(2, '0')}-`);
}

function ensureDaily(daily, date) {
    if (!daily.has(date)) {
        daily.set(date, {
            temps: [],
            rainfall: null,
            trace: false,
            tempMin: null,
            tempMax: null,
            visibilities: []
        });
    }
    return daily.get(date);
}

function firstValidRange(row, keys, min, max) {
    for (const key of keys) {
        const value = validRange(fieldValue(row, [key]), min, max);
        if (value !== null) return value;
    }
    return null;
}

function formatVisibility(value) {
    if (value === null || value === undefined) return '–';
    if (value <= 100) return `${value.toFixed(value >= 10 ? 0 : 1)} km`;
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
    return `${value.toFixed(0)} m`;
}

function rainfallCategory(value) {
    if (value === null || value === undefined) return null;
    if (value >= 0.5 && value < 20) return 'Hujan ringan';
    if (value >= 20 && value < 50) return 'Hujan sedang';
    if (value >= 50 && value < 100) return 'Hujan lebat';
    if (value >= 100 && value < 150) return 'Hujan sangat lebat';
    if (value >= 150) return 'Hujan ekstrem';
    return null;
}

function summarizeMonthly(rows, year, month) {
    if (!rows.length) throw new Error('Data pada bulan tersebut tidak tersedia');
    const temps = [], humidities = [], winds = [], visibilities = [];
    const sectors = new Map(), weather = new Map(), daily = new Map();
    const visibilityFrequency = new Map();
    const windRoseBins = Array.from({ length: 8 }, () => [0, 0, 0, 0]);
    let tempMax = null, tempMin = null, windMax = null, visibilityMin = null, humidityMin = null;
    let lastTimestamp = null;
    let lastTargetTimestamp = null;
    let observationCount = 0;

    for (const row of rows) {
        const timestamp = fieldValue(row, ['data_timestamp', 'Data Timestamp'])?.replace(' ', 'T');
        if (!timestamp) continue;
        if (!lastTimestamp || timestamp > lastTimestamp) lastTimestamp = timestamp;
        const date = timestamp.slice(0, 10);
        const hour = Number(timestamp.slice(11, 13));
        const inTargetMonth = isDateInMonth(date, year, month);

        // In synoptic data, minimum temperature reported at 00 UTC belongs to the previous day.
        const minimumTemp = firstValidRange(row, [
            'temp_min_c_tntntn',
            'Temp Min C Tntntn',
            'temp_min_c_tn',
            'temp_minimum_c_tn',
            'temperature_min_c_tn',
            'temperature_minimum_c_tn'
        ], -10, 50);
        if (hour === 0 && minimumTemp !== null) {
            const targetDate = shiftDate(date, -1);
            if (isDateInMonth(targetDate, year, month)) {
                const targetDay = ensureDaily(daily, targetDate);
                targetDay.tempMin = minimumTemp;
                if (!tempMin || minimumTemp < tempMin.value) tempMin = { value: minimumTemp, date: targetDate };
            }
        }

        // rainfall_24h_rrrr reported at 00 UTC is the previous day's total rainfall.
        if (hour === 0) {
            const targetDate = shiftDate(date, -1);
            if (isDateInMonth(targetDate, year, month)) {
                const targetDay = ensureDaily(daily, targetDate);
                const rainfall = numberOrNull(fieldValue(row, ['rainfall_24h_rrrr', 'Rainfall 24h Rrrr']));
                if (rainfall === 8888) {
                    targetDay.rainfall = 0;
                    targetDay.trace = true;
                } else if (rainfall !== null && rainfall >= 0 && rainfall < 1000) {
                    targetDay.rainfall = rainfall;
                }
            }
        }

        if (!inTargetMonth) continue;
        observationCount++;
        if (!lastTargetTimestamp || timestamp > lastTargetTimestamp) lastTargetTimestamp = timestamp;

        const day = ensureDaily(daily, date);

        const temp = validRange(fieldValue(row, ['temp_drybulb_c_tttttt', 'Temp Drybulb C Tttttt']), -10, 50);
        if (temp !== null) {
            temps.push(temp);
            day.temps.push(temp);
        }

        // Maximum temperature reported at 12 UTC belongs to the same day.
        const maximumTemp = firstValidRange(row, [
            'temp_max_c_txtxtx',
            'Temp Max C Txtxtx',
            'temp_max_c_tx',
            'temp_maximum_c_tx',
            'temperature_max_c_tx',
            'temperature_maximum_c_tx'
        ], -10, 50);
        if (hour === 12 && maximumTemp !== null) {
            day.tempMax = maximumTemp;
            if (!tempMax || maximumTemp > tempMax.value) tempMax = { value: maximumTemp, date };
        }

        const humidity = validRange(fieldValue(row, ['relative_humidity_pc', 'Relative Humidity Pc']), 0, 100);
        if (humidity !== null) {
            humidities.push(humidity);
            if (!humidityMin || humidity < humidityMin.value) humidityMin = { value: humidity, date };
        }

        const visibility = validRange(fieldValue(row, ['visibility_vv', 'Visibility Vv']), 0, 100000);
        if (visibility !== null) {
            visibilities.push(visibility);
            day.visibilities.push(visibility);
            const visibilityKey = String(visibility);
            visibilityFrequency.set(visibilityKey, (visibilityFrequency.get(visibilityKey) || 0) + 1);
            if (!visibilityMin || visibility < visibilityMin.value) visibilityMin = { value: visibility, date };
        }

        const speed = validRange(fieldValue(row, ['wind_speed_ff', 'Wind Speed Ff']), 0, 150);
        const direction = validRange(fieldValue(row, ['wind_dir_deg_dd', 'Wind Dir Deg Dd']), 0, 360);
        if (speed !== null) {
            winds.push(speed);
            if (!windMax || speed > windMax.value) windMax = { value: speed, date, direction };
            if (direction !== null && speed > 0) {
                const sector = windSector(direction);
                sectors.set(sector, (sectors.get(sector) || 0) + 1);
                const speedBin = speed < 2 ? 0 : speed < 5 ? 1 : speed < 8 ? 2 : 3;
                windRoseBins[windSectorIndex(direction)][speedBin]++;
            }
        }

        const category = weatherCategory(fieldValue(row, ['present_weather_ww', 'Present Weather Ww']));
        if (category) weather.set(category, (weather.get(category) || 0) + 1);
    }

    if (!temps.length) throw new Error('Parameter suhu bulanan tidak tersedia');
    if (!tempMin || !tempMax) {
        for (const [date, day] of daily.entries()) {
            if (!isDateInMonth(date, year, month) || !day.temps.length) continue;
            const fallbackMin = Math.min(...day.temps);
            const fallbackMax = Math.max(...day.temps);
            if (!tempMin || fallbackMin < tempMin.value) tempMin = { value: fallbackMin, date };
            if (!tempMax || fallbackMax > tempMax.value) tempMax = { value: fallbackMax, date };
        }
    }
    const dailyEntries = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b));
    const rainDays = dailyEntries.filter(([, day]) => day.trace || (day.rainfall !== null && day.rainfall >= 0.1));
    const traceDays = dailyEntries.filter(([, day]) => day.trace);
    const measuredRain = dailyEntries.filter(([, day]) => day.rainfall !== null && !day.trace);
    const totalRain = measuredRain.reduce((sum, [, day]) => sum + day.rainfall, 0);
    const maxRain = measuredRain.reduce((best, [date, day]) => !best || day.rainfall > best.value ? { value: day.rainfall, date } : best, null);
    const rainfallEvents = {
        'Hujan ringan': [],
        'Hujan sedang': [],
        'Hujan lebat': [],
        'Hujan sangat lebat': [],
        'Hujan ekstrem': []
    };
    for (const [date, day] of measuredRain) {
        const category = rainfallCategory(day.rainfall);
        if (category) rainfallEvents[category].push(date);
    }
    const dominantWind = [...sectors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Tenang/bervariasi';
    const dominantVisibility = [...visibilityFrequency.entries()]
        .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0];
    const dominantWeather = [...weather.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Tidak tersedia';
    const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const now = new Date();
    const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;
    const expected = isCurrentMonth
        ? ((now.getUTCDate() - 1) * 24 + now.getUTCHours() + 1)
        : daysInMonth(year, month) * 24;
    const completeness = Math.min(100, observationCount / expected * 100);
    const activeDays = dailyEntries.filter(([, day]) => day.temps.length).length;
    const chartDays = Array.from({ length: daysInMonth(year, month) }, (_, index) => {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
        const day = daily.get(date);
        return {
            day: index + 1,
            rain: day?.rainfall ?? null,
            trace: day?.trace || false,
            temp: day?.temps?.length ? avg(day.temps) : null,
            visibility: day?.visibilities?.length ? Math.min(...day.visibilities) : null
        };
    });

    const highlights = [];
    if (maxRain && maxRain.value >= 50) highlights.push(`Hujan tertinggi ${maxRain.value.toFixed(1)} mm terjadi pada ${formatDay(maxRain.date)}.`);
    if (rainDays.length) highlights.push(`Hujan tercatat pada ${rainDays.length} hari, termasuk ${traceDays.length} hari hujan tidak terukur.`);
    if (visibilityMin) highlights.push(`Jarak pandang terendah tercatat ${formatVisibility(visibilityMin.value)} pada ${formatDay(visibilityMin.date)}.`);
    if (windMax) highlights.push(`Angin terkuat mencapai ${windMax.value.toFixed(0)} knot pada ${formatDay(windMax.date)}.`);
    if (!highlights.length) highlights.push('Kondisi cuaca bulanan cenderung stabil berdasarkan pengamatan yang tersedia.');

    return {
        year, month, period: `${MONTHS[month - 1]} ${year}`,
        isCurrentMonth,
        dataThrough: lastTargetTimestamp ? lastTargetTimestamp.slice(0, 10) : lastTimestamp?.slice(0, 10) || null,
        station: STATION_NAME,
        observationCount,
        activeDays,
        completeness,
        temperature: { average: avg(temps), maximum: tempMax, minimum: tempMin },
        humidity: { average: avg(humidities), minimum: humidityMin },
        visibility: {
            average: avg(visibilities),
            dominant: dominantVisibility ? Number(dominantVisibility[0]) : null,
            dominantCount: dominantVisibility ? dominantVisibility[1] : 0,
            minimum: visibilityMin
        },
        rainfall: { total: totalRain, rainyDays: rainDays.length, traceDays: traceDays.length, maximum: maxRain, events: rainfallEvents },
        wind: {
            dominant: dominantWind,
            maximum: windMax,
            rose: {
                bins: windRoseBins,
                total: windRoseBins.flat().reduce((sum, value) => sum + value, 0)
            }
        },
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

function polarPoint(cx, cy, radius, degrees) {
    const radians = (degrees - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function sectorPath(cx, cy, innerRadius, outerRadius, startDegrees, endDegrees) {
    const outerStart = polarPoint(cx, cy, outerRadius, startDegrees);
    const outerEnd = polarPoint(cx, cy, outerRadius, endDegrees);
    const innerEnd = polarPoint(cx, cy, innerRadius, endDegrees);
    const innerStart = polarPoint(cx, cy, innerRadius, startDegrees);
    return [
        `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
        `A ${outerRadius.toFixed(2)} ${outerRadius.toFixed(2)} 0 0 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
        `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
        innerRadius > 0
            ? `A ${innerRadius.toFixed(2)} ${innerRadius.toFixed(2)} 0 0 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`
            : `L ${cx} ${cy}`,
        'Z'
    ].join(' ');
}

function windRoseChart(rose) {
    const width = 470, height = 178, cx = 92, cy = 91, maxRadius = 68;
    const colors = ['#bae6fd', '#38bdf8', '#0284c7', '#075985'];
    const labels = ['< 2 kt', '2–4 kt', '5–7 kt', '≥ 8 kt'];
    const compass = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
    const totals = rose.bins.map(bins => bins.reduce((sum, value) => sum + value, 0));
    const maxPercent = Math.max(1, ...totals.map(total => total / Math.max(1, rose.total) * 100));
    const roundedScale = Math.max(5, Math.ceil(maxPercent / 5) * 5);
    const rings = [0.25, 0.5, 0.75, 1].map(fraction => {
        const radius = maxRadius * fraction;
        const value = roundedScale * fraction;
        return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#cbd5e1" stroke-width="1"/>
            <text x="${cx + 4}" y="${cy - radius + 12}" font-size="11" fill="#94a3b8">${value.toFixed(value % 1 ? 1 : 0)}%</text>`;
    }).join('');
    const axes = Array.from({ length: 8 }, (_, index) => {
        const point = polarPoint(cx, cy, maxRadius, index * 45);
        const labelPoint = polarPoint(cx, cy, maxRadius + 13, index * 45);
        return `<line x1="${cx}" y1="${cy}" x2="${point.x.toFixed(1)}" y2="${point.y.toFixed(1)}" stroke="#e2e8f0"/>
            <text x="${labelPoint.x.toFixed(1)}" y="${(labelPoint.y + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#475569">${compass[index]}</text>`;
    }).join('');
    const bars = rose.bins.map((bins, sectorIndex) => {
        let cumulative = 0;
        return bins.map((count, binIndex) => {
            if (!count) return '';
            const inner = cumulative / Math.max(1, rose.total) * 100 / roundedScale * maxRadius;
            cumulative += count;
            const outer = cumulative / Math.max(1, rose.total) * 100 / roundedScale * maxRadius;
            const centerAngle = sectorIndex * 45;
            return `<path d="${sectorPath(cx, cy, inner, outer, centerAngle - 18, centerAngle + 18)}" fill="${colors[binIndex]}" stroke="white" stroke-width="1.5"/>`;
        }).join('');
    }).join('');
    const legend = labels.map((label, index) => `
        <g transform="translate(205 ${43 + index * 28})">
            <rect width="20" height="14" rx="3" fill="${colors[index]}"/>
            <text x="29" y="12" font-size="14" fill="#334155">${label}</text>
        </g>`).join('');
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="178">${rings}${axes}${bars}
        <text x="198" y="22" font-size="14" font-weight="700" fill="#475569">Kelas Kecepatan</text>${legend}
        <text x="355" y="61" font-size="12" fill="#64748b">Frekuensi</text>
        <text x="355" y="90" font-size="27" font-weight="800" fill="#075985">${rose.total}</text>
        <text x="355" y="110" font-size="12" fill="#64748b">data valid</text>
    </svg>`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function rainEventList(events) {
    const rows = Object.entries(events).map(([label, dates]) => {
        const dateText = dates.length ? dates.map(formatDayShort).join(', ') : '–';
        return `<div class="rain-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(dateText)}</strong></div>`;
    }).join('');
    return `<div class="rain-events">${rows}</div>`;
}

async function renderInfographic(summary) {
    const logoPath = path.join(__dirname, 'DashboardNextJS', 'public', 'bmkg.png');
    const logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
    const rainMax = summary.rainfall.maximum;
    const tempMax = summary.temperature.maximum;
    const tempMin = summary.temperature.minimum;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        *{box-sizing:border-box} body{margin:0;width:1080px;height:1270px;font-family:Arial,sans-serif;background:#eaf4fb;color:#0f172a}
        .page{position:relative;width:1080px;height:1270px;background:linear-gradient(180deg,#f8fcff,#e9f5ff);overflow:hidden}
        header{position:relative;height:178px;padding:21px 48px;color:white;background:linear-gradient(90deg,#082f49 0%,#075985 42%,#0ea5e9 76%,#38bdf8 100%);display:flex;align-items:center;justify-content:space-between;gap:25px;overflow:hidden}
        header:before{content:"";position:absolute;width:470px;height:470px;border:2px solid rgba(255,255,255,.12);border-radius:50%;right:-155px;top:-210px;box-shadow:0 0 0 45px rgba(255,255,255,.035),0 0 0 100px rgba(255,255,255,.025)}
        header:after{content:"";position:absolute;left:0;right:0;bottom:0;height:5px;background:linear-gradient(90deg,#22c55e 0 30%,#facc15 30% 39%,#38bdf8 39% 100%)}
        .header-copy{position:relative;z-index:2;min-width:0;flex:1}.header-brand{position:relative;z-index:2;width:180px;height:145px;display:flex;align-items:center;justify-content:center}
        .brand-logo{width:100px;height:118px;object-fit:contain;object-position:center;filter:drop-shadow(0 7px 12px rgba(0,0,0,.22))}
        .eyebrow{display:inline-flex;align-items:center;gap:9px;margin-bottom:6px;font-size:13px;font-weight:800;letter-spacing:2.1px;color:#bae6fd}.eyebrow:before{content:"";width:34px;height:3px;border-radius:5px;background:#38bdf8}
        h1{font-size:42px;margin:0 0 5px;letter-spacing:1px}.subtitle{font-size:23px;opacity:.95}.source{font-size:15px;margin-top:7px;color:#dbeafe}
        main{padding:16px 42px 106px}.group-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.card{position:relative;background:linear-gradient(145deg,#ffffff 0%,#f8fbff 100%);border-radius:17px;padding:14px;box-shadow:0 16px 30px rgba(15,60,90,.13),0 5px 10px rgba(15,60,90,.08),inset 0 1px 0 rgba(255,255,255,.9);border:1px solid #d7eafe}
        .card:before{content:"";position:absolute;inset:1px 1px auto 1px;height:34%;border-radius:16px 16px 0 0;background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,0));pointer-events:none}
        .card>*{position:relative;z-index:1}
        .group{min-height:144px;padding:12px 15px}.section-title,.group h2,.chart h2,.highlights h2,.rain-class h2{margin:0 0 9px;font-size:20px;font-weight:800;line-height:1.15;color:#020617;letter-spacing:0}.group h2{display:flex;align-items:center;gap:7px}.group h2 span{font:inherit;color:inherit;text-transform:none}
        .group-2{grid-column:span 2}.metric-list{display:grid;grid-template-columns:1fr 1fr;gap:8px}.metric-list.single{grid-template-columns:1fr}.mini{position:relative;min-height:70px;border-radius:13px;padding:9px 12px;background:linear-gradient(145deg,#ffffff,#f1f7ff);border:1px solid #dbeafe;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 5px 10px rgba(15,60,90,.06)}
        .label{font-size:13px;line-height:1.15;color:#334155;font-weight:700}.value{font-size:26px;line-height:1.05;font-weight:800;margin:5px 0 3px;color:#075985;letter-spacing:.1px}.detail{font-size:12px;font-weight:400;color:#64748b;line-height:1.25}
        .wide{grid-column:span 2}.charts{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.chart{height:245px}.chart small,.rain-class small{display:block;margin-top:-5px;margin-bottom:8px;font-size:12px;font-weight:400;line-height:1.25;color:#64748b}
        .bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:8px}.highlights,.rain-class{padding:12px 24px}.highlights ul{margin:5px 0 0;padding-left:20px}.highlights li{font-size:15px;line-height:1.2;margin:1px 0}
        .rain-events{margin-top:7px;display:grid;gap:5px}.rain-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:6px 10px;border-radius:10px;background:#eff6ff;font-size:13px;font-weight:400;color:#475569;line-height:1.2}.rain-row strong{max-width:240px;text-align:right;color:#075985;font-size:13px;font-weight:800}
        .lower-third{position:absolute;left:0;right:0;bottom:0;height:82px;color:white;background:linear-gradient(100deg,#082f49 0%,#075985 62%,#0284c7 62%,#0ea5e9 100%);display:flex;align-items:center;justify-content:space-between;padding:0 46px;box-shadow:0 -8px 25px rgba(8,47,73,.16)}
        .lower-third:before{content:"";position:absolute;top:0;left:0;width:100%;height:5px;background:linear-gradient(90deg,#22c55e 0 33%,#facc15 33% 44%,#38bdf8 44% 100%)}
        .lt-identity{display:flex;align-items:center;gap:15px}.lt-mark{width:7px;height:44px;border-radius:8px;background:#38bdf8}.lt-title{font-size:20px;font-weight:800;letter-spacing:.3px}.lt-subtitle{margin-top:4px;font-size:14px;color:#bae6fd}
        .lt-meta{text-align:right}.lt-period{font-size:17px;font-weight:800}.lt-status{display:inline-block;margin-top:6px;padding:5px 12px;border-radius:99px;background:rgba(220,252,231,.95);color:#166534;font-size:13px;font-weight:800}
        .trace{font-size:11px;color:#0369a1;margin-top:3px}
    </style></head><body><div class="page">
        <header>
            <div class="header-copy"><div class="eyebrow">INFORMASI CUACA TERAMATI</div><h1>KALEIDOSKOP CUACA</h1><div class="subtitle">Pangsuma • ${escapeHtml(summary.period)}${summary.isCurrentMonth && summary.dataThrough ? ` • data s.d. ${formatDay(summary.dataThrough)}` : ''}</div><div class="source">Diolah dari pengamatan Sinoptik BMKG Satu</div></div>
            <div class="header-brand">${logo ? `<img class="brand-logo" src="data:image/png;base64,${logo}">` : ''}</div>
        </header>
        <main>
            <section class="group-grid">
                <div class="card group group-2">
                    <h2>🌡️ <span>Suhu</span></h2>
                    <div class="metric-list">
                        <div class="mini"><div class="label">Rata-rata</div><div class="value">${summary.temperature.average.toFixed(1)}°C</div><div class="detail">${tempMin.value.toFixed(1)}°C – ${tempMax.value.toFixed(1)}°C</div></div>
                        <div class="mini"><div class="label">Tertinggi</div><div class="value">${tempMax.value.toFixed(1)}°C</div><div class="detail">${formatDay(tempMax.date)}</div></div>
                    </div>
                </div>
                <div class="card group group-2">
                    <h2>🌧️ <span>Hujan</span></h2>
                    <div class="metric-list">
                        <div class="mini"><div class="label">Total Bulanan</div><div class="value">${summary.rainfall.total.toFixed(1)} mm</div><div class="detail">${summary.rainfall.rainyDays} hari hujan</div></div>
                        <div class="mini"><div class="label">Harian Tertinggi</div><div class="value">${rainMax ? `${rainMax.value.toFixed(1)} mm` : '–'}</div><div class="detail">${rainMax ? formatDay(rainMax.date) : 'Tidak tersedia'}</div></div>
                    </div>
                </div>
                <div class="card group group-2">
                    <h2>💨 <span>Angin</span></h2>
                    <div class="metric-list">
                        <div class="mini"><div class="label">Dominan</div><div class="value">${escapeHtml(summary.wind.dominant)}</div><div class="detail">Berdasarkan frekuensi arah</div></div>
                        <div class="mini"><div class="label">Terkuat</div><div class="value">${summary.wind.maximum?.value.toFixed(0) || '–'} kt</div><div class="detail">${summary.wind.maximum ? formatDay(summary.wind.maximum.date) : 'Tidak tersedia'}</div></div>
                    </div>
                </div>
                <div class="card group group-2">
                    <h2>🌫️ <span>Jarak Pandang</span></h2>
                    <div class="metric-list">
                        <div class="mini"><div class="label">Dominan</div><div class="value">${formatVisibility(summary.visibility.dominant)}</div><div class="detail">${summary.visibility.dominantCount} kali tercatat</div></div>
                        <div class="mini"><div class="label">Terendah</div><div class="value">${formatVisibility(summary.visibility.minimum?.value)}</div><div class="detail">${summary.visibility.minimum ? formatDay(summary.visibility.minimum.date) : 'Tidak tersedia'}</div></div>
                    </div>
                </div>
                <div class="card group group-2">
                    <h2>💧 <span>Kelembapan</span></h2>
                    <div class="metric-list">
                        <div class="mini"><div class="label">Rata-rata</div><div class="value">${summary.humidity.average?.toFixed(0) || '–'}%</div><div class="detail">Kondisi udara bulanan</div></div>
                        <div class="mini"><div class="label">Minimum</div><div class="value">${summary.humidity.minimum?.value.toFixed(0) || '–'}%</div><div class="detail">${summary.humidity.minimum ? formatDay(summary.humidity.minimum.date) : 'Tidak tersedia'}</div></div>
                    </div>
                </div>
                <div class="card group group-2">
                    <h2>⛅ <span>Cuaca</span></h2>
                    <div class="metric-list single"><div class="mini"><div class="label">Dominan</div><div class="value">${escapeHtml(summary.dominantWeather)}</div><div class="detail">Kondisi yang paling sering tercatat</div></div></div>
                </div>
            </section>
            <section class="charts">
                <div class="card chart"><h2>Curah Hujan Harian</h2><small>milimeter per hari</small>${rainChart(summary.chartDays)}</div>
                <div class="card chart"><h2>Windrose Bulanan</h2><small>frekuensi arah dan kelas kecepatan angin</small>${windRoseChart(summary.wind.rose)}</div>
            </section>
            <section class="bottom-grid">
                <div class="card rain-class"><h2>Kejadian Hujan per Kriteria</h2><small>tanggal kejadian berdasarkan curah hujan harian BMKG</small>${rainEventList(summary.rainfall.events)}</div>
                <div class="card highlights"><h2>Catatan Cuaca Bulan Ini</h2><ul>${summary.highlights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
            </section>
        </main>
        <section class="lower-third">
            <div class="lt-identity"><span class="lt-mark"></span><div><div class="lt-title">STASIUN METEOROLOGI PANGSUMA</div><div class="lt-subtitle">Informasi cuaca teramati untuk masyarakat • Badan Meteorologi, Klimatologi, dan Geofisika</div></div></div>
            <div class="lt-meta"><div class="lt-period">${escapeHtml(summary.period)}</div><div class="lt-status">Kelengkapan ${summary.completeness.toFixed(0)}%</div></div>
        </section>
    </div></body></html>`;

    const output = path.join(__dirname, `kaleidoskop_${summary.year}_${String(summary.month).padStart(2, '0')}_${Date.now()}.png`);
    await nodeHtmlToImage({
        output,
        html,
        puppeteerArgs: {
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1080,1270']
        }
    });
    const buffer = fs.readFileSync(output);
    fs.unlinkSync(output);
    return buffer;
}

async function generateMonthlyKaleidoscope(year, month, username, password, onProgress) {
    const data = await fetchMonthlyRows(year, month, username, password, onProgress);
    const rows = data.rows;
    const summary = summarizeMonthly(rows, year, month);
    await onProgress('Menyusun infografis kaleidoskop');
    const image = await renderInfographic(summary);
    return {
        image,
        summary
    };
}

module.exports = {
    MONTHS,
    parseCsv,
    summarizeMonthly,
    generateMonthlyKaleidoscope
};
