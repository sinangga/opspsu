const axios = require('axios');

const config = {
    backgroundColor: '#ffffff',
    polar: { radius: '65%' },
    angleAxis: { type: 'category', data: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], startAngle: 90, clockwise: true },
    radiusAxis: { axisLabel: { formatter: '{value}%' }, z: 10 },
    series: [
        { type: 'bar', name: '< 2', stack: 'a', coordinateSystem: 'polar', data: [5, 7, 7, 14, 12, 6, 5, 4] }
    ]
};

const baseUrl = 'https://quickchart.io/echarts';
const url = `${baseUrl}?c=${encodeURIComponent(JSON.stringify(config))}&width=800&height=800`;

async function testChart() {
    console.log(`URL Length: ${url.length}`);
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        console.log(`Success! Received ${res.data.length} bytes.`);
    } catch (err) {
        console.error(`QuickChart Failed!`);
        if (err.response) {
            console.error(`Status: ${err.response.status}`);
        } else {
            console.error(`Error: ${err.message}`);
        }
    }
}

testChart();
