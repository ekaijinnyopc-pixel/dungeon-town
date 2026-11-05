/* เทสต์ระบบปาร์ตี้ (js/party.js) — รันบน Node ไม่ต้องเบราว์เซอร์
   ใช้ vm โหลด party.js แยกทีละ "ผู้เล่น" แล้วเดินสายข้อความระหว่างกัน
   รัน: node tools/test-party.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'party.js'), 'utf8');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

/* ---------- สร้างกลุ่มผู้เล่นจำลอง (แต่ละคนมี DT.Party ของตัวเอง) ---------- */
function makeGroup(specs) {
  const clients = [];
  for (const spec of specs) {
    const id = spec.id, name = spec.name || id;
    const ctx = { console: console };
    ctx.window = ctx;
    ctx.DT = {};

    const net = {
      clientId: id,
      sent: [],
      send: function (msg) {
        msg.id = id; /* net.js จริงจะเขียน msg.id = CLIENT_ID เหมือนกัน */
        net.sent.push(JSON.parse(JSON.stringify(msg)));
        for (const c of clients) {
          if (c.id !== id) c.party.handleMsg(msg);
        }
      }
    };
    ctx.DT.Net = net;
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx, { filename: 'party.js' });

    const client = { id: id, name: name, ctx: ctx, net: net, party: ctx.DT.Party };
    client.party.setSelf({
      id: id, name: name, prof: spec.prof || 'miner',
      level: spec.level || 1, hp: spec.hp || 100, maxHp: spec.maxHp || 100, alive: true
    });
    clients.push(client);
  }
  const by = {};
  for (const c of clients) by[c.id] = c;
  return {
    clients: clients,
    get: function (id) { return by[id]; },
    /* ดึงข้อความที่ส่งออกทั้งหมดของ id */
    sent: function (id) { return by[id].net.sent; },
    ops: function (id) { return by[id].net.sent.map(m => m.op); }
  };
}

/* ---------- 1) invite -> accept -> 2 คน ---------- */
console.log('== เชิญ -> ตอบรับ -> สมาชิก 2 คน ==');
{
  const g = makeGroup([{ id: 'A', name: 'อา' }, { id: 'B', name: 'บี' }]);
  const A = g.get('A'), B = g.get('B');
  let chA = 0, chB = 0;
  A.party.onChange = function () { chA++; };
  B.party.onChange = function () { chB++; };

  ok(A.party.members.length === 1 && A.party.members[0].id === 'A', 'ตัวเองเป็นสมาชิกคนแรกตอนเริ่ม');
  ok(A.party.invite('B', 'บี') === true, 'A เชิญ B สำเร็จ');
  ok(B.party.invites.length === 1, 'B ได้รับคำเชิญ 1 รายการ');
  ok(B.party.invites[0].name === 'บี' || B.party.invites[0].from === 'A', 'คำเชิญเก็บชื่อ/ผู้เชิญถูกต้อง');
  ok(g.ops('A').indexOf('invite') >= 0, 'ส่ง op=invite ออกไปจริง');

  const invId = B.party.invites[0].id;
  ok(B.party.accept(invId) === true, 'B กด accept สำเร็จ');
  ok(B.party.invites.length === 0, 'หลัง accept คำเชิญหายไป');
  ok(A.party.members.length === 2, 'A เห็นสมาชิก 2 คน');
  ok(B.party.members.length === 2, 'B เห็นสมาชิก 2 คน');
  ok(A.party.members[0].id === 'A', 'ฝั่ง A: ตัวเองยังอยู่คนแรก');
  ok(B.party.members[0].id === 'B', 'ฝั่ง B: ตัวเองยู่คนแรก');
  ok(A.party.isMember('B') === true && B.party.isMember('A') === true, 'isMember คืนค่าถูกต้อง');
  ok(A.party.isInParty('B') === true && A.party.isInParty('A') === false, 'isInParty นับเฉพาะสมาชิกร่วมทาง');
  ok(A.party.leaderId() === 'A' && B.party.leaderId() === 'A', 'หัวหน้าปาร์ตี้ = คนเชิญ (ทั้งสองฝั่งตรงกัน)');
  ok(chA > 0 && chB > 0, 'onChange ถูกเรียกทั้งสองฝั่ง');
  const info = A.party.membersInfo();
  ok(info.length === 2 && info[0].id === 'A' && typeof info[1].hp === 'number', 'membersInfo คืนข้อมูลสมาชิกครบ');
}

