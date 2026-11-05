/* =========================================================
   DUNGEON TOWN — คณิตศาสตร์ top-down orthographic (แนวตรง)
   เปลี่ยนจาก isometric (เอียง) → มุมมองตรง ๆ แบบเกมเรโทร RPG
   (Final Fantasy / Dragon Quest) : tile สี่เหลี่ยมจัตุรัส ตัวละครหัน 4 ทิศ
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});
  var C = DT.CFG;

  /* ---------- ขนาด tile จริงในหน่วย pixel (อิง TILE_W) ---------- */
  DT.TILE_PX = 48;              /* กว้าง=สูง จัตุรัส (retro square tile) */
  DT.CELL = DT.TILE_PX;

  /* tile(x,y) -> พิกัดจอ (ไม่มีกล้อง) — orthographic ตรง ๆ */
  DT.iso = function (x, y) {
    return {
      sx: x * DT.TILE_PX,
      sy: y * DT.TILE_PX
    };
  };

  /* พิกัดจอ -> tile (คลิป/เลื่อนเมาส์) */
  DT.isoToTile = function (sx, sy) {
    return {
      x: sx / DT.TILE_PX,
      y: sy / DT.TILE_PX
    };
  };

  /* ระยะแบบยูคลิดในพิกัด tile */
  DT.dist = function (ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  };

  /* เรียงตาม depth — มุมมองตรง: แถวยิ่งลง (y ใหญ่) ยิ่งอยู่หน้า */
  DT.depth = function (e) { return e.y; };

  /* เดินเร็ว/ช้าตามความเร็วเดินจริง */
  DT.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  /* เวลาเกม 0..1 -> ชั่วโมง 0..24 */
  DT.gameHour = function (t) { return Math.floor((t % 1) * 24); };
  DT.isNight = function (t) {
    var h = DT.gameHour(t);
    return h >= 19 || h < 6;
  };
})(window);
