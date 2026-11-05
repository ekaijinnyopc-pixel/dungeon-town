/* =========================================================
   DUNGEON TOWN — pathfinding (คลิกขวาเพื่อเดินไป)
   BFS บนตาราง tile 48×48 = เร็วมาก
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});

  function walkable(map, x, y) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    return DT.WALKABLE[map.grid[y * map.w + x]] === true;
  }

  /* หา tile ที่เดินได้ใกล้ที่สุด (ถ้าคลิกที่กำแพง/น้ำ) */
  function nearestWalkable(map, gx, gy) {
    if (walkable(map, gx, gy)) return { x: gx, y: gy };
    for (var r = 1; r <= 6; r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (walkable(map, gx + dx, gy + dy)) return { x: gx + dx, y: gy + dy };
        }
      }
    }
    return null;
  }

  DT.Path = {
    walkable: walkable,
    nearestWalkable: nearestWalkable,

    /* คืนเส้นทางเป็น array ของ waypoint {x,y} (ไม่รวมจุดเริ่ม) */
    find: function (map, sx, sy, tx, ty) {
      var W = map.w, H = map.h;
      var s = { x: Math.floor(sx), y: Math.floor(sy) };
      var g = nearestWalkable(map, Math.floor(tx), Math.floor(ty));
      if (!g) return null;
      if (!walkable(map, s.x, s.y)) {
        var s2 = nearestWalkable(map, s.x, s.y);
        if (!s2) return null;
        s = s2;
      }
      if (s.x === g.x && s.y === g.y) return [];

      var prev = new Int32Array(W * H).fill(-1);
      var seen = new Uint8Array(W * H);
      var queue = [s.y * W + s.x];
      var head = 0;
      seen[queue[0]] = 1;
      var goal = g.y * W + g.x;
      var found = false;

      while (head < queue.length) {
        var cur = queue[head++];
        if (cur === goal) { found = true; break; }
        var cx = cur % W, cy = (cur - cx) / W;
        /* 4 ทิศทาง (เดินแนวตั้ง/นอน ดูเป็น isometric) */
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var i = 0; i < dirs.length; i++) {
          var nx = cx + dirs[i][0], ny = cy + dirs[i][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          var ni = ny * W + nx;
          if (seen[ni]) continue;
          if (!walkable(map, nx, ny)) continue;
          seen[ni] = 1;
          prev[ni] = cur;
          queue.push(ni);
        }
      }
      if (!found) return null;

      /* ย้อนกลับมาสร้างเส้นทาง */
      var out = [];
      var node = goal;
      while (node !== -1 && node !== queue[0]) {
        var nx2 = node % W, ny2 = (node - nx2) / W;
        out.push({ x: nx2 + 0.5, y: ny2 + 0.5 });
        node = prev[node];
        if (out.length > 4000) break;
      }
      out.reverse();
      return out;
    }
  };
})(window);