/* ---------- 2) ปาร์ตี้เต็ม 4 คน -> คนที่ 5 เข้าไม่ได้ ---------- */
console.log('\n== ปาร์ตี้เต็ม 4 คน -> คนที่ 5 เข้าไม่ได้ ==');
{
  const g = makeGroup([
    { id: 'A', name: 'อา' }, { id: 'B', name: 'บี' },
    { id: 'C', name: 'ซี' }, { id: 'D', name: 'ดี' }, { id: 'E', name: 'อี' }
  ]);
  const A = g.get('A'), B = g.get('B'), C = g.get('C'), D = g.get('D'), E = g.get('E');

  ok(A.party.invite('B', 'บี') && B.party.accept(B.party.invites[0].id), 'สมาชิกคนที่ 2 เข้าร่วม');
  ok(A.party.invite('C', 'ซี') && C.party.accept(C.party.invites[0].id), 'สมาชิกคนที่ 3 เข้าร่วม');
  ok(A.party.invite('D', 'ดี') && D.party.accept(D.party.invites[0].id), 'สมาชิกคนที่ 4 เข้าร่วม');
  ok(A.party.members.length === 4, 'A มีสมาชิกครบ 4 คน');
  ok(D.party.members.length === 4, 'ฝั่งสมาชิกคนที่ 4 เห็นสมาชิกครบ 4 คน');
  ok(A.party.leaderId() === 'A', 'หัวหน้ายังเป็น A');

  /* เต็มแล้ว: ส่งคำเชิญไม่ได้ */
  ok(A.party.invite('E', 'อี') === false, 'ปาร์ตี้เต็ม -> เชิญคนที่ 5 ไม่ได้');
  ok(E.party.invites.length === 0, 'คนที่ 5 ไม่ได้รับคำเชิญ');

  /* ถ้ามีคำเชิญหลุดมา (count = 4) -> กด accept ก็ต้องไม่ได้ */
  E.party.handleMsg({ t: 'party', op: 'invite', id: 'A', to: 'E', pid: 'E', name: 'อา', prof: 'miner', count: 4, leader: 'A' });
  ok(E.party.invites.length === 1, 'คนที่ 5 ได้รับคำเชิญที่หลุดมา');
  const badInv = E.party.invites[0].id;
  ok(E.party.accept(badInv) === false, 'ปาร์ตี้เต็ม -> accept ไม่ได้');
  ok(E.party.members.length === 1, 'คนที่ 5 ยังอยู่คนเดียว');
  ok(A.party.members.length === 4, 'ฝั่งหัวหน้ายังมี 4 คน ไม่มีคนที่ 5');

  /* ฝั่งหัวหน้า: ปฏิเสธ accept ที่หลุดมาเอง */
  A.party.handleMsg({ t: 'party', op: 'accept', id: 'E', to: 'A', name: 'อี', prof: 'miner', level: 1, hp: 100, maxHp: 100, alive: true });
  ok(A.party.members.length === 4, 'หัวหน้าปฏิเสธคนที่ 5 ที่ส่ง accept เอง');
  ok(E.party.members.length === 1, 'คนที่ 5 ถูกปฏิเสธแล้วกลับมาอยู่คนเดียว');

  /* ปาร์ตี้เดียวต่อ 1 คน: B อยู่ในปาร์ตี้แล้ว รับคำเชิญใหม่ไม่ได้ */
  B.party.handleMsg({ t: 'party', op: 'invite', id: 'E', to: 'B', pid: 'B', name: 'อี', prof: 'miner', count: 1, leader: 'E' });
  ok(B.party.invites.length === 0, 'อยู่ในปาร์ตี้แล้ว -> ไม่รับคำเชิญใหม่');
}

/* ---------- 3) leave -> เหลือ 1 คน ---------- */
console.log('\n== ออกจากปาร์ตี้ -> เหลือ 1 คน ==');
{
  const g = makeGroup([{ id: 'A', name: 'อา' }, { id: 'B', name: 'บี' }]);
  const A = g.get('A'), B = g.get('B');
  A.party.invite('B', 'บี');
  B.party.accept(B.party.invites[0].id);
  ok(A.party.members.length === 2 && B.party.members.length === 2, 'เริ่มต้นมี 2 คน');

  ok(B.party.leave() === true, 'B ออกจากปาร์ตี้ได้');
  ok(A.party.members.length === 1, 'ฝั่ง A เหลือสมาชิก 1 คน');
  ok(A.party.members[0].id === 'A', 'ที่เหลือคือ A');
  ok(A.party.isMember('B') === false, 'B ถูกลบออกจากรายชื่อของ A');
  ok(B.party.members.length === 1, 'ฝั่ง B เหลือตัวเอง 1 คน');
  ok(A.party.leaderId() === null, 'ปาร์ตี้เดี่ยวไม่มีหัวหน้า');
  ok(g.ops('B').indexOf('leave') >= 0, 'ส่ง op=leave ออกไปจริง');
  ok(B.party.leave() === false, 'อยู่คนเดียวแล้วออกไม่ได้ (ไม่ error)');
}

