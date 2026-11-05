/* ทดสอบว่า Supabase Realtime broadcast ใช้ได้กับ anon key โดยไม่ต้องมีตารางไหม
   ใช้: node tools/test-realtime.js
   หมายเหตุ: broadcast ไม่ส่งกลับตัวส่ง (self:false เป็นค่าเริ่มต้น) -> ต้องเปิด 2 connection
*/
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'supabase-config.js'), 'utf8');
const URL = (src.match(/DT_SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
const KEY = (src.match(/DT_SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];
if (!URL || !KEY) { console.log('❌ อ่าน config ไม่ได้'); process.exit(1); }

function connect(name, onMsg) {
  const wsUrl = URL.replace(/^https/, 'wss') + '/realtime/v1?apikey=' + KEY + '&vsn=1.0.0';
  const ws = new WebSocket(wsUrl);
  const st = { name, ws, joined: false };
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ topic: 'realtime:dungeon-town-test', event: 'phx_join', payload: { config: { broadcast: { ack: false, self: false } } }, ref: '1' }));
  });
  ws.addEventListener('message', ev => {
    let msg; try { msg = JSON.parse(String(ev.data)); } catch (e) { return; }
    if (msg.event === 'phx_reply' && msg.topic === 'realtime:dungeon-town-test') {
      if (msg.payload && msg.payload.status === 'ok') {
        st.joined = true;
        console.log('✅ ' + name + ' subscribe สำเร็จ');
        if (onMsg) onMsg(st);
      } else {
        console.log('❌ ' + name + ' subscribe ไม่สำเร็จ:', JSON.stringify(msg.payload));
      }
    }
    /* ข้อความที่ client อื่นส่ง: msg.payload = { type:'broadcast', event:'state', payload:{...} }
       -> ของจริงอยู่ที่ msg.payload.payload (ไม่ต้องซ้อน 3 ชั้น) */
    if (msg.event === 'broadcast' && msg.payload && msg.payload.payload) {
      console.log('📨 ' + name + ' ได้รับ broadcast:', JSON.stringify(msg.payload.payload));
      if (onMsg) onMsg(st, msg);
    }
  });
  ws.addEventListener('error', e => console.log('❌ ' + name + ' ws error:', e.message || 'unknown'));
  return st;
}

const a = connect('clientA', (st) => {
  if (st.name === 'clientA' && st.joined && !st.sent) {
    st.sent = true;
    setTimeout(() => {
      st.ws.send(JSON.stringify({ topic: 'realtime:dungeon-town-test', event: 'broadcast', payload: { type: 'broadcast', event: 'state', payload: { t: 'state', x: 1, y: 2, name: 'ping' } }, ref: '2' }));
      console.log('📤 clientA ส่ง broadcast แล้ว');
    }, 300);
  }
});
const b = connect('clientB');

let got = false;
setTimeout(() => {
  console.log('\nผล: ' + (got ? '✅ Realtime broadcast ใช้ได้ (ไม่ต้องมีตาราง)' : '❌ broadcast ไม่ผ่าน'));
  try { a.ws.close(); b.ws.close(); } catch (e) {}
  process.exit(got ? 0 : 1);
}, 12000);

// จับผลจาก log
const origLog = console.log;
console.log = function () {
  const s = Array.from(arguments).join(' ');
  if (s.indexOf('ได้รับ broadcast') >= 0) got = true;
  origLog.apply(console, arguments);
};
