import { ImageResponse } from "next/og";

export const alt = "SpecWatch — know before it breaks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 10,
              borderRadius: 20,
              border: "2px solid #3f3f46",
              background: "#18181b",
            }}
          >
            <div style={{ width: 44, height: 14, borderRadius: 7, background: "#71717a" }} />
            <div style={{ width: 64, height: 14, borderRadius: 7, background: "#ef4444" }} />
            <div style={{ width: 48, height: 14, borderRadius: 7, background: "#f97316" }} />
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#fafafa" }}>SpecWatch</div>
          <div
            style={{
              marginLeft: 24,
              fontSize: 20,
              color: "#a1a1aa",
              border: "1px solid #3f3f46",
              borderRadius: 999,
              padding: "8px 20px",
            }}
          >
            Dependabot, but for the APIs you call
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 700,
              color: "#fafafa",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Know before it{" "}
            <span style={{ color: "#f97316" }}>breaks.</span>
          </div>
          <div style={{ fontSize: 28, color: "#a1a1aa", lineHeight: 1.4, maxWidth: 900 }}>
            We watch the OpenAPI specs of Stripe, GitHub, OpenAI and more — and tell you in
            plain English the moment a change will break your code.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {["Stripe", "GitHub", "OpenAI", "Twilio", "Slack", "Supabase"].map((name) => (
            <div
              key={name}
              style={{
                fontSize: 20,
                color: "#e4e4e7",
                border: "1px solid #3f3f46",
                borderRadius: 999,
                padding: "8px 22px",
                background: "#18181b",
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
