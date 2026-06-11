const axios = require('axios');

const BASE_URL = 'https://bmkgsatu.bmkg.go.id';
const USER = '96565';
const PASS = 'opr96565';

async function tryDirectLogin() {
    try {
        console.log('Fetching login page to check for cookies/CSRF...');
        const initRes = await axios.get(`${BASE_URL}/login`, { timeout: 10000 });
        const cookies = initRes.headers['set-cookie'];
        
        console.log('Attempting POST to /api/auth/login with Basic Auth simulation...');
        // Some systems use /api/login or similar. Based on chunk analysis, 
        // it might be using a standard REST pattern.
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: USER,
            password: PASS
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies ? cookies.join('; ') : ''
            },
            timeout: 10000
        });

        console.log('Success!');
        console.log(loginRes.data);
    } catch (e) {
        console.log(`Failed: ${e.message}`);
        if (e.response) {
            console.log(`Status: ${e.response.status}`);
            // Check if it's 404 or 405
        }
    }
}

tryDirectLogin();
