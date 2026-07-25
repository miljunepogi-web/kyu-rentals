export const siteConfig = {
  name: "KYU Rentals",
  description: "Enterprise Karaoke Equipment Rental Management Platform",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ogImage: "/og-image.png",
  links: {
    github: "https://github.com/kyu-rentals",
  },
};

export type SiteConfig = typeof siteConfig;
