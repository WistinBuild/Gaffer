import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Gaffer — on-chain fantasy football for the 2026 World Cup";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamic Open Graph image for / (and inherited by every page that doesn't override).
 * Pure CSS — no external fonts to load. System stack falls back cleanly inside ImageResponse.
 */
export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #080B0F 0%, #0d1218 50%, #07101a 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Gold radial bleed top-left */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -200,
            width: 700,
            height: 700,
            background:
              "radial-gradient(circle, rgba(212,175,55,0.25) 0%, transparent 60%)",
            display: "flex",
          }}
        />
        {/* Electric bleed bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: -200,
            right: -200,
            width: 700,
            height: 700,
            background:
              "radial-gradient(circle, rgba(0,255,135,0.18) 0%, transparent 60%)",
            display: "flex",
          }}
        />
        {/* Pitch-green base wash */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 40% at 50% 100%, rgba(26,71,49,0.5) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* TOP — chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, zIndex: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(212,175,55,0.12)",
              border: "1px solid rgba(212,175,55,0.4)",
              fontSize: 18,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#D4AF37",
              fontWeight: 700,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#D4AF37", display: "flex" }} />
            On Base · World Cup 2026
          </div>
        </div>

        {/* MIDDLE — wordmark + headline */}
        <div style={{ display: "flex", flexDirection: "column", zIndex: 10 }}>
          <div
            style={{
              display: "flex",
              fontSize: 260,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 0.85,
              background:
                "linear-gradient(180deg, #ffffff 0%, #ffffff 40%, #D4AF37 100%)",
              backgroundClip: "text",
              color: "transparent",
              fontStyle: "italic",
              transform: "translateY(8px)",
            }}
          >
            GAFFER
          </div>
          <div
            style={{
              display: "flex",
              gap: 24,
              marginTop: 24,
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            <span style={{ color: "#ffffff" }}>DRAFT</span>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
            <span style={{ color: "#D4AF37" }}>BATTLE</span>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
            <span style={{ color: "#00FF87" }}>EARN</span>
          </div>
        </div>

        {/* BOTTOM — tagline + addresses */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
            <div
              style={{
                fontSize: 24,
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.3,
              }}
            >
              Draft 5 World Cup NFTs. Stake ETH. Outscore your opponent on matchday.
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 14,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
                fontWeight: 700,
              }}
            >
              4 contracts live · sub-cent gas · 95% to winners
            </div>
          </div>

          {/* Right-side mark */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 100,
                height: 100,
                borderRadius: 999,
                background: "rgba(212,175,55,0.12)",
                border: "2px solid rgba(212,175,55,0.5)",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 56,
                fontStyle: "italic",
                fontWeight: 900,
                color: "#D4AF37",
              }}
            >
              D
            </div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 700,
              }}
            >
              Base · chainId 84532
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
