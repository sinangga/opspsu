const axios = require('axios');

const BASE_URL = 'https://bmkgsatu.bmkg.go.id';
const USER = '96565';
const PASS = 'opr96565';

async function run() {
    try {
        console.log('Attempting login to BMKGsatu...');
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: USER,
            password: PASS
        }, { timeout: 10000 });
        
        const token = loginRes.data?.data?.accessToken || loginRes.data?.accessToken;
        if (!token) {
            console.log('Login successful but no token found in response:', loginRes.data);
            return;
        }
        
        console.log('Login successful! Token acquired.');
        
        // Try to access export data
        console.log('Fetching export data parameters...');
        const exportRes = await axios.get(`${BASE_URL}/api/exportdata`, {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 10000
        });
        
        console.log('Export data response:', JSON.stringify(exportRes.data).substring(0, 500));
        
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', JSON.stringify(e.response.data));
        }
    }
}

run();
