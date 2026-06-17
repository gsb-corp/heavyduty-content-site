import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "헤비듀티 콘텐츠 캘린더",
  description: "이번 주 무엇을 만들어야 하는지 자동 안내",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
