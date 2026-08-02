import { useEffect, useRef } from "react";

/** Blue + dark gold palette with glow */
const BLUES = [
  [30, 90, 200],
  [55, 130, 235],
  [90, 165, 255],
  [20, 60, 140],
];

const GOLDS = [
  [180, 140, 20],
  [210, 165, 35],
  [160, 120, 15],
  [230, 185, 50],
];

const PHI = Math.PI * (3 - Math.sqrt(5));

function pickColor() {
  const pool = Math.random() < 0.55 ? BLUES : GOLDS;
  return pool[(Math.random() * pool.length) | 0];
}

function fibonacciSphere(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = PHI * i;
    const x = Math.cos(theta) * ring;
    const z = Math.sin(theta) * ring;
    const tube = Math.sqrt(x * x + z * z);
    if (tube < 0.34) continue;
    const s = 0.84 + Math.random() * 0.14;
    pts.push({
      x: x * s,
      y: y * s,
      z: z * s,
      color: pickColor(),
    });
  }
  return pts;
}

function drawGlowDot(ctx, sx, sy, radius, color, alpha) {
  const [r, g, b] = color;

  ctx.save();
  ctx.shadowBlur = radius * 5;
  ctx.shadowColor = `rgba(${r},${g},${b},${alpha * 0.85})`;
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.35})`;
  ctx.beginPath();
  ctx.arc(sx, sy, radius * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowBlur = radius * 2.2;
  ctx.shadowColor = `rgba(${r},${g},${b},${alpha})`;
  ctx.fillStyle = `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 30)},${Math.min(0.95, alpha + 0.15)})`;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function ParticleBubble({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    const points = fibonacciSphere(1700);
    let w = 0;
    let h = 0;
    let rotY = 0;
    let raf = 0;

    const resize = () => {
      const box = canvas.parentElement;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box?.clientWidth || 800;
      h = box?.clientHeight || 600;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      rotY += 0.001;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.38;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      const batch = [];

      for (const p of points) {
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y1 = p.y;

        const depth = z1 + 2.1;
        const persp = R / depth;
        const sx = cx + x1 * persp;
        const sy = cy + y1 * persp;

        const alpha = 0.45 + 0.35 * ((z1 + 1) / 2);
        const radius = Math.max(0.9, Math.min(2.1, 1.2 * persp * 0.045));

        batch.push({ sx, sy, z1, alpha, radius, color: p.color });
      }

      batch.sort((a, b) => a.z1 - b.z1);

      for (const d of batch) {
        drawGlowDot(ctx, d.sx, d.sy, d.radius, d.color, Math.min(0.88, d.alpha));
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full ${className}`}
    />
  );
}
