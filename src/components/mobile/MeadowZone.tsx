interface MeadowZoneProps {
  children: React.ReactNode;
}

export default function MeadowZone({ children }: MeadowZoneProps) {
  return (
    <div>
      {/* Top feather */}
      <div
        style={{
          height: 70,
          background:
            "linear-gradient(180deg, #0C0B0A 0%, #1E2218 18%, #3A4234 36%, #5E6E55 52%, #8A9E7E 66%, #B2C8A8 80%, #CDDAC2 90%, #E0EADA 100%)",
        }}
      />

      {/* Core surface */}
      <div
        style={{
          background:
            "linear-gradient(175deg, #E0EADA 0%, #E4EDE0 30%, #E8F0E4 50%, #E4EDE0 70%, #E0EADA 100%)",
          padding: "0 24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "120%",
            height: 250,
            background:
              "radial-gradient(ellipse at center, rgba(245, 252, 240, 0.5) 0%, rgba(230, 242, 225, 0.2) 35%, transparent 60%)",
            filter: "blur(35px)",
            pointerEvents: "none",
          }}
        />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {children}
        </div>
      </div>

      {/* Bottom feather */}
      <div
        style={{
          height: 70,
          background:
            "linear-gradient(180deg, #E0EADA 0%, #CDDAC2 10%, #B2C8A8 20%, #8A9E7E 34%, #5E6E55 48%, #3A4234 64%, #1E2218 82%, #0C0B0A 100%)",
        }}
      />
    </div>
  );
}
