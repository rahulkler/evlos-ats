import "./globals.css";

export const metadata = {
  title: "Evlos ATS",
  description: "Evlos Applicant Tracking System",
  icons: {
    icon: "/favicon.png"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}