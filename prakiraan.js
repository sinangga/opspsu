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

const ICON_DIR = path.join(__dirname, 'DashboardNextJS', 'public', 'icon');

function getBase64Icon(status) {
  const filename = STATUS_TO_ICON[status] || STATUS_TO_ICON[status.trim()];
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
    urls.map((u) => axios.get(u, { timeout: 10000 }).then((r) => r.data))
  );
  return resps;
}

function flattenFirstThreeGroups(cuaca) {
  const firstThree = cuaca.slice(0, 3);
  const flat = firstThree.flat();
  return flat.sort((a, b) => a.local_datetime.localeCompare(b.local_datetime));
}

function computeEightSlots(entries) {
  const slice = entries.slice(0, 8);
  const suhu = slice.map((d) => d.t);
  const rh = slice.map((d) => d.hu);
  const arah = slice.map((d) => d.wd);
  const angin = slice.map((d) => d.ws);
  const cuaca = slice.map((d) => d.weather_desc);
  const hours = slice.map((d) => new Date(d.local_datetime.replace(' ', 'T')).getHours().toString().padStart(2, '0'));
  const minMax = (arr) => `${Math.min(...arr)}-${Math.max(...arr)}`;
  const mode = (arr) => arr.sort((a, b) => arr.filter(v => v===a).length - arr.filter(v => v===b).length).pop() || '';
  
  return {
    cuaca,
    suhuRange: minMax(suhu),
    rhRange: `${minMax(rh)}%`,
    arah: mode(arah),
    anginMax: `${Math.round(Math.max(...angin))} Knot`,
    hours,
  };
}

function toIndoWind(dir) {
  const map = { N: 'Utara', NE: 'Timur Laut', E: 'Timur', SE: 'Tenggara', S: 'Selatan', SW: 'Barat Daya', W: 'Barat', NW: 'Barat Laut' };
  return map[dir] || dir;
}

async function generatePrakiraanImage(outputFile) {
  const batch = await fetchPrakiraanBatch();
  const byKec = new Map();
  for (const r of batch) {
    const name = r?.lokasi?.kecamatan;
    if (name && r?.data?.[0]?.cuaca) byKec.set(name, r);
  }

  const reference = Array.from(byKec.values())[0];
  if (!reference) throw new Error("No data found");
  
  const entriesRef = flattenFirstThreeGroups(reference.data[0].cuaca);
  const slotsRef = computeEightSlots(entriesRef);
  const hoursHeader = slotsRef.hours;

  const rows = [];
  const sortedKec = Array.from(byKec.keys()).sort((a, b) => a.localeCompare(b, 'id-ID'));
  
  for (const name of sortedKec) {
      const entry = byKec.get(name);
      const entries = flattenFirstThreeGroups(entry.data[0].cuaca);
      const s = computeEightSlots(entries);
      rows.push({
          name,
          cuaca: s.cuaca.map(c => ({ text: c, icon: getBase64Icon(c) })),
          suhu: `${s.suhuRange}°C`,
          rh: s.rhRange,
          arah: toIndoWind(s.arah),
          angin: s.anginMax
      });
  }

  const dateLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const html = `
  <html>
  <head>
    <style>
      body { font-family: 'Tahoma', sans-serif; background: #ecf5fb; margin: 0; padding: 20px; width: 1200px; height: 1500px; }
      .container { background: white; border-radius: 28px; box-shadow: 0 22px 60px rgba(0,0,0,0.1); overflow: hidden; display: flex; flexDirection: column; }
      .header { padding: 20px 30px; background: linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #38bdf8 100%); color: white; display: flex; align-items: center; gap: 30px; }
      .header-logo { width: 90px; height: 90px; background: #e6f4ff; border-radius: 24px; display: flex; align-items: center; justify-content: center; }
      .header-text h1 { margin: 0; font-size: 24px; font-weight: 900; }
      .header-text h2 { margin: 5px 0 0 0; font-size: 18px; color: #bae6fd; }
      .period { margin-top: 10px; background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; display: inline-block; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background: #1e40af; color: white; padding: 12px; font-size: 14px; border: 1px solid #38bdf8; }
      td { padding: 10px; text-align: center; border: 1px solid #d1d5db; font-size: 13px; font-weight: 700; }
      .kec-name { text-align: left; padding-left: 20px; background: #f8fafc; }
      .icon-cell img { width: 32px; height: 32px; }
      .footer { padding: 20px; background: linear-gradient(135deg, #0f172a 0%, #1e40af 100%); color: white; text-align: center; font-weight: 900; font-size: 18px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="header-logo"><img src="data:image/png;base64,${fs.readFileSync(path.join(__dirname, 'DashboardNextJS', 'public', 'bmkg.png')).toString('base64')}" width="70"></div>
        <div class="header-text">
          <h1>BMKG - Stasiun Meteorologi Pangsuma Kapuas Hulu</h1>
          <h2>Prakiraan Cuaca Kabupaten Kapuas Hulu</h2>
          <div class="period">Berlaku: ${dateLabel}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="border-top-left-radius: 18px;">KECAMATAN</th>
            ${hoursHeader.map(h => `<th>${h}</th>`).join('')}
            <th>SUHU</th>
            <th>RH</th>
            <th>ANGIN</th>
            <th style="border-top-right-radius: 18px;">KECEPATAN</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#eef5ff'}">
              <td class="kec-name">${r.name}</td>
              ${r.cuaca.map(c => `<td class="icon-cell">${c.icon ? `<img src="${c.icon}">` : `<span>${c.text}</span>`}</td>`).join('')}
              <td>${r.suhu}</td>
              <td>${r.rh}</td>
              <td>${r.arah}</td>
              <td>${r.angin}</td>
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
      args: ['--no-sandbox']
    }
  });
}

module.exports = { generatePrakiraanImage };
