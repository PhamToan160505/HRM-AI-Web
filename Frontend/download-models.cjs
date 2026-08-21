const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
    'ssd_mobilenet_v1_model-weights_manifest.json',
    'ssd_mobilenet_v1_model-shard1',
    'ssd_mobilenet_v1_model-shard2',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2'
];

files.forEach(file => {
    const dest = path.join(modelsDir, file);
    if (!fs.existsSync(dest)) {
        console.log('Downloading ' + file + '...');
        const fileStream = fs.createWriteStream(dest);
        https.get(baseUrl + file, response => {
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log('Downloaded ' + file);
            });
        }).on('error', err => {
            fs.unlink(dest, () => {});
            console.error('Error downloading ' + file + ': ' + err.message);
        });
    }
});
