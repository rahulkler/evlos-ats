export const metadata = {
  title: "Evlos ATS",
  description: "Evlos Applicant Tracking System"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: "#05070b",
          color: "#f8fafc"
        }}
      >
        {children}
      </body>
    </html>
  );
}