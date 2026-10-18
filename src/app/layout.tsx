import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import AmbientBlobs from "@/components/AmbientBlobs";

export const metadata: Metadata = {
  title: "Urji Fit — Personal Fitness, Nutrition & Habit Planner",
  description: "An integrated personal fitness, nutrition, fasting, water, sleep, and progressive overload planner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var saved = localStorage.getItem('urji_theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (saved === 'dark' || (!saved && prefersDark)) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch(e) {}
            })()`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] antialiased selection:bg-[#0B3D2E] selection:text-[#F2F7D9] relative"
      >
        <ThemeProvider>
          <AmbientBlobs />
          <div className="relative z-10">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
