export interface PackageInclusion {
  id: string;
  name: string;
  quantity: number;
  iconName?: string;
}

export interface RentalPackage {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price4Hours: number;
  price8Hours: number;
  priceFullDay: number;
  featuredImageUrl: string;
  galleryUrls: string[];
  inclusions: PackageInclusion[];
  isFeatured: boolean;
  isPopular?: boolean;
  maxGuests?: string;
  soundRating?: string;
}

export const MOCK_PACKAGES: RentalPackage[] = [
  {
    id: "pkg-001",
    slug: "kyu-mini",
    name: "KYU Mini Party",
    tagline: "Compact power for intimate home gatherings",
    description: "Perfect for condo celebrations, small family dinners, and private room parties. Crystal clear vocal output with zero distortion.",
    price4Hours: 1800,
    price8Hours: 2500,
    priceFullDay: 3000,
    featuredImageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80",
    galleryUrls: [
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
    ],
    inclusions: [
      { id: "inc-1", name: "Heavy Duty Powered Speaker (10-inch)", quantity: 1, iconName: "speaker" },
      { id: "inc-2", name: "UHF Wireless Microphones", quantity: 2, iconName: "mic" },
      { id: "inc-3", name: "HD Songbook Player (100k+ Songs)", quantity: 1, iconName: "music" },
      { id: "inc-4", name: "Heavy Duty Tripod Stand", quantity: 1, iconName: "stand" },
      { id: "inc-5", name: "HDMI & Aux Cables", quantity: 1, iconName: "cable" },
    ],
    isFeatured: true,
    isPopular: false,
    maxGuests: "10-20 Guests",
    soundRating: "300 Watts",
  },
  {
    id: "pkg-002",
    slug: "kyu-party-pro",
    name: "KYU Party Pro",
    tagline: "Our most popular setup for birthdays and backyard events",
    description: "High-impact dual speaker setup with dedicated wireless mics, party laser lights, and song songbook tablet interface.",
    price4Hours: 2800,
    price8Hours: 3600,
    priceFullDay: 4200,
    featuredImageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
    galleryUrls: [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
    ],
    inclusions: [
      { id: "inc-1", name: "Dual Powered Speakers (12-inch)", quantity: 2, iconName: "speaker" },
      { id: "inc-2", name: "Pro Vocal Wireless Microphones", quantity: 2, iconName: "mic" },
      { id: "inc-3", name: "HD Player (Latest 2026 Hits)", quantity: 1, iconName: "music" },
      { id: "inc-4", name: "RGB Disco Party Laser Light", quantity: 1, iconName: "sparkles" },
      { id: "inc-5", name: "Songbook Tablet Controller", quantity: 1, iconName: "tablet" },
      { id: "inc-6", name: "10m Extension Cable", quantity: 1, iconName: "cable" },
    ],
    isFeatured: true,
    isPopular: true,
    maxGuests: "30-60 Guests",
    soundRating: "800 Watts",
  },
  {
    id: "pkg-003",
    slug: "kyu-concert-master",
    name: "KYU Concert Master",
    tagline: "Unbeatable sound clarity for outdoor events & company parties",
    description: "Full venue audio package with dual subwoofers, 4 wireless microphones, stage lighting, and priority setup service.",
    price4Hours: 4800,
    price8Hours: 6200,
    priceFullDay: 7500,
    featuredImageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
    galleryUrls: [
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80",
    ],
    inclusions: [
      { id: "inc-1", name: "Dual Concert Speakers (15-inch)", quantity: 2, iconName: "speaker" },
      { id: "inc-2", name: "15-inch Subwoofer Enclosure", quantity: 1, iconName: "subwoofer" },
      { id: "inc-3", name: "UHF Quad Wireless Microphones", quantity: 4, iconName: "mic" },
      { id: "inc-4", name: "Smart Song System + Dual Monitors", quantity: 1, iconName: "monitor" },
      { id: "inc-5", name: "DMX Stage Lighting Bar", quantity: 1, iconName: "sparkles" },
      { id: "inc-6", name: "White-Glove Delivery & Sound Engineer Setup", quantity: 1, iconName: "wrench" },
    ],
    isFeatured: true,
    isPopular: false,
    maxGuests: "80-150 Guests",
    soundRating: "2000 Watts",
  },
];

export async function getPublishedPackages(): Promise<RentalPackage[]> {
  // In production, queries public.packages from Supabase
  // Returns mock data if database is unseeded
  return MOCK_PACKAGES;
}

export async function getPackageBySlug(slug: string): Promise<RentalPackage | null> {
  const pkgs = await getPublishedPackages();
  return pkgs.find((p) => p.slug === slug) || null;
}
