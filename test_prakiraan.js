const { generatePrakiraanImage } = require('./prakiraan');

async function test() {
    console.log('Generating test infographic...');
    try {
        await generatePrakiraanImage('test_prakiraan.png');
        console.log('Success! Image saved to test_prakiraan.png');
    } catch (e) {
        console.error('Failed:', e.message);
    }
}

test();
