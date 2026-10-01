// move-installer.js
// Utility to locate the compiled Windows installer .exe and place it cleanly in the dist/ folder
import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'dist-package');
const destDir = path.join(process.cwd(), 'dist');

const sourceFile = path.join(srcDir, 'Lisa BatchPlantHMI_Setup.exe');
const targetFile = path.join(destDir, 'Lisa BatchPlantHMI_Setup.exe');

try {
  // Ensure we check that the source installer exists
  if (fs.existsSync(sourceFile)) {
    console.log(`HMI Packager: Moving Windows installer from temp directory: ${sourceFile} -> target destination: ${targetFile}`);
    
    // Ensure destDir exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy file
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✓ Successfully copied final installer package to dist/Lisa BatchPlantHMI_Setup.exe!');

    // Clean up temporary package directory to keep the workspace lightweight
    try {
      fs.rmSync(srcDir, { recursive: true, force: true });
      console.log('✓ Cleaned up intermediate packaging artifacts.');
    } catch (cleanErr) {
      console.log('Note: Intermediate artifacts cleanup skipped:', cleanErr.message);
    }
  } else {
    // Look for any .exe in dist-package as fallback
    if (fs.existsSync(srcDir)) {
      const files = fs.readdirSync(srcDir);
      const exeFile = files.find(f => f.endsWith('.exe'));
      if (exeFile) {
        const foundSource = path.join(srcDir, exeFile);
        console.log(`HMI Packager (Fallback): Copying ${foundSource} -> ${targetFile}`);
        fs.copyFileSync(foundSource, targetFile);
        console.log('✓ Successfully copied fallback installer package to target!');
      } else {
        console.warn('⚠ HMI Packager WARNING: No .exe installer was found in dist-package/. Skip copying.');
      }
    } else {
      console.warn('⚠ HMI Packager WARNING: dist-package/ folder was not found. Skip copying.');
    }
  }
} catch (err) {
  console.error('⚠ HMI Packager Error during post-processing:', err.message);
}
