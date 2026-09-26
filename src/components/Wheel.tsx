import { categories } from "../lib/schema";
import { categoryColors, categoryIcons } from "./Icons";
export function Wheel({
  rotation,
  spinning,
  selected,
}: {
  rotation: number;
  spinning: boolean;
  selected: string | null;
}) {
  const point = (angle: number, radius: number) => ({
    x: 250 + radius * Math.cos((angle * Math.PI) / 180),
    y: 250 + radius * Math.sin((angle * Math.PI) / 180),
  });
  return (
    <div className={`wheel-stage ${spinning ? "is-spinning" : ""}`}>
      <div className="wheel-pointer" aria-hidden="true">
        <svg viewBox="0 0 40 46">
          <path
            d="M2 2H38L20 42Z"
            fill="#202d49"
            stroke="#f7f6f2"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <svg
        className="wheel-svg"
        viewBox="0 0 520 520"
        role="img"
        aria-label={
          selected
            ? `The wheel selected ${selected}`
            : "Eight categories: Productivity, Games, Lifestyle, Learning, Creative tools, Community, Wellness, Wildcard"
        }
      >
        <g transform="translate(10 10)">
          <circle
            cx="250"
            cy="250"
            r="247"
            fill="none"
            stroke="#2a426a"
            strokeWidth="1.35"
          />
          <g
            className="wheel-rotor"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {categories.map((label, i) => {
              const from = point(-90 + i * 45, 239);
              const to = point(-90 + (i + 1) * 45, 239);
              const pos = point(-90 + (i + 0.5) * 45, 163);
              const Icon = categoryIcons[i];
              return (
                <g key={label}>
                  <path
                    d={`M250 250L${from.x} ${from.y}A239 239 0 0 1 ${to.x} ${to.y}Z`}
                    fill={categoryColors[i]}
                    stroke="#faf8f2"
                    strokeWidth="1"
                  />
                  <g transform={`translate(${pos.x} ${pos.y})`}>
                    <g
                      className="wheel-label-group"
                      style={{ transform: `rotate(${-rotation}deg)` }}
                    >
                      <Icon
                        x={-13}
                        y={-31}
                        width={26}
                        height={26}
                        strokeWidth={1.55}
                      />
                      <text y="18" textAnchor="middle" className="wheel-label">
                        {label === "Creative tools" ? (
                          <>
                            <tspan x="0" dy="-5">
                              Creative
                            </tspan>
                            <tspan x="0" dy="17">
                              tools
                            </tspan>
                          </>
                        ) : (
                          label
                        )}
                      </text>
                    </g>
                  </g>
                </g>
              );
            })}
          </g>
          <circle
            cx="250"
            cy="250"
            r="239"
            fill="none"
            stroke="#2a426a"
            strokeWidth="1.25"
          />
          {Array.from({ length: 8 }, (_, i) => {
            const p = point(i * 45, 243);
            return <circle key={i} cx={p.x} cy={p.y} r="2.3" fill="#2a426a" />;
          })}
          <circle
            cx="250"
            cy="250"
            r="73"
            fill="#fbfaf6"
            stroke="#b2a58b"
            strokeWidth=".9"
          />
          <text x="250" y="244" textAnchor="middle" className="hub-label">
            let’s make
            <tspan x="250" dy="25">
              something
            </tspan>
          </text>
        </g>
      </svg>
    </div>
  );
}
