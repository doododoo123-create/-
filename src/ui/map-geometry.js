// Shared edges keep the exact cardinal adjacency of the editable grid.
// This only draws the world; it never generates territory ownership or changes game rules.
export const ATLAS_WIDTH = 1200;
export const ATLAS_HEIGHT = 800;
export function visualHash(a, b, salt = 0) {
  const value = Math.imul(a + 37, 374761393) ^ Math.imul(b + 91, 668265263) ^ Math.imul(salt + 1, 1274126177);
  return ((Math.imul(value ^ (value >>> 13), 1274126177) ^ (value >>> 16)) >>> 0) / 4294967296;
}
const pairKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
export function buildMapGeometry(rows, cols) {
  const points = [], mids = new Map();
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const u = col / cols, v = row / rows;
    const extent = 1000 - 155 * Math.cos((v - 0.48) * Math.PI * 1.7);
    const x = 600 + (u - .5) * extent + 45 * Math.sin(v * 5.5) + (visualHash(row, col, 1) - .5) * (780 / cols) * .28;
    const y = 410 + (v - .5) * 555 + 30 * Math.sin(u * 7.2 + .8) + (visualHash(row, col, 2) - .5) * (500 / rows) * .3;
    points.push([Number(x.toFixed(2)), Number(y.toFixed(2))]);
  }
  const vertex = (r, c) => r * (cols + 1) + c;
  function middle(a, b) {
    const key = pairKey(a, b); if (mids.has(key)) return mids.get(key);
    const [x1, y1] = points[a], [x2, y2] = points[b];
    const bend = (visualHash(Math.min(a,b), Math.max(a,b), 3) - .5) * .22;
    const result = [Number(((x1 + x2) / 2 - (y2 - y1) * bend).toFixed(2)), Number(((y1 + y2) / 2 + (x2 - x1) * bend).toFixed(2))];
    mids.set(key, result); return result;
  }
  function path(ids, closed = true) {
    const coords = [points[ids[0]]];
    for (let i = 1; i < ids.length; i++) coords.push(middle(ids[i - 1], ids[i]), points[ids[i]]);
    if (closed) coords.push(middle(ids.at(-1), ids[0]));
    return 'M' + coords.map(p => p.join(',')).join(' L') + (closed ? ' Z' : '');
  }
  const cells = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const vertices = [vertex(row,col),vertex(row,col+1),vertex(row+1,col+1),vertex(row+1,col)];
    const center = [0,1].map(axis => Number((vertices.reduce((sum, i) => sum + points[i][axis], 0) / 4).toFixed(2)));
    cells.push({ row, col, center, vertices, path: path(vertices) });
  }
  const coast = [];
  for (let c=0;c<=cols;c++) coast.push(vertex(0,c));
  for (let r=1;r<=rows;r++) coast.push(vertex(r,cols));
  for (let c=cols-1;c>=0;c--) coast.push(vertex(rows,c));
  for (let r=rows-1;r>0;r--) coast.push(vertex(r,0));
  return { width: ATLAS_WIDTH, height: ATLAS_HEIGHT, cells, coastPath: path(coast), edgePath: (a,b) => path([a,b],false) };
}
