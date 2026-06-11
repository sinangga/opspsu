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
    'Kabut/Asap': 'kabut-am.png',
    'Berawan': 'cerah berawan-am.png',
    'Udara Kabur': 'udara-kabur.png'
};

const ICON_ORDER = [
    'Cerah',
    'Cerah Berawan',
    'Berawan',
    'Kabut/Asap',
    'Udara Kabur',
    'Hujan Ringan',
    'Hujan Sedang',
    'Hujan Lebat',
    'Hujan Petir',
    'Petir',
];

const ICON_DIR = path.join(__dirname, 'DashboardNextJS', 'public', 'icon');

function getBase64Icon(status) {
    let filename = STATUS_TO_ICON[status];
    if (!filename) {
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
    const resps = await Promise.all(
        urls.map((u) => axios.get(u, { timeout: 15000 }).then((r) => r.data).catch(e => null))
    );
    return resps.filter(r => r !== null);
}

function processDataByDate(raw) {
    const byKec = new Map();
    for (const r of raw) {
        const name = r?.lokasi?.kecamatan;
        const cuacaGroups = r?.data?.[0]?.cuaca;
        if (!name || !cuacaGroups) continue;
        const flatEntries = cuacaGroups.flat().sort((a, b) => a.local_datetime.localeCompare(b.local_datetime));
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
    
    const allDates = new Set();
    for (const dailyMap of processed.values()) {
        for (const date of dailyMap.keys()) allDates.add(date);
    }
    const sortedDates = Array.from(allDates).sort();
    
    const results = [];
    const bmkgLogo = fs.readFileSync(path.join(__dirname, 'DashboardNextJS', 'public', 'bmkg.png')).toString('base64');

    const BMKG_DARK = '#0f172a';
    const BMKG_PRIMARY = '#1e40af';
    const BMKG_ACCENT = '#38bdf8';
    const BMKG_BG = '#ecf5fb';

    for (let i = 0; i < 2; i++) {
        const targetDate = sortedDates[i];
        if (!targetDate) continue;

        const dateObj = new Date(targetDate);
        const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const titleSuffix = i === 0 ? "(Hari Ini)" : "(Besok)";

        const rows = [];
        const sortedKec = Array.from(processed.keys()).sort((a, b) => a.localeCompare(b, 'id-ID'));
        
        let hoursHeader = [];
        for (const kec of sortedKec) {
            const dayData = processed.get(kec).get(targetDate);
            if (dayData && dayData.length >= 4) {
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

        const legendItems = ICON_ORDER.map(label => ({ label, icon: getBase64Icon(label) }));
        const outputFile = `prakiraan_h${i}_${Date.now()}.png`;

        const html = `
        <html>
        <head>
          <style>
            body { 
                margin: 0; padding: 0; width: 1200px; height: 1500px;
                background: ${BMKG_BG};
                display: flex; align-items: center; justify-content: center;
                padding: 12px 12px 18px 12px;
                font-family: 'Tahoma', 'Verdana', sans-serif;
                box-sizing: border-box;
            }
            .outer-container {
                width: 100%; height: 100%;
                background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
                border-radius: 28px;
                box-shadow: 0 22px 60px rgba(15,23,42,0.14);
                overflow: hidden;
                display: flex; flex-direction: column;
            }
            .header { 
                padding: 16px 24px; 
                background: linear-gradient(135deg, ${BMKG_DARK} 0%, ${BMKG_PRIMARY} 50%, ${BMKG_ACCENT} 100%); 
                color: #f8fafc; 
                display: flex; align-items: center; gap: 28px; 
            }
            .header-logo { 
                width: 90px; height: 90px; border-radius: 24px; background: #e6f4ff; 
                display: flex; align-items: center; justify-content: center; 
                border: 1px solid rgba(191,219,254,0.9); box-shadow: 0 2px 6px rgba(30,64,175,0.25);
            }
            .header-text { display: flex; flex-direction: column; }
            .header-text h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
            .header-text h2 { margin: 4px 0 0 0; font-size: 15px; color: #e0f2fe; font-weight: 700; }
            .period-box {
                margin-top: 8px; display: inline-flex; align-items: center; gap: 10px; 
                font-size: 15px; font-weight: 800; background: rgba(148, 163, 184, 0.22); 
                color: #f8fafc; padding: 7px 14px; border-radius: 999px;
            }
            .table-container { padding: 10px 24px 0 24px; flex: 1; }
            .table-inner { border: 1px solid #d1d5db; border-radius: 18px; background: #f9fafb; overflow: hidden; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12.5px; color: rgba(0,0,0,0.95); }
            th { 
                font-family: 'Arial', sans-serif; padding: 10px 8px; font-size: 15.5px; font-weight: 900; 
                letter-spacing: 0.6px; text-align: center; border-right: 1px solid rgba(191,219,254,0.45);
                color: #f8fafc; text-shadow: 0 1px 0 rgba(0,0,0,0.15);
                background: linear-gradient(135deg, ${BMKG_DARK} 0%, ${BMKG_PRIMARY} 50%, ${BMKG_ACCENT} 100%);
            }
            td { padding: 5px 6px; text-align: center; border-right: 1px solid rgba(148,163,184,0.2); border-bottom: 1px solid rgba(148,163,184,0.2); }
            .td-kec { padding: 6px 8px; font-size: 14px; font-weight: 800; text-align: center; }
            .td-value { font-weight: 700; }
            .icon-wrapper { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; }
            .icon-wrapper img { width: 32px; height: 32px; }

            .legend-container { padding: 0px 18px 0px 18px; background: #ffffff; display: flex; flex-direction: column; align-items: center; }
            .dev-label { font-size: 10px; color: #6b7280; margin-bottom: 2px; text-align: center; font-weight: 600; }
            .legend-block { 
                border-radius: 10px; background: ${BMKG_PRIMARY}; padding: 6px 8px; margin-top: 2px; 
                width: 96%; align-self: center; color: #eaf2ff; border: 1px solid rgba(191,219,254,0.35);
                display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 10px; align-items: center;
            }
            .legend-item { display: flex; flex-direction: column; align-items: center; gap: 3px; justify-content: center; padding: 2px 0; }
            .legend-icon-box { width: 28px; height: 28px; border-radius: 6px; background: #ffffff; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.45); }
            .legend-icon-box img { width: 20px; height: 20px; }
            .legend-text { font-size: 11px; font-weight: 800; color: #eaf2ff; text-align: center; line-height: 1.1; }

            .footer-banner {
                width: 100%; padding: 16px 24px; margin-top: 8px;
                background: linear-gradient(135deg, ${BMKG_DARK} 0%, ${BMKG_PRIMARY} 50%, ${BMKG_ACCENT} 100%);
                color: #f8fafc; border: 1px solid rgba(191,219,254,0.4);
                box-shadow: 0 10px 25px rgba(15,23,42,0.15);
                text-align: center; font-size: 15.5px; font-weight: 900; letter-spacing: 0.3px;
                box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          <div class="outer-container">
            <div class="header">
              <div class="header-logo"><img src="data:image/png;base64,${bmkgLogo}" width="70"></div>
              <div class="header-text">
                <h1>BMKG - Stasiun Meteorologi Pangsuma Kapuas Hulu</h1>
                <h2>Prakiraan Cuaca Kabupaten Kapuas Hulu ${titleSuffix}</h2>
                <div class="period-box">
                  <span>Berlaku</span>
                  <span style="color: #bae6fd;">${dateLabel}</span>
                </div>
              </div>
            </div>

            <div class="table-container">
              <div class="table-inner">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 220px; border-top-left-radius: 18px;">KECAMATAN</th>
                      ${hoursHeader.map(h => `<th>${h}</th>`).join('')}
                      <th>SUHU</th>
                      <th>KELEMBAPAN</th>
                      <th>ANGIN</th>
                      <th style="border-top-right-radius: 18px; border-right: none;">KECEPATAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.map((r, idx) => `
                      <tr style="background: ${idx % 2 === 1 ? '#ffffff' : '#eef5ff'}">
                        <td class="td-kec">${r.name}</td>
                        ${r.cuaca.map(c => `
                            <td>
                                <div class="icon-wrapper">
                                    ${c.icon ? `<img src="${c.icon}">` : `<span style="font-size: 11px;">${c.text}</span>`}
                                </div>
                            </td>`).join('')}
                        <td class="td-value">${r.suhu}</td>
                        <td class="td-value">${r.rh}</td>
                        <td class="td-value">${r.arah}</td>
                        <td class="td-value" style="border-right: none;">${r.angin}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="legend-container">
              <div class="dev-label">developed by Sinangga</div>
              <div class="legend-block">
                ${legendItems.map(li => `
                  <div class="legend-item">
                    <div class="legend-icon-box">
                      ${li.icon ? `<img src="${li.icon}">` : ''}
                    </div>
                    <span class="legend-text">${li.label}</span>
                  </div>
                `).join('')}
              </div>
              <div class="footer-banner">
                Stasiun Meteorologi Pangsuma – Kapuas Hulu
              </div>
            </div>
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
