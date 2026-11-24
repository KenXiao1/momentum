import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: Number(process.argv[2] || 1) });
const page = await ctx.newPage();
await page.setContent(`<html><body style="margin:0;background:#0b0c10"><canvas id=c width=1920 height=1080 style="position:absolute"></canvas>
<div id=t style="position:absolute;bottom:80px;width:100%;text-align:center;color:#eee;font:500 38px 'PingFang SC'">晚上七点。你刚吃完饭，坐在书桌前。</div></body></html>`);
const cdp = await ctx.newCDPSession(page);
const N = 60; const t0 = Date.now();
for (let i = 0; i < N; i++) {
  await page.evaluate((i) => { const c = document.getElementById('c').getContext('2d'); c.clearRect(0,0,1920,1080); for (let k=0;k<200;k++){c.strokeStyle='hsl('+(k*7+i)+',60%,60%)';c.beginPath();c.arc(960+Math.cos(k+i/10)*400,540+Math.sin(k*1.3)*300,20+k%30,0,6.28);c.stroke();} document.getElementById('t').style.opacity = (i%30)/30; }, i);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
  if (i === 0) console.log('bytes', data.length);
}
console.log('ms/frame', (Date.now() - t0) / N);
await browser.close();
