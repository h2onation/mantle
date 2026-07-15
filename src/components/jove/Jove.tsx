import React from "react";

interface JoveProps {
  size: number;
}

function NeutralStand() {
  return (
    <>
      <g data-part="head">
        <path d="M60 7.5C44.8 7.2 33 16.8 32.8 30.3C32.6 44.1 43.7 53.1 59.5 53.1C74.2 53.1 85.8 44.1 85.4 29.9C85.1 16.8 74.9 7.8 60 7.5Z" />
      </g>
      <g data-part="face">
        <path d="M51.4 32.7L51.3 35.4" />
        <path d="M68.9 32.6L68.8 35.4" />
        <path d="M55.2 42C58.2 42.3 61.6 42.3 64.8 42" />
      </g>
      <g data-part="torso">
        <path d="M43.7 55.1C42.3 64.7 42.6 77.9 44.7 87.7" />
        <path d="M76.5 55C77.9 64.7 77.6 77.9 75.4 87.7" />
      </g>
      <g data-part="arms">
        <path d="M43.1 50.3C37.2 57.2 34.8 68.7 35 82.8C35.1 90.7 37.8 95 41.7 95.1C44.1 95.2 45 92.6 43.6 89.2" />
        <path d="M40.5 91.5L43.4 89.5" />
        <path d="M77 50.2C82.8 57.1 85.3 68.7 85.1 82.7C85 90.6 82.2 94.9 78.3 95C75.9 95.1 75 92.5 76.4 89.1" />
        <path d="M79.5 91.4L76.6 89.4" />
      </g>
      <g data-part="legs">
        <path d="M44.7 87.7C45 94.3 45.6 103 44.3 108.7C43.6 111.8 39.7 112.4 40.3 115C41.1 118.1 49.8 118.1 53.7 115.8C56 114.4 55.3 106.3 56.1 99C56.8 92.3 57.2 88.7 59.9 87.9" />
        <path d="M60.1 87.9C62.8 88.7 63.2 92.3 63.9 99C64.7 106.3 64 114.4 66.3 115.8C70.2 118.1 78.9 118.1 79.7 115C80.3 112.4 76.4 111.8 75.7 108.7C74.4 103 75 94.3 75.4 87.7" />
      </g>
    </>
  );
}

export default function Jove({ size }: JoveProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={size <= 48 ? 2.8 : 2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", pointerEvents: "none" }}
    >
      <NeutralStand />
    </svg>
  );
}
