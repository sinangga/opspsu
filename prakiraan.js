const axios = require('axios');
const nodeHtmlToImage = require('node-html-to-image');
const path = require('path');
const fs = require('fs');

const BASE = 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=61.06.';

const STATUS_TO_ICON = {
    'Cerah': 'cerah-am.png',
    'Hujan Ringan': 'hujan ringan-am.png',
    'Hujan Petir': 'hujan petir-am.png',
    'Petir': 'hujan petir-am.png',
    'Cerah Berawan': 'cerah berawan-am.png',
    'Hujan Lebat': 'hujan lebat-am.png',
    'Hujan Sedang': 'hujan sedang-am.png',
    'Kabut': 'kabut-am.png',
    'Asap': 'kabut-am.png',
    'Kabut/Asap': 'kabut-am.png',
    'Berawan': 'cerah berawan-am.png',
    'Berawan Tebal': 'cerah berawan-am.png',
    'Udara Kabur': 'udara-kabur.png'
};

const ICON_DIR = path.join(__dirname, 'DashboardNextJS', 'public', 'icon');

function getBase64Icon(status) {
    let filename = STATUS_TO_ICON[status];
    if (!filename) {
        // Fallback search
        const norm = status.toLowerCase().trim();
        if (norm.includes('hujan') && norm.includes('petir')) filename = STATUS_TO_ICON['Hujan Petir'];
        else if (norm.includes('hujan') && norm.includes('ringan')) filename = STATUS_TO_ICON['Hujan Ringan'];
        else if (norm.includes('hujan') && norm.includes('lebat')) filename = STATUS_TO_ICON['Hujan Lebat'];
        else if (norm.includes('hujan')) filename = STATUS_TO_ICON['Hujan Sedang'];
        else if (norm.includes('cerah') && norm.includes('berawan')) filename = STATUS_TO_ICON['Cerah Berawan'];
        else if (norm.includes('cerah')) filename = STATUS_TO_ICON['Cerah'];
        else if (norm.includes('berawan')) filename = STATUS_TO_ICON['Berawan'];
        else if (norm.includes('kabut') || norm.includes('asap') || norm.includes('kabur')) filename = STATUS_TO_ICON['Udara Kabur'];
    }
    
    if (!filename) return '';
    const filePath = path.join(ICON_DIR, filename);
    if (fs.existsSync(filePath)) {
        return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
    }
    return '';
}

async function fetchPrakiraanBatch() {
    const suffixes2_16 = Array.from({ length: 15 }, (_, i) => `${(i + 2).toString().padStart(2, '0')}.2001`);
    const suffixes18_23 = Array.from({ length: 6 }, (_, i) => `${(i + 18).toString().padStart(2, '0')}.2001`);
    const urls = [
        `${BASE}01.1001`,
        ...suffixes2_16.map((s) => BASE + s),
        `${BASE}17.1001`,
        ...suffixes18_23.map((s) => BASE + s),
    ];
    // Fetch all kecamatan
    const resps = await Promise.all(
        urls.map((u) => axios.get(u, { timeout: 15000 }).then((r) => r.data).catch(e => null))
    );
    return resps.filter(r => r !== null);
}

function processDataByDate(raw) {
    // raw is the array of responses for all kecamatan
    const byKec = new Map();
    for (const r of raw) {
        const name = r?.lokasi?.kecamatan;
        const cuacaGroups = r?.data?.[0]?.cuaca; // Array of arrays
        if (!name || !cuacaGroups) continue;

        const flatEntries = cuacaGroups.flat().sort((a, b) => a.local_datetime.localeCompare(b.local_datetime));
        
        // Group by local date string
        const daily = new Map();
        for (const entry of flatEntries) {
            const dateStr = entry.local_datetime.split(' ')[0];
            if (!daily.has(dateStr)) daily.set(dateStr, []);
            daily.get(dateStr).push(entry);
        }
        byKec.set(name, daily);
    }
    return byKec;
}

function toIndoWind(dir) {
    const map = { N: 'Utara', NE: 'Timur Laut', E: 'Timur', SE: 'Tenggara', S: 'Selatan', SW: 'Barat Daya', W: 'Barat', NW: 'Barat Laut' };
    return map[dir] || dir;
}

