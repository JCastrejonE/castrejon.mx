// Prim's minimum spanning tree over a handful of points (O(n^2), n <= ~30).
// Returns edges as index pairs plus the total length.
export function minimumSpanningTree(points) {
  const n = points.length;
  if (n < 2) return { edges: [], length: 0 };
  const inTree = new Uint8Array(n);
  const best = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  best[0] = 0;
  const edges = [];
  let length = 0;
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
    inTree[u] = 1;
    if (parent[u] >= 0) {
      edges.push([parent[u], u]);
      length += best[u];
    }
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const d = Math.hypot(points[u].x - points[v].x, points[u].y - points[v].y);
      if (d < best[v]) {
        best[v] = d;
        parent[v] = u;
      }
    }
  }
  return { edges, length };
}
