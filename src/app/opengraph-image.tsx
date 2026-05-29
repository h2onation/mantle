import { ImageResponse } from "next/og";

// Social share card for the landing. Generated at request time by Next's
// file-convention OG route — no binary asset to maintain. Brand palette
// (linen ground, espresso ink, walnut accent). Default font (Satori has no
// system serif); kept simple and robust over loading the brand serif.
export const runtime = "edge";
export const alt = "mywalnut — a clearer picture of how you actually operate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E5D8BE",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 132,
            letterSpacing: "-0.01em",
            color: "#1F140A",
          }}
        >
          mywalnut
          <span style={{ color: "#5C3A1E" }}>.</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 40,
            lineHeight: 1.25,
            color: "#4A3220",
            maxWidth: 860,
            textAlign: "center",
          }}
        >
          A clearer, more honest picture of how you actually operate.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#5C3F23",
          }}
        >
          for neurodivergent adults
        </div>
      </div>
    ),
    { ...size }
  );
}