async function generatePrakiraanImages() {
    const rawData = await fetchPrakiraanBatch();
    const processed = processDataByDate(rawData);
    
    // Get unique dates available in the data
    const allDates = new Set();
    for (const dailyMap of processed.values()) {
        for (const date of dailyMap.keys()) allDates.add(date);
    }
    const sortedDates = Array.from(allDates).sort();
    
    const results = [];
    const bmkgLogo = fs.readFileSync(path.join(__dirname, 'DashboardNextJS', 'public', 'bmkg.png')).toString('base64');

    // Generate for Day 1 (H+0) and Day 2 (H+1)
    for (let i = 0; i < 2; i++) {
        const targetDate = sortedDates[i];
        if (!targetDate) continue;

        const dateObj = new Date(targetDate);
        const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const titleSuffix = i === 0 ? "(Hari Ini)" : "(Besok)";

        // Build rows for this date
        const rows = [];
        const sortedKec = Array.from(processed.keys()).sort((a, b) => a.localeCompare(b, 'id-ID'));
        
        // Find common hours for the header from the first kecamatan that has data for this date
        let hoursHeader = [];
        for (const kec of sortedKec) {
            const dayData = processed.get(kec).get(targetDate);
            if (dayData && dayData.length >= 4) { // usually 8 slots, but take what we have
                hoursHeader = dayData.slice(0, 8).map(d => d.local_datetime.split(' ')[1].substring(0, 5));
                break;
            }
        }

        for (const kec of sortedKec) {
            const dayData = processed.get(kec).get(targetDate);
            if (!dayData) continue;

            const slice = dayData.slice(0, 8);
            const suhu = slice.map(d => d.t);
            const rh = slice.map(d => d.hu);
            const ws = slice.map(d => d.ws);
            const wd = slice.map(d => d.wd);

            const mode = (arr) => arr.sort((a, b) => arr.filter(v => v===a).length - arr.filter(v => v===b).length).pop() || '';

            rows.push({
                name: kec,
                cuaca: slice.map(s => ({ text: s.weather_desc, icon: getBase64Icon(s.weather_desc) })),
                suhu: `${Math.min(...suhu)}-${Math.max(...suhu)}°C`,
                rh: `${Math.min(...rh)}-${Math.max(...rh)}%`,
                arah: toIndoWind(mode(wd)),
                angin: `${Math.round(Math.max(...ws))} KT`
            });
        }

        const outputFile = `prakiraan_h${i}_${Date.now()}.png`;

        const html = `
        <html>
        <head>
          <style>
            body { 
                font-family: 'Tahoma', 'Verdana', sans-serif; 
                background: #ecf5fb; 
                margin: 0; 
                padding: 15px; 
                width: 1200px;
                box-sizing: border-box;
            }
            .container { 
                background: white; 
                border-radius: 28px; 
                box-shadow: 0 22px 60px rgba(15,23,42,0.15); 
                overflow: hidden; 
                display: flex; 
                flex-direction: column;
                min-height: 1200px;
            }
            .header { 
                padding: 18px 25px; 
                background: linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #38bdf8 100%); 
                color: #f8fafc; 
                display: flex; 
                align-items: center; 
                gap: 25px; 
            }
            .header-logo { 
                width: 85px; height: 85px; 
                background: #e6f4ff; 
                border-radius: 22px; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
            .header-text h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
            .header-text h2 { margin: 4px 0 0 0; font-size: 16px; color: #bae6fd; font-weight: 700; }
            .period { 
                margin-top: 10px; 
                background: rgba(148,163,184,0.25); 
                padding: 6px 16px; 
                border-radius: 20px; 
                display: inline-block; 
                font-size: 14px; 
                font-weight: 800;
                color: #f8fafc;
            }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 15px; border: 1px solid #d1d5db; border-radius: 18px; overflow: hidden; }
            th { 
                background: linear-gradient(135deg, #0f172a 0%, #1e40af 100%); 
                color: white; 
                padding: 14px 8px; 
                font-size: 13px; 
                border-right: 1px solid rgba(255,255,255,0.1);
                text-align: center;
            }
            td { 
                padding: 10px 5px; 
                text-align: center; 
                border-bottom: 1px solid #e2e8f0; 
                border-right: 1px solid #e2e8f0;
                font-size: 13px; 
                font-weight: 700;
                color: #1e293b;
            }
            .kec-name { 
                text-align: left; 
                padding-left: 20px; 
                background: #f8fafc; 
                width: 180px;
                color: #0f172a;
                font-weight: 800;
            }
            .icon-cell { width: 65px; }
            .icon-cell img { width: 34px; height: 34px; }
            .icon-label { font-size: 10px; font-weight: 400; color: #64748b; margin-top: 2px; }
            .footer { 
                padding: 15px; 
                background: linear-gradient(135deg, #0f172a 0%, #1e40af 100%); 
                color: white; 
                text-align: center; 
                font-weight: 900; 
                font-size: 16px;
                margin-top: auto;
            }
            tr:last-child td { border-bottom: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-logo"><img src="data:image/png;base64,${bmkgLogo}" width="65"></div>
              <div class="header-text">
                <h1>BMKG - Stasiun Meteorologi Pangsuma Kapuas Hulu</h1>
                <h2>Prakiraan Cuaca Kabupaten Kapuas Hulu ${titleSuffix}</h2>
                <div class="period">Berlaku: ${dateLabel}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 180px;">KECAMATAN</th>
                  ${hoursHeader.map(h => `<th>${h}</th>`).join('')}
                  <th>SUHU</th>
                  <th>RH</th>
                  <th>ANGIN</th>
                  <th style="border-right: none;">SPD</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((r, idx) => `
                  <tr style="background: ${idx % 2 === 1 ? '#ffffff' : '#f1f5f9'}">
                    <td class="kec-name">${r.name}</td>
                    ${r.cuaca.map(c => `
                        <td class="icon-cell">
                            ${c.icon ? `<img src="${c.icon}">` : `<div style="font-size: 11px;">${c.text}</div>`}
                        </td>`).join('')}
                    <td style="color: #b91c1c;">${r.suhu}</td>
                    <td style="color: #1d4ed8;">${r.rh}</td>
                    <td>${r.arah}</td>
                    <td style="border-right: none;">${r.angin}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer">Stasiun Meteorologi Pangsuma – Kapuas Hulu</div>
          </div>
        </body>
        </html>
        `;

        await nodeHtmlToImage({
            output: outputFile,
            html: html,
            puppeteerArgs: {
                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,1500']
            }
        });
        results.push(outputFile);
    }
    return results;
}

module.exports = { generatePrakiraanImages };
