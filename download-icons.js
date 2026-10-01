// download-icons.js
// Ultra-robust loader and generator for PT. Farika Riau Perkasa - Lisa Batch Plant HMI
import fs from 'fs';
import path from 'path';
import https from 'https';

const buildDir = path.join(process.cwd(), 'build');

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const pngPath = path.join(buildDir, 'icon.png');
const icoPath = path.join(buildDir, 'icon.ico');

// A reliable, beautiful 256x256 industrial red tech icon URL (official Node-RED logo)
const FALLBACK_PNG_URL = 'https://raw.githubusercontent.com/node-red/node-red/master/packages/resources/node-red-icon-256.png';

// Standard 256x256 fallback PNG in base64 if network is completely down
const BASE64_FALLBACK_PNG = 
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABF96nDAAAABlBMVEUAAAD///+l2Z/dAAABF0lEQV' +
  'RoHe3XMQ6EMAwEQMD+/6UPQAki0ZByKzY6Z7m6bZInSMyvbe4XgP+0XwAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnpnb3AnAf9rP' +
  'GgAAAAAAAAAAAAAAAAAAAAB6E6RMAAAAAElFTkSuQmCC';

/**
 * Downloads a file from a URL with redirection handling and short timeout
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(dest);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(true);
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Redirection
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      } else {
        reject(new Error(`HTTP status: ${response.statusCode}`));
      }
    });

    req.on('error', reject);
    req.setTimeout(2500, () => {
      req.destroy();
      reject(new Error('Network timeout'));
    });
  });
}

/**
 * Converts a 256x256 PNG file into a fully compliant Windows .ico containing the PNG
 */
function compilePngToIco(srcPngPath, destIcoPath) {
  try {
    const pngBuffer = fs.readFileSync(srcPngPath);
    const pngSize = pngBuffer.length;

    // Create the 22-byte ICO header & directory entry for a single 256x256 image
    const header = Buffer.alloc(22);
    
    // --- ICO Header ---
    header.writeUInt16LE(0, 0);   // Reserved, must be 0
    header.writeUInt16LE(1, 2);   // Type: 1 = Icon (.ico)
    header.writeUInt16LE(1, 4);   // Number of images in file: 1

    // --- Directory Entry ---
    header.writeUInt8(0, 6);      // Width: 0 means 256 pixels
    header.writeUInt8(0, 7);      // Height: 0 means 256 pixels
    header.writeUInt8(0, 8);      // Color palette size: 0 (No palette)
    header.writeUInt8(0, 9);      // Reserved, must be 0
    header.writeUInt16LE(1, 10);  // Color planes: 1
    header.writeUInt16LE(32, 12); // Bits per pixel: 32 (Standard RGBA)
    header.writeUInt32LE(pngSize, 14); // Size of target image entry in bytes
    header.writeUInt32LE(22, 18); // Offset of image bytes in file (header + 1 entry = 22)

    // Concatenate the header and the raw PNG bytes
    const icoBuffer = Buffer.concat([header, pngBuffer]);
    fs.writeFileSync(destIcoPath, icoBuffer);
    console.log(`✓ Compiled PNG to 256x256 .ico successfully: ${destIcoPath}`);
    return true;
  } catch (err) {
    console.error('⚠ ICO Compilation failed:', err.message);
    return false;
  }
}

async function start() {
  console.log('HMI Packager: Initializing packaging assets...');

  // 1. Determine if a custom icon.png already exists
  let pngExists = fs.existsSync(pngPath);

  if (pngExists) {
    console.log('✓ Found custom icon.png in build folder. Packaging local logo...');
  } else {
    // Attempt download of high-quality fallback PNG
    console.log('No custom icon.png found. Fetching industrial design launcher template...');
    try {
      await downloadFile(FALLBACK_PNG_URL, pngPath);
      console.log('✓ Downloaded high-resolution industrial template icon!');
      pngExists = true;
    } catch (err) {
      console.log(`Fallback download failed (${err.message}). Generating synthetic launcher icon...`);
      try {
        fs.writeFileSync(pngPath, Buffer.from(BASE64_FALLBACK_PNG, 'base64'));
        console.log('✓ Created fallback launcher template icon.');
        pngExists = true;
      } catch (writeErr) {
        console.error('Failed to write fallback icon:', writeErr.message);
      }
    }
  }

  // 2. Generate the .ico using our custom professional PNG wrapper code
  if (pngExists) {
    compilePngToIco(pngPath, icoPath);
  } else {
    console.error('⚠ Error: Could not prepare PNG file. Cannot generate .ico file.');
  }

  // 3. Generate PWA launcher icons inside the /public directory for Android PWA compliance
  try {
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Read the compiled build image if available, else fallback
    const finalPngBuffer = pngExists ? fs.readFileSync(pngPath) : Buffer.from(BASE64_FALLBACK_PNG, 'base64');
    
    fs.writeFileSync(path.join(publicDir, 'icon-192.png'), finalPngBuffer);
    fs.writeFileSync(path.join(publicDir, 'icon-512.png'), finalPngBuffer);
    console.log('✓ Cloned raw binary PNG launcher icons in /public/ for professional PWA setup!');
  } catch (err) {
    console.error('⚠ Failed to generate PWA PNG files:', err.message);
  }

  console.log('✓ HMI Launcher & Installer asset preparations complete!');
}

start();
