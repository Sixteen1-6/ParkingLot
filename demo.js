#!/usr/bin/env node

//Purpose: use Javascript to call google colab api and display resulting detection.
//Usage: node parkingDetector.js <image_path> <colab_url>

const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const FormData = require('form-data');

const PORT = 30000;

// Parse arguments
const imagePath = process.argv[2];
const colabUrl = process.argv[3];

//If missing an argument throw error
if (!imagePath || !colabUrl) {
    console.error('\n Usage: node parkingDetector.js <image_path> <colab_url>\n');
    console.log('Example:');
    console.log('  node parkingDetector.js parking.jpg https://xxxxx.loca.lt\n');
    process.exit(1);
}

//Verify image path
if (!fs.existsSync(imagePath)) {
    console.error(`\n Image not found: ${imagePath}\n`);
    process.exit(1);
}

console.log('='.repeat(70));
console.log(`Image: ${imagePath}`); //Print the image path to verify what is being sent
console.log(`API: ${colabUrl}`); //Print colab path to verify where the api is
console.log('='.repeat(70) + '\n');

// Upload image to Colab
function uploadToColab() {
    return new Promise((resolve, reject) => {
        console.log('Uploading image to Colab...');
        
        //Make the image able to upload
        const form = new FormData();
        form.append('image', fs.createReadStream(imagePath));
        
        //Get the complete url for the api call
        const url = new URL('/detect', colabUrl);
        const client = url.protocol === 'https:' ? https : http;
        
        //Separate the url into sections to pass into .request 
        const options = {
            method: 'POST',
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            headers: form.getHeaders()
        };
        
        //Do a Request call to the api to process the data and get res as the result
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const result = JSON.parse(data);
                        console.log('Detection complete!');
                        console.log(`   Free: ${result.openCount}`);
                        console.log(`   Occupied: ${result.occupied}`);
                        console.log(`   Total: ${result.total}\n`);
                        resolve(result);
                    } catch (e) {
                        reject(new Error(`Parse error: ${data}`));
                    }
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });
        
        req.on('error', reject);
        form.pipe(req);
    });
}

// Download annotated image
function downloadImage() {
    return new Promise((resolve, reject) => {
        console.log('Downloading annotated image...');
        
        //Create URL for the GET request
        const url = new URL('/get_image', colabUrl);
        const client = url.protocol === 'https:' ? https : http;
        
        //Request to get the image from the API
        client.get(url.href, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Download failed: ${res.statusCode}`));
                return;
            }
            
            //Parse the data and combine it to recreate the image
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                console.log('✅ Image downloaded!\n');
                resolve(Buffer.concat(chunks));
            });
        }).on('error', reject);
    });
}

// Create results page
function createHTML(stats, imageBuffer) {
    const imageData = imageBuffer.toString('base64');
    const rate = stats.total > 0 ? ((stats.occupied / stats.total) * 100).toFixed(1) : 0;
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>Parking Detection Results</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #ffffff;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            font-size: 24px;
            margin-bottom: 20px;
        }
        .stats {
            margin-bottom: 20px;
            font-size: 18px;
        }
        .stats p {
            margin: 5px 0;
        }
        img {
            width: 100%;
            height: auto;
            border: 1px solid #ccc;
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Parking Detection Results</h1>
        
        <div class="stats">
            <p><strong>Open Spots:</strong> ${stats.openCount}</p>
            <p><strong>Occupied Spots:</strong> ${stats.occupied}</p>
        </div>
        
        <img src="data:image/jpeg;base64,${imageData}" alt="Annotated parking lot">
    </div>
</body>
</html>`;
}

// Display results
function showResults(stats, imageBuffer) {
    const html = createHTML(stats, imageBuffer);
    //Create the server
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    });
    
    //Listen on a port for the server so user can connect and view the image
    server.listen(PORT, () => {
        console.log(`Results ready at: http://localhost:${PORT}\n`);
        const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
        spawn(opener, [`http://localhost:${PORT}`]);
        console.log('Press Ctrl+C to exit\n');
    });
}

// Main
async function main() {
    try {
        const stats = await uploadToColab();
        const imageBuffer = await downloadImage();
        showResults(stats, imageBuffer);
    } catch (error) {
        console.error('\nError:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Is Colab still running?');
        console.error('2. Did you copy the correct URL?');
        console.error('3. Try visiting the URL in browser first\n');
        process.exit(1);
    }
}

main();
