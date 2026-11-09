import React, { useId } from 'react';

const DIMENSIONS = [
  { key: 'BACKEND', label: 'Backend', angle: -Math.PI / 2 },
  { key: 'FRONTEND', label: 'Frontend', angle: -Math.PI / 6 },
  { key: 'DATABASE', label: 'Database', angle: Math.PI / 6 },
  { key: 'DEVOPS_CLOUD', label: 'DevOps & Cloud', angle: Math.PI / 2 },
  { key: 'TESTING', label: 'Testing / QA', angle: (5 * Math.PI) / 6 },
  { key: 'ARCHITECTURE', label: 'Architecture', angle: (-5 * Math.PI) / 6 },
];

export default function TechRadarChart({ scores = {}, size = 300 }) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `radarGrad-${uid}`;
  const glowId = `radarGlow-${uid}`;
  const center = size / 2;
  const radius = size * 0.36;

  // Tính tọa độ theo góc và bán kính
  const getCoordinates = (angle, r) => {
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Các vòng đa giác lưới (25%, 50%, 75%, 100%)
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Tọa độ các điểm polygon điểm số của người dùng
  const polygonPoints = DIMENSIONS.map((dim) => {
    const rawVal = scores[dim.key] || 0;
    const clampedVal = Math.max(0, Math.min(100, rawVal));
    const pointRadius = (clampedVal / 100) * radius;
    const { x, y } = getCoordinates(dim.angle, pointRadius);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex flex-col items-center justify-center p-3">
      <svg width={size} height={size} className="overflow-visible select-none drop-shadow-xs">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Vùng sáng nhẹ ở tâm */}
        <circle cx={center} cy={center} r={radius} fill={`url(#${glowId})`} />

        {/* Các vòng đa giác lưới */}
        {rings.map((ringScale, idx) => {
          const ringPoints = DIMENSIONS.map((dim) => {
            const { x, y } = getCoordinates(dim.angle, radius * ringScale);
            return `${x},${y}`;
          }).join(' ');

          return (
            <polygon
              key={idx}
              points={ringPoints}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={idx === rings.length - 1 ? '1.5' : '1'}
              strokeDasharray={idx < rings.length - 1 ? '2 2' : 'none'}
            />
          );
        })}

        {/* Các tia trục toả ra từ tâm */}
        {DIMENSIONS.map((dim, idx) => {
          const { x, y } = getCoordinates(dim.angle, radius);
          return (
            <line
              key={idx}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#cbd5e1"
              strokeWidth="1"
            />
          );
        })}

        {/* Đa giác thể hiện năng lực */}
        <polygon
          points={polygonPoints}
          fill={`url(#${gradientId})`}
          stroke="#1d4ed8"
          strokeWidth="2.5"
          className="transition-all duration-700 ease-out"
        />

        {/* Các chấm tròn đỉnh và nhãn */}
        {DIMENSIONS.map((dim, idx) => {
          const rawVal = scores[dim.key] || 0;
          const clampedVal = Math.max(0, Math.min(100, rawVal));
          const pointRadius = (clampedVal / 100) * radius;
          const { x, y } = getCoordinates(dim.angle, pointRadius);

          // Vị trí text nhãn
          const labelDist = radius + 24;
          const labelPos = getCoordinates(dim.angle, labelDist);

          return (
            <g key={idx}>
              {/* Chấm tròn đỉnh */}
              <circle
                cx={x}
                cy={y}
                r="4.5"
                fill="#ffffff"
                stroke="#1d4ed8"
                strokeWidth="2.5"
                className="transition-all duration-700 ease-out"
              />

              {/* Nhãn chiều năng lực */}
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[11px] font-bold fill-slate-700"
              >
                {dim.label}
              </text>
              <text
                x={labelPos.x}
                y={labelPos.y + 12}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[10px] font-semibold fill-blue-700 tabular"
              >
                {Math.round(clampedVal)} điểm
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

