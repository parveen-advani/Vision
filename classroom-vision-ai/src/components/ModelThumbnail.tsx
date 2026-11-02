import type { VisualId } from "../types";

export function ModelThumbnail({ id }: { id: VisualId }) {
  return (
    <svg
      className={`model-thumbnail model-thumbnail--${id}`}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      {id === "heart" && (
        <>
          <path
            d="M33 19c-8-9-21-2-19 11 2 14 18 25 21 23 7-5 17-17 15-27-2-9-11-11-17-7Z"
            fill="#cc756b"
          />
          <path
            d="m31 23-2-13 7-1 3 14m-1-8 6-7 5 5-7 8"
            stroke="#bd6059"
            strokeWidth="7"
          />
          <path
            d="m29 27 5 9-3 13m3-13 9-5"
            stroke="#f2b5a6"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="m22 17-4-8" stroke="#7c9b9d" strokeWidth="6" />
        </>
      )}
      {id === "osi" && (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M12 ${17 + i * 7} 32 ${9 + i * 7} 52 ${17 + i * 7} 32 ${26 + i * 7}Z`}
              fill={["#98b5b5", "#bfd0c6", "#95ad91", "#d1b98f", "#cb987f"][i]}
              stroke="#f2f1ed"
              strokeWidth="1.5"
            />
          ))}
        </>
      )}
      {id === "dna" && (
        <>
          <path
            d="M20 8c37 16-13 32 24 48M44 8C7 24 57 40 20 56"
            stroke="#779795"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M${i % 2 ? 25 : 22} ${12 + i * 8}h${i % 2 ? 14 : 20}`}
              stroke="#cba38b"
              strokeWidth="2.5"
            />
          ))}
        </>
      )}
      {id === "solar" && (
        <>
          <ellipse
            cx="32"
            cy="32"
            rx="27"
            ry="13"
            transform="rotate(-25 32 32)"
            stroke="#beb5a4"
          />
          <ellipse
            cx="32"
            cy="32"
            rx="20"
            ry="8"
            transform="rotate(-25 32 32)"
            stroke="#d1c8b6"
          />
          <circle cx="32" cy="32" r="8" fill="#d8af60" />
          <circle cx="54" cy="21" r="4" fill="#8baba3" />
          <circle cx="16" cy="34" r="3" fill="#bb8270" />
        </>
      )}
      {id === "atom" && (
        <>
          <ellipse
            cx="32"
            cy="32"
            rx="26"
            ry="9"
            stroke="#b3a6c1"
            strokeWidth="1.7"
          />
          <ellipse
            cx="32"
            cy="32"
            rx="26"
            ry="9"
            transform="rotate(60 32 32)"
            stroke="#9a92ac"
            strokeWidth="1.7"
          />
          <ellipse
            cx="32"
            cy="32"
            rx="26"
            ry="9"
            transform="rotate(-60 32 32)"
            stroke="#9a92ac"
            strokeWidth="1.7"
          />
          <circle cx="32" cy="32" r="6" fill="#a398b9" />
          <circle cx="54" cy="36" r="3" fill="#74648f" />
        </>
      )}
      {id === "cell" && (
        <>
          <rect
            x="10"
            y="11"
            width="44"
            height="42"
            rx="13"
            fill="#c0cba4"
            stroke="#8c9f77"
            strokeWidth="2"
          />
          <rect x="14" y="15" width="36" height="34" rx="10" fill="#e1e4c7" />
          <ellipse cx="33" cy="31" rx="11" ry="9" fill="#b5c7ad" />
          <circle cx="23" cy="39" r="6" fill="#a59eb7" />
          <path
            d="m20 22 3 2m20 16 3 3m-8-23 2 3"
            stroke="#7c986c"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      )}
      {id === "neural" && (
        <>
          <path
            d="m13 20 19-7 19 7M13 20l19 12 19-12M13 20l19 31 19-7M13 44l19-31 19 31M13 44l19-12 19 12M13 44l19 7"
            stroke="#b1b8cb"
            strokeWidth="1.3"
          />
          {[
            [13, 20],
            [13, 44],
            [32, 13],
            [32, 32],
            [32, 51],
            [51, 20],
            [51, 44],
          ].map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="4.5"
              fill={x === 32 ? "#9cabc2" : "#7f94a8"}
            />
          ))}
        </>
      )}
      {id === "waterCycle" && (
        <>
          <path
            d="M16 22a10 10 0 0 1 18-5c12-5 19 12 7 15H18c-9 0-10-10-2-10Z"
            fill="#b9d0d1"
          />
          <path
            d="m22 38-3 6m13-6-3 6m13-6-3 6"
            stroke="#7b9eab"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M10 52q11-6 22 0t22 0" stroke="#9fbabc" strokeWidth="3" />
          <circle cx="47" cy="13" r="6" fill="#dfc789" />
        </>
      )}
    </svg>
  );
}
