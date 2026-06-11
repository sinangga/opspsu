const axios = require('axios');

// Simplified ECharts config to test if it renders at all
const config = {
    polar: {},
    angleAxis: { type: 'category', data: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] },
    radiusAxis: {},
    series: [{
        type: 'bar',
        data: [10, 20, 30, 40, 50, 60, 70, 80],
        coordinateSystem: 'polar'
    }]
};

const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&width=800&height=800&version=2`;

async function testChart() {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        console.log(`Success! Received ${res.data.length} bytes.`);
    } catch (err) {
        console.error(`QuickChart Failed: ${err.message}`);
    }
}

testChart();