/* ---------- 4) handleMsg('invite') -> เกิด invites + onChange ---------- */
console.log('\n== handleMsg ของ invite -> เกิดรายการคำเชิญ ==');
{
  const g = makeGroup([{ id: 'A', name: 'อา' }, { id: 'B', name: 'บี' }]);
  const B = g.get('B');
  let ch = 0;
  B.party.onChange = function () { ch++; };

  B.party.handleMsg({ t: 'party', op: 'invite', id: 'A', to: 'B', pid: 'B', name: 'อา', prof: 'hunter', count: 1, leader: 'A' });
  ok(B.party.invites.length === 1, 'handleMsg invite -> เกิด invites');
  ok(B.party.invites[0].name === 'อา', 'เก็บชื่อผู้เชิญถูกต้อง');
  ok(B.party.invites[0].prof === 'hunter', 'เก็บอาชีพผู้เชิญถูกต้อง');
  ok(B.party.invites[0].from === 'A', 'เก็บ id ผู้เชิญถูกต้อง');
  ok(ch === 1, 'onChange ถูกเรียก 1 ครั้ง (ได้ ' + ch + ')');

  /* ข้อความอื่นที่ไม่ใช่ปาร์ตี้ ต้องไม่กระทบอะไร */
  const before = B.party.invites.length;
  B.party.handleMsg({ t: 'state', id: 'A', x: 1, y: 2 });
  B.party.handleMsg({ t: 'party', op: 'chat', id: 'A' });
  ok(B.party.invites.length === before, 'ข้อความแปลก/ไม่รู้จัก ไม่ทำให้ state เพี้ยน');
}

/* ---------- 5) update -> อัปเดตเลือด/เลเวลของสมาชิก ---------- */
console.log('\n== update -> อัปเดตเลือด/เลเวลสมาชิก ==');
{
  const g = makeGroup([{ id: 'A', name: 'อา' }, { id: 'B', name: 'บี' }]);
  const A = g.get('A'), B = g.get('B');
  A.party.invite('B', 'บี');
  B.party.accept(B.party.invites[0].id);

  A.party.setSelf({ id: 'A', name: 'อา', prof: 'miner', level: 3, hp: 42, maxHp: 120, alive: true });
  A.party.updateSelf();
  const idx = B.party.members.map(m => m.id).indexOf('A');
  ok(idx >= 0, 'A อยู่ในรายชื่อของ B');
  ok(B.party.members[idx].hp === 42, 'B เห็น HP ของ A ตรงกัน');
  ok(B.party.members[idx].level === 3, 'B เห็นเลเวลของ A ตรงกัน');
}

/* ---------- 6) สมาชิกใหม่ได้รับรายชื่อทั้งปาร์ตี้ผ่าน sync ---------- */
console.log('\n== sync -> ผู้เข้าใหม่ได้รายชื่อสมาชิกทั้งปาร์ตี้ ==');
{
  const g = makeGroup([
    { id: 'A', name: 'อา' }, { id: 'B', name: 'บี' }, { id: 'C', name: 'ซี' }
  ]);
  const A = g.get('A'), B = g.get('B'), C = g.get('C');
  A.party.invite('B', 'บี'); B.party.accept(B.party.invites[0].id);
  A.party.invite('C', 'ซี'); C.party.accept(C.party.invites[0].id);
  ok(C.party.members.length === 3, 'ผู้เข้าใหม่เห็นสมาชิกครบ 3 คน (ได้รายชื่อจาก sync)');
  ok(C.party.members.map(m => m.id).indexOf('B') >= 0, 'ผู้เข้าใหม่เห็นชื่อสมาชิกคนอื่นด้วย');
  ok(C.party.leaderId() === 'A', 'ผู้เข้าใหม่รู้ว่าใครเป็นหัวหน้า');
  ok(g.ops('C').indexOf('sync') >= 0, 'ผู้เข้าใหม่ส่งคำขอ sync ทันทีหลัง accept');
}

/* ---------- 7) API ครบตามที่กำหนด ---------- */
console.log('\n== API ครบ ==');
{
  const g = makeGroup([{ id: 'A', name: 'อา' }]);
  const P = g.get('A').party;
  const need = ['isInParty', 'isMember', 'leaderId', 'invite', 'accept', 'decline',
    'leave', 'handleMsg', 'send', 'membersInfo'];
  let missing = [];
  for (const k of need) if (typeof P[k] !== 'function') missing.push(k);
  ok(missing.length === 0, 'มีฟังก์ชันครบทุกตัว' + (missing.length ? ' (ขาด: ' + missing.join(',') + ')' : ''));
  ok(P.MAX === 4, 'MAX = 4');
  ok(Array.isArray(P.members) && Array.isArray(P.invites), 'members/invites เป็น array');
  ok('onChange' in P, 'มี onChange');
}

console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
process.exit(fail ? 1 : 0);
