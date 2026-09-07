const axios = require('axios');
const XLSX = require('xlsx');

const SIPONGI_API = 'https://opsroom.sipongidata.my.id';
const FILTERS = Object.freeze({
    late: 24,
    provinsi: 11,
    satelit: 'all-nasa',
    confidence: 'all'
});

function clean(value) {
    return String(value ?? '').trim();
}

function key(value) {
    return clean(value).toUpperCase().replace(/\s+/g, ' ');
}

function formatDate() {
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(new Date()).replace(/\//g, '-');
}

function buildSummary(rows) {
    const counts = new Map();
    const confidenceTotals = new Map();
    for (const row of rows) {
        const kecamatan = clean(row.Kecamatan) || 'Tidak teridentifikasi';
        const confidence = clean(row.Confidence) || 'Tidak teridentifikasi';
        const groupKey = `${kecamatan}\u0000${confidence}`;
        counts.set(groupKey, (counts.get(groupKey) || 0) + 1);
        confidenceTotals.set(confidence, (confidenceTotals.get(confidence) || 0) + 1);
    }

    const detail = [...counts.entries()]
        .map(([groupKey, jumlah]) => {
            const [kecamatan, confidence] = groupKey.split('\u0000');
            return { Kecamatan: kecamatan, Confidence: confidence, Jumlah: jumlah };
        })
        .sort((a, b) => a.Kecamatan.localeCompare(b.Kecamatan, 'id') || a.Confidence.localeCompare(b.Confidence, 'id'));

    return {
        total: rows.length,
        confidenceTotals: [...confidenceTotals.entries()]
            .map(([confidence, jumlah]) => ({ confidence, jumlah }))
            .sort((a, b) => ['High', 'Medium', 'Low'].indexOf(a.confidence) - ['High', 'Medium', 'Low'].indexOf(b.confidence)),
        detail
    };
}

async function generateHotspotReport() {
    const response = await axios.get(`${SIPONGI_API}/api/sebaran/download`, {
        params: { ...FILTERS, tipe: 'xlsx' },
        responseType: 'arraybuffer',
        timeout: 90000
    });
    const workbook = XLSX.read(response.data, { type: 'buffer' });
    if (!workbook.Sheets.Detail) throw new Error('Workbook SIPONGI tidak memiliki sheet Detail.');

    const detailRows = XLSX.utils.sheet_to_json(workbook.Sheets.Detail, { defval: '' });
    const kapuasRows = detailRows.filter(row => key(row['Kab Kota']) === 'KAPUAS HULU');
    const summary = buildSummary(kapuasRows);

    const recapRows = [
        ['Rekap Hotspot Kabupaten Kapuas Hulu', ''],
        ['Periode', '24 jam'],
        ['Provinsi', 'Kalimantan Barat'],
        ['Satelit', 'Semua satelit'],
        ['Kepercayaan', 'Semua'],
        ['Total hotspot', summary.total],
        [],
        ['Kecamatan', 'High', 'Medium', 'Low', 'Lainnya', 'Total']
    ];
    const kecamatanMap = new Map();
    for (const row of summary.detail) {
        if (!kecamatanMap.has(row.Kecamatan)) kecamatanMap.set(row.Kecamatan, {});
        const values = kecamatanMap.get(row.Kecamatan);
        values[row.Confidence] = (values[row.Confidence] || 0) + row.Jumlah;
    }
    for (const [kecamatan, values] of [...kecamatanMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id'))) {
        const high = values.High || 0, medium = values.Medium || 0, low = values.Low || 0;
        const other = Object.entries(values).filter(([name]) => !['High', 'Medium', 'Low'].includes(name)).reduce((sum, [, value]) => sum + value, 0);
        recapRows.push([kecamatan, high, medium, low, other, high + medium + low + other]);
    }
    recapRows.push([]);
    recapRows.push(['Confidence', 'Jumlah']);
    for (const item of summary.confidenceTotals) recapRows.push([item.confidence, item.jumlah]);

    workbook.Sheets.Rekap = XLSX.utils.aoa_to_sheet(recapRows);
    workbook.SheetNames = ['Akumulasi', 'Detail', 'Rekap'];
    workbook.Sheets.Rekap['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    return { summary, workbook: output, fileName: `hotspot-kapuas-hulu-${formatDate()}.xlsx` };
}

function formatHotspotMessage(result) {
    const lines = [
        '🔥 *HOTSPOT KAPUAS HULU*',
        '',
        'Periode: *24 jam terakhir*',
        'Provinsi: *Kalimantan Barat*',
        'Satelit: *Semua*',
        'Kepercayaan: *Semua*',
        '',
        `*Total: ${result.summary.total} hotspot*`,
        '',
        '*Per kepercayaan:*'
    ];
    for (const item of result.summary.confidenceTotals) lines.push(`• ${item.confidence}: ${item.jumlah}`);
    lines.push('', '*Per kecamatan:*');
    const grouped = new Map();
    for (const item of result.summary.detail) {
        if (!grouped.has(item.Kecamatan)) grouped.set(item.Kecamatan, []);
        grouped.get(item.Kecamatan).push(`${item.Confidence} ${item.Jumlah}`);
    }
    for (const [kecamatan, values] of grouped) lines.push(`• ${kecamatan}: ${values.join(', ')}`);
    if (!result.summary.total) lines.push('• Tidak ada hotspot terdeteksi.');
    return lines.join('\n');
}

module.exports = { FILTERS, generateHotspotReport, formatHotspotMessage };
