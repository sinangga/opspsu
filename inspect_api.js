const axios = require('axios');

const REALTIME_URL = 'http://172.22.64.250:3127';
const REALTIME_USER = 'admin';
const REALTIME_PASS = 'admin';

async function inspectCodeApi() {
    try {
        console.log(`Logging in...`);
        const lRes = await axios.post(`${REALTIME_URL}/api/login`, { username: REALTIME_USER, password: REALTIME_PASS }, { timeout: 5000 });
        const token = lRes.data.data.accessToken;
        
        console.log(`Fetching /api/code...`);
        const res = await axios.get(`${REALTIME_URL}/api/code`, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 5000 });
        
        const data = res.data?.data;
        if (Array.isArray(data)) {
            console.log(`Received array of ${data.length} items.`);
            data.slice(0, 5).forEach((item, index) => {
                console.log(`Item ${index}: Timestamp: ${item.timestamp} (${new Date(item.timestamp).toISOString()})`);
            });
            
            // Try to find the latest
            const latest = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            console.log(`\nAbsolute latest by timestamp: ${latest.timestamp} (${new Date(latest.timestamp).toISOString()})`);
            console.log(`First item in array:          ${data[0].timestamp} (${new Date(data[0].timestamp).toISOString()})`);
        } else {
            console.log(`Data is not an array:`, res.data);
        }
    } catch (e) {
        console.error(`Error:`, e.message);
    }
}

inspectCodeApi();
