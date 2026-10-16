const deg = (d) => (d * Math.PI) / 180;

/**
 * Parameter sets tuned for distinct looks. Distances are in grid cells, angles in radians.
 * repel: how strongly each species is pushed away from the other species' trails.
 */
export const PRESETS = [
  {
    name: 'Mycelium',
    sensorAngle: deg(30), sensorDist: 9, turn: deg(28), speed: 1.1,
    deposit: 3.5, decay: 0.9, diffuse: 0.25, repel: 0.7, jitter: 0.04, foodWeight: 1,
    spawn: 'disc', colors: ['#ffb45a', '#39e6d0', '#ff4f9a'], background: '#06060b',
  },
  {
    name: 'Coral',
    sensorAngle: deg(40), sensorDist: 14, turn: deg(18), speed: 1.2,
    deposit: 4, decay: 0.93, diffuse: 0.3, repel: 0.9, jitter: 0.25, foodWeight: 1,
    spawn: 'clusters', colors: ['#ff6b5a', '#ffd166', '#5ab8ff'], background: '#07050a',
  },
  {
    name: 'Neural',
    sensorAngle: deg(22.5), sensorDist: 12, turn: deg(45), speed: 1.3,
    deposit: 2.5, decay: 0.88, diffuse: 0.3, repel: 0.25, jitter: 0.03, foodWeight: 1.2,
    spawn: 'ring', colors: ['#8a7dff', '#4fd6ff', '#e7f7ff'], background: '#04040a',
  },
  {
    name: 'Territories',
    sensorAngle: deg(60), sensorDist: 6, turn: deg(35), speed: 1.3,
    deposit: 5, decay: 0.92, diffuse: 0.5, repel: 2.2, jitter: 0.05, foodWeight: 0.8,
    spawn: 'random', colors: ['#ff3d6e', '#39ff9a', '#3d8bff'], background: '#050508',
  },
  {
    name: 'Nebula',
    sensorAngle: deg(80), sensorDist: 25, turn: deg(12), speed: 1.4,
    deposit: 2, decay: 0.975, diffuse: 0.9, repel: 0.5, jitter: 0.12, foodWeight: 1.5,
    spawn: 'ring', colors: ['#ff7ad9', '#7af0ff', '#ffe27a'], background: '#08040c',
  },
].map((p) => Object.freeze({ ...p, colors: Object.freeze([...p.colors]) }));
