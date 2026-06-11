const axios = require('axios');

const BASE_URL = 'https://bmkgsatu.bmkg.go.id';
const USER = '96565';
const PASS = 'opr96565';

async function tryLogin() {
    const endpoints = [
        '/api/login',
        '/api/auth/login',
        '/auth/login',
        '/api/v1/login'
    ];

    for (const ep of endpoints) {
        try {
            console.log(`Trying ${ep}...`);
            const res = await axios.post(`${BASE_URL}${ep}`, {
                username: USER,
                password: PASS
            }, { timeout: 5000 });
            
            console.log(`✅ Success with ${ep}!`);
            console.log('Response Status:', res.status);
            console.log('Response Data Keys:', Object.keys(res.data));
            if (res.data.accessToken || (res.data.data && res.data.data.accessToken)) {
                console.log('Token found!');
            }
            return res.data;
        } catch (e) {
            console.log(`❌ Failed ${ep}: ${e.message}`);
            if (e.response) {
                console.log('   Response Status:', e.response.status);
            }
        }
    }
}

tryLogin();
