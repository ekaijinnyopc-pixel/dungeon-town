/* รวมเกมทั้งหมดเป็นไฟล์ HTML ไฟล์เดียว (เล่นออฟไลน์ได้)
   ใช้: node tools/build-single.js
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

let html = read('index.html');

/* 1) ฝัง CSS (รองรับ cache-bust ?v=...) */
html = html.replace(/<link rel="stylesheet" href="css\/style\.css(?:\?[^"]*)?">/,
  '<style>\n' + read('css/style.css') + '\n</style>');

/* 2) ฝัง JS ตามลำดับ */
const order = [
  'supabase.js',
  'js/config.js',
  'js/path.js',
  'js/iso.js',
  'js/art.js',
  'js/audio.js',
  'js/fx.js',
  'js/interiors.js',
  'js/world.js',
  'js/refine.js',
  'js/player.js',
  'js/render.js',
  'js/supabase-config.js',
  'js/net.js',
  'js/party.js',
  'js/market.js',
  'js/ui-popup.js',
  'js/game.js'
];
let bundle = '';
for (const f of order) {
  let code = read(f);
  /* supabase.js เป็น webpack bundle: ตอนฝังเป็น inline <script> มันหา currentScript.src ไม่เจอ
     ทำให้โยน "Automatic publicPath is not supported" แล้วทั้งไฟล์พัง
     -> ใส่ fallback ให้ใช้ document.baseURI แทน */
  if (f === 'supabase.js') {
    const before = 'if(!e)throw new Error("Automatic publicPath is not supported in this browser");';
    if (code.indexOf(before) === -1) {
      console.warn('⚠️ ไม่พบจุด publicPath ใน supabase.js (อาจอัปเดตไลบรารี)');
    } else {
      code = code.replace(before,
        'if(!e)e=(document&&document.baseURI)||(self.location&&self.location.href)||"./";');
    }
  }
  bundle += '\n/* ===== ' + f + ' ===== */\n' + code + '\n';
}
html = html.replace(/<script src="supabase\.js(?:\?[^"]*)?"><\/script>[\s\S]*?<script src="js\/game\.js(?:\?[^"]*)?"><\/script>/,
  '<script>\n' + bundle + '\n</script>');
const leftover = html.match(/<script src="[^"]+"><\/script>/g) || [];
if (leftover.length) {
  console.warn('⚠️ ยังเหลือ script src ที่ไม่ได้ฝัง: ' + leftover.join(', '));
}

const out = path.join(ROOT, 'dist', 'dungeon-town.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('เขียนไฟล์:', out, '(' + Math.round(html.length / 1024) + ' KB)');
