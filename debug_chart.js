const axios = require('axios');

const config = {
    type: 'bar',
    data: {
        labels: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
        datasets: [{ label: 'Test', data: [10, 20, 30, 40, 50, 60, 70, 80], backgroundColor: 'blue' }]
    },
    options: {
        title: { display: true, text: 'Test Chart' }
    }
};

const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&width=800&height=800`;

async function testChart() {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        console.log(`Success! Received ${res.data.length} bytes.`);
    } catch (err) {
        console.error(`QuickChart Failed: ${err.message}`);
    }
}

testChart();
