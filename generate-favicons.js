const sharp = require('sharp');
const path = require('path');
const SOURCE = path.join(__dirname, '..', '..', 'brain', '12702255-aea2-43da-ad1c-4e6ed28687a2', 'chathere_favicon_1777108022063.png');
const PUBLIC = path.join(__dirname, 'public');
async function go() {
    await sharp(SOURCE).resize(192, 192).png().toFile(path.join(PUBLIC, 'favicon.png'));
    await sharp(SOURCE).resize(32, 32).png().toFile(path.join(PUBLIC, 'favicon-32x32.png'));
    await sharp(SOURCE).resize(16, 16).png().toFile(path.join(PUBLIC, 'favicon-16x16.png'));
    await sharp(SOURCE).resize(512, 512).png().toFile(path.join(PUBLIC, 'logo.png'));
    await sharp(SOURCE).resize(180, 180).png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'));
    await sharp(SOURCE).resize(48, 48).png().toFile(path.join(PUBLIC, 'favicon-48x48.png'));
    console.log('Done!');
}
go().catch(console.error);
