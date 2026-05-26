const axios = require('axios');

const REALTIME_URL = 'http://172.22.64.250:3127';
const REALTIME_USER = 'admin';
const REALTIME_PASS = 'admin';

const dateStr = '2026-05-25'; // Test yesterday

async function test() {
    console.log(`Testing API for date: ${dateStr}`);
    try {
        console.log(`[1] Logging in to ${REALTIME_URL}/api/login ...`);
        const lRes = await axios.post(`${REALTIME_URL}/api/login`, { 
            username: REALTIME_USER, 
            password: REALTIME_PASS 
        }, { timeout: 5000 });
        
        const token = lRes.data.data.accessToken;
        console.log(`[2] Login success. Token: ${token.substring(0, 10)}...`);

        const csvUrl = `${REALTIME_URL}/api/historical/${dateStr}.csv`;
        console.log(`[3] Downloading CSV from ${csvUrl} ...`);
        
        try {
            const res = await axios.get(csvUrl, { 
                headers: { 'Authorization': `Bearer ${token}` }, 
                timeout: 10000 
            });
            console.log(`[4] Success! CSV Data length: ${res.data.length}`);
            console.log(`First 100 chars: ${res.data.substring(0, 100)}`);
        } catch (err) {
            console.error(`[4] CSV Download Failed!`);
            if (err.response) {
                console.error(`Status: ${err.response.status}`);
                console.error(`Data: ${JSON.stringify(err.response.data)}`);
            } else {
                console.error(`Error: ${err.message}`);
            }
        }
    } catch (e) {
        console.error(`Test failed at login or unexpected error: ${e.message}`);
    }
}

test();
