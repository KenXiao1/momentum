import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const fams = ['PingFang SC','Songti SC','STSong','Hiragino Sans GB','Kaiti SC','STKaiti','Heiti SC','New York','Iowan Old Style','Baskerville','Didot','Hoefler Text','Palatino','Avenir Next','Helvetica Neue','SF Pro Display','SF Pro Text','system-ui','Optima','Charter','Big Caslon','Bodoni 72','Cochin','Seravek','Gill Sans','Futura','Menlo','SF Mono','Times New Roman','Georgia','Superclarendon','Athelas','Canela'];
const res = await page.evaluate((fams) => {
  const c = document.createElement('canvas').getContext('2d');
  const out = {};
  for (const f of fams) {
    const w = (font) => { c.font = font; return c.measureText('自制力 Engineering the Will 0123').width; };
    const a = w(`40px "${f}", monospace`), b = w('40px monospace');
    const a2 = w(`40px "${f}", serif`), b2 = w('40px serif');
    out[f] = (a !== b || a2 !== b2) ? 'yes' : 'no';
  }
  return out;
}, fams);
console.log(res);
await browser.close();
