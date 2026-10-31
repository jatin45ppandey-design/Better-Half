import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch();

  const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '1024', width: 1024, height: 768 },
    { name: '390', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
    // Small wait for fonts/animations
    await page.waitForTimeout(600);

    const filePath = path.join(outDir, `landing-${vp.name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`Saved screenshot for ${vp.name} to ${filePath}`);

    await page.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully.');
}

run().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});

