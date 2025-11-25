#!/usr/bin/env node

// Purpose: use Javascript to call google colab api and display resulting detection.
// Usage: node parkingDetector.js <image_path> <colab_url>

const fs = require('fs'); // Filesystem import for java script
const http = require('http'); // Import HTTP client/server API
const https = require('https'); // Import HTTPS client API
const { spawn } = require('child_process'); // Import spawn to open a browser further down
const FormData = require('form-data'); // Import multi part form builder for file upload

const PORT = 23000;

// Parse arguments for image path and url for detection
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
        
        // Use a form builder to store the read stream of the image so it can be sent
        const form = new FormData();
        form.append('image', fs.createReadStream(imagePath));
        
        // Get the complete url for the api call
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
        
        // Do a Request call to the api to process the data and get res as the result
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; }); // Gather the data   
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const result = JSON.parse(data); // Parse data into sections based on section headers
                        console.log('Detection complete!');
                        console.log(`   Free: ${result.openCount}`); // Display open spot count
                        console.log(`   Occupied: ${result.occupied}`); // Display occupied spot count
                        console.log(`   Total: ${result.total}\n`); // Display total count
                        resolve(result); // Fulfill promise above
                    } catch (e) {
                        reject(new Error(`Parse error: ${data}`));
                    }
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });
        
        req.on('error', reject); // Network error handler
        form.pipe(req); // Stream the file into the request
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
            res.on('data', (chunk) => chunks.push(chunk)); // Gather the data
            res.on('end', () => {
                console.log(' Image downloaded!\n');
                resolve(Buffer.concat(chunks)); // Combine the image to fulfill the promise
            });
        }).on('error', reject);
    });
}

// Create results page
function createHTML(stats, imageBuffer) {
    const imageData = imageBuffer.toString('base64'); // Base 64 encoding for jpeg
    // ****** Add to html ********
    const rate = stats.total > 0 ? ((stats.occupied / stats.total) * 100).toFixed(1) : 0; // Compute occupied proportions
    
    //Return the html with all of the numbers embedded
    //HTML written by Ayham Yousef
    return `<!DOCTYPE html>
<html>
  <head>
    <title>Parking Detection Results</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 20px;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow: hidden;
      }
      
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px;
        text-align: center;
      }
      
      h1 {
        font-size: 32px;
        font-weight: 600;
        margin-bottom: 10px;
      }
      
      .timestamp {
        opacity: 0.9;
        font-size: 14px;
      }
      
      .content {
        padding: 30px;
      }
      
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }
      
      .stat-card {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        padding: 25px;
        border-radius: 12px;
        text-align: center;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        border: 2px solid transparent;
      }
      
      .stat-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      }
      
      .stat-card.open {
        background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
        border-color: #5cd88d;
      }
      
      .stat-card.occupied {
        background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
        border-color: #f76a8c;
      }
      
      .stat-card.total {
        background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
        border-color: #7ec4cf;
      }
      
      .stat-number {
        font-size: 48px;
        font-weight: bold;
        margin-bottom: 5px;
        color: #2d3748;
      }
      
      .stat-label {
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #4a5568;
      }
      
      .occupancy-bar {
        margin-bottom: 30px;
        background: #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
        height: 40px;
        position: relative;
      }
      
      .occupancy-fill {
        height: 100%;
        background: linear-gradient(90deg, #fa709a 0%, #fee140 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
      }
      
      .image-container {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      }
      
      img {
        width: 100%;
        height: auto;
        display: block;
      }
      
      .image-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 100%);
        pointer-events: none;
      }
      
      .legend {
        display: flex;
        justify-content: center;
        gap: 30px;
        margin-top: 20px;
        padding: 20px;
        background: #f7fafc;
        border-radius: 10px;
      }
      
      .legend-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 600;
      }
      
      .legend-color {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        border: 2px solid rgba(0, 0, 0, 0.1);
      }
      
      .legend-color.open {
        background: #48bb78;
      }
      
      .legend-color.occupied {
        background: #f56565;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Parking Detection Results</h1>
      </div>
      
      <div class="content">
        <div class="stats-grid">
          <div class="stat-card open">
            <div class="stat-number" id="openCount">${stats.openCount}</div>
            <div class="stat-label">Open Spots</div>
          </div>
          
          <div class="stat-card occupied">
            <div class="stat-number" id="occupiedCount">${stats.occupied}</div>
            <div class="stat-label">Occupied Spots</div>
          </div>
          
          <div class="stat-card total">
            <div class="stat-number" id="totalCount">${stats.total}</div>
            <div class="stat-label">Total Spots</div>
          </div>
        </div>
        
        <div class="occupancy-bar">
          <div class="occupancy-fill" id="occupancyFill" style="width: ${rate}%;">
            ${rate}% Occupied
          </div>
        </div>
        
        <div class="image-container">
          <img
            src="data:image/jpeg;base64,${imageData}"
            alt="Annotated parking lot"
          />
          <div class="image-overlay"></div>
        </div>
        
        <div class="legend">
          <div class="legend-item">
            <div class="legend-color open"></div>
            <span>Available</span>
          </div>
          <div class="legend-item">
            <div class="legend-color occupied"></div>
            <span>Occupied</span>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

// Display results
function showResults(stats, imageBuffer) {
    const html = createHTML(stats, imageBuffer); // Get html text
    //Create the server
    const server = http.createServer((req, res) => { // Establish a local server
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    });
    
    //Listen on a port for the server so user can connect and view the image
    server.listen(PORT, () => {
        console.log(`Results ready at: http://localhost:${PORT}\n`);
        const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
        spawn(opener, [`http://localhost:${PORT}`]); //Open the server iin a browser
        console.log('Press Ctrl+C to exit\n');
    });
}

// Main
async function main() {
    try {
        const stats = await uploadToColab(); // Get the stats to use on the results
        const imageBuffer = await downloadImage(); // Get the image to display in the results
        showResults(stats, imageBuffer); // Open the results
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
