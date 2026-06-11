const { generatePrakiraanImages } = require('./prakiraan');

async function test() {
    console.log('Generating test infographics (Today & Tomorrow)...');
    try {
        const files = await generatePrakiraanImages();
        console.log('Success! Images saved:', files);
    } catch (e) {
        console.error('Failed:', e.message);
    }
}

test();
