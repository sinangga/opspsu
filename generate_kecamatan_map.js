const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./DashboardNextJS/agg.json', 'utf8'));
const map = {};

for (const kabupaten in data) {
    for (const kecamatan in data[kabupaten]) {
        const info = data[kabupaten][kecamatan].lokasi;
        map[kecamatan] = {
            adm4: info.adm4,
            lat: info.lat,
            lon: info.lon,
            kecamatan: info.kecamatan
        };
    }
}

fs.writeFileSync('./DashboardNextJS/kecamatan_map.json', JSON.stringify(map, null, 2));
console.log('Mapping created successfully.');
