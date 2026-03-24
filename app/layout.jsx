export const metadata = {
  title: "ATS Screener",
  description: "Batch CV screening with OpenAI"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: "#0b1020",
          color: "#f8fafc"
        }}
      >
        {children}
      </body>
    </html>
  );
}