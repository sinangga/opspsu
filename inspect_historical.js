const axios = require('axios');

const REALTIME_URL = 'http://172.22.64.250:3127';
const REALTIME_USER = 'admin';
const REALTIME_PASS = 'admin';

async function inspectHistorical() {
    try {
        console.log(`Logging in...`);
        const lRes = await axios.post(`${REALTIME_URL}/api/login`, { username: REALTIME_USER, password: REALTIME_PASS }, { timeout: 5000 });
        const token = lRes.data.data.accessToken;
        
        const dateStr = new Date().toISOString().split('T')[0];
        console.log(`Fetching /api/historical/${dateStr}.csv...`);
        const res = await axios.get(`${REALTIME_URL}/api/historical/${dateStr}.csv`, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 10000 });
        
        const lines = res.data.trim().split(/\r?\n/);
        console.log(`Received ${lines.length} lines.`);
        if (lines.length > 1) {
            console.log(`Header: ${lines[0]}`);
            const lastLines = lines.slice(-5);
            lastLines.forEach((line, i) => {
                const parts = line.split(/[;,]/);
                const ts = parts[0];
                if (!isNaN(ts)) {
                    console.log(`Line ${lines.length - 5 + i}: TS ${ts} (${new Date(ts * 1000).toISOString()})`);
                } else {
                    console.log(`Line ${lines.length - 5 + i}: ${line.substring(0, 50)}...`);
                }
            });
        }
    } catch (e) {
        console.error(`Error:`, e.message);
    }
}

inspectHistorical();
