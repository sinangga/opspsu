const axios = require('axios');

const BASE_URL = 'https://bmkgsatu.bmkg.go.id';
const USER = '96565';
const PASS = 'opr96565';

async function testEndpoints() {
    const paths = [
        '/api/login',
        '/api/auth/login',
        '/api/v1/login',
        '/api/v21/login',
        '/api/props',
        '/api/casl-ability'
    ];

    for (const p of paths) {
        try {
            console.log(`Testing POST ${p}...`);
            const res = await axios.post(`${BASE_URL}${p}`, {
                username: USER,
                password: PASS
            }, { timeout: 5000 });
            console.log(`✅ POST ${p} Success!`);
            console.log(res.data);
            return;
        } catch (e) {
            console.log(`❌ POST ${p} failed: ${e.response?.status || e.message}`);
        }
    }
    
    // Also try GET for props/ability which might show headers
    try {
        console.log(`Testing GET /api/props...`);
        const res = await axios.get(`${BASE_URL}/api/props`, { timeout: 5000 });
        console.log(`✅ GET /api/props Success! Status: ${res.status}`);
    } catch (e) {
        console.log(`❌ GET /api/props failed: ${e.message}`);
    }
}

testEndpoints();
