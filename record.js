const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function injectCursor(page) {
  return page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'virtual-cursor';
    cursor.style.position = 'fixed';
    cursor.style.left = '50%';
    cursor.style.top = '25%';
    cursor.style.width = '24px';
    cursor.style.height = '24px';
    cursor.style.borderRadius = '50%';
    cursor.style.backgroundColor = 'rgba(56, 189, 248, 0.45)';
    cursor.style.border = '2px solid rgba(255, 255, 255, 0.9)';
    cursor.style.boxShadow = '0 0 15px rgba(56, 189, 248, 0.8), 0 2px 5px rgba(0,0,0,0.4)';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '999999';
    cursor.style.transform = 'translate(-50%, -50%)';
    cursor.style.transition = 'transform 0.14s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease';
    document.body.appendChild(cursor);

    window.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });

    window.addEventListener('mousedown', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(0.65)';
      cursor.style.backgroundColor = 'rgba(168, 85, 247, 0.8)';
    });
    window.addEventListener('mouseup', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      cursor.style.backgroundColor = 'rgba(56, 189, 248, 0.45)';
    });
  });
}

(async () => {
  const dir = __dirname;
  const tempDir = path.join(dir, 'temp-record');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const fileUrl = 'file://' + path.join(dir, 'index.html');

  // ==========================================
  // 1. DESKTOP RECORDING (1200x900)
  // ==========================================
  console.log('--- [04] Recording Desktop Version ---');
  const desktopVideoDir = path.join(tempDir, 'desktop');
  fs.mkdirSync(desktopVideoDir);

  const desktopContext = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
    recordVideo: { dir: desktopVideoDir, size: { width: 1200, height: 900 } }
  });

  const dPage = await desktopContext.newPage();
  await dPage.goto(fileUrl);
  await dPage.waitForTimeout(600);

  // Screenshot Desktop
  await dPage.screenshot({ path: path.join(dir, 'screenshot-desktop.png') });
  console.log('Saved screenshot-desktop.png');

  await injectCursor(dPage);
  await dPage.mouse.move(600, 180);
  await dPage.waitForTimeout(400);

  // Glide across navbar to demonstrate dynamic spotlight border
  const nav = await dPage.$('#spotlightNav');
  const navBox = await nav.boundingBox();
  if (navBox) {
    // Sweep left to right along navbar
    for (let x = navBox.x + 20; x <= navBox.x + navBox.width - 20; x += 30) {
      await dPage.mouse.move(x, navBox.y + navBox.height / 2, { steps: 5 });
      await dPage.waitForTimeout(40);
    }
    // Sweep right to left along bottom border
    for (let x = navBox.x + navBox.width - 20; x >= navBox.x + 20; x -= 35) {
      await dPage.mouse.move(x, navBox.y + navBox.height - 4, { steps: 5 });
      await dPage.waitForTimeout(40);
    }
  }

  // Hover on links
  const links = await dPage.$$('#spotlightNav a[href^="#"]');
  for (const link of links.slice(1, 4)) {
    const box = await link.boundingBox();
    if (box) {
      await dPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
      await dPage.waitForTimeout(300);
    }
  }

  // Click theme switcher (White mode)
  const themeBtn = await dPage.$('#themeToggleBtn');
  const themeBox = await themeBtn.boundingBox();
  if (themeBox) {
    await dPage.mouse.move(themeBox.x + themeBox.width / 2, themeBox.y + themeBox.height / 2, { steps: 18 });
    await dPage.waitForTimeout(250);
    await dPage.mouse.down();
    await dPage.waitForTimeout(100);
    await dPage.mouse.up();
    await dPage.waitForTimeout(800); // White canvas

    // Glide across spotlight in white mode
    if (navBox) {
      await dPage.mouse.move(navBox.x + 100, navBox.y + 20, { steps: 12 });
      await dPage.waitForTimeout(300);
      await dPage.mouse.move(navBox.x + 300, navBox.y + 20, { steps: 12 });
      await dPage.waitForTimeout(300);
    }

    // Toggle back to dark
    await dPage.mouse.move(themeBox.x + themeBox.width / 2, themeBox.y + themeBox.height / 2, { steps: 16 });
    await dPage.mouse.down();
    await dPage.waitForTimeout(100);
    await dPage.mouse.up();
    await dPage.waitForTimeout(600);
  }

  await dPage.close();
  await desktopContext.close();

  // Convert desktop video
  const dVideos = fs.readdirSync(desktopVideoDir).filter(f => f.endsWith('.webm'));
  if (dVideos.length > 0) {
    execSync(`ffmpeg -y -i "${path.join(desktopVideoDir, dVideos[0])}" -c:v libx264 -pix_fmt yuv420p -r 30 -b:v 2M "${path.join(dir, 'video-desktop.mp4')}"`);
    console.log('Saved video-desktop.mp4');
  }

  // ==========================================
  // 2. MOBILE RECORDING (390x844 iPhone View)
  // ==========================================
  console.log('--- [04] Recording Mobile Version ---');
  const mobileVideoDir = path.join(tempDir, 'mobile');
  fs.mkdirSync(mobileVideoDir);

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: mobileVideoDir, size: { width: 390, height: 844 } }
  });

  const mPage = await mobileContext.newPage();
  await mPage.goto(fileUrl);
  await mPage.waitForTimeout(600);

  // Screenshot Mobile
  await mPage.screenshot({ path: path.join(dir, 'screenshot-mobile.png') });
  console.log('Saved screenshot-mobile.png');

  try {
    await injectCursor(mPage);
    await mPage.mouse.move(195, 200);
    await mPage.waitForTimeout(400);

    // Tap Mobile Menu Toggle at top right
    const mNavBtn = await mPage.$('#mobileSpotlightBtn');
    const mnBox = await mNavBtn.boundingBox();
    if (mnBox) {
      await mPage.mouse.move(mnBox.x + mnBox.width / 2, mnBox.y + mnBox.height / 2, { steps: 16 });
      await mPage.waitForTimeout(250);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(800); // Mobile drawer opened!
    }

    // Hover through links in drawer
    const mLinks = await mPage.$$('#mobileSpotlightMenu a');
    for (const link of mLinks.slice(0, 3)) {
      const box = await link.boundingBox();
      if (box) {
        await mPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
        await mPage.waitForTimeout(350);
      }
    }

    // Tap theme toggle on mobile
    const mThemeBtn = await mPage.$('#themeToggleBtn');
    const mtBox = await mThemeBtn.boundingBox();
    if (mtBox) {
      await mPage.mouse.move(mtBox.x + mtBox.width / 2, mtBox.y + mtBox.height / 2, { steps: 16 });
      await mPage.waitForTimeout(200);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(800); // White canvas

      // Toggle theme back to Dark
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(600);
    }

    // Close mobile drawer
    if (mnBox) {
      const refreshedBtn = await mPage.$('#mobileSpotlightBtn');
      const rBox = await refreshedBtn.boundingBox();
      await mPage.mouse.move(rBox.x + rBox.width / 2, rBox.y + rBox.height / 2, { steps: 14 });
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(600);
    }

  } catch (err) {
    console.error('Error during 04 mobile recording:', err);
  }

  await mPage.close();
  await mobileContext.close();
  await browser.close();

  // Convert mobile video
  const mVideos = fs.readdirSync(mobileVideoDir).filter(f => f.endsWith('.webm'));
  if (mVideos.length > 0) {
    execSync(`ffmpeg -y -i "${path.join(mobileVideoDir, mVideos[0])}" -c:v libx264 -pix_fmt yuv420p -r 30 -b:v 2M "${path.join(dir, 'video-mobile.mp4')}"`);
    console.log('Saved video-mobile.mp4');
  }

  // Cleanup temp files
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('04 Desktop & Mobile assets recorded successfully!');
})();
