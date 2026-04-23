import "./globals.css";

export const metadata = {
  title: "Route Planner",
  description: "Next.js dispatch planner UI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
