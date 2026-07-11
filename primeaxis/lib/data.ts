import {
  Building2,
  Castle,
  Factory,
  GraduationCap,
  Hotel,
  LandPlot,
  Landmark,
  Palmtree,
  Warehouse,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

export type Property = {
  id: string;
  title: string;
  location: string;
  country: string;
  price: number;
  period?: "mo" | "yr";
  beds: number;
  baths: number;
  area: number;
  type: "Buy" | "Rent" | "Commercial" | "Land" | "Luxury";
  badges: Array<"Featured" | "New" | "Verified">;
  gradient: string; // decorative placeholder artwork
  rating: number;
};

export const properties: Property[] = [
  {
    id: "px-1042",
    title: "Skyline Penthouse Residence",
    location: "Victoria Island, Lagos",
    country: "Nigeria",
    price: 1250000,
    beds: 4,
    baths: 5,
    area: 420,
    type: "Luxury",
    badges: ["Featured", "Verified"],
    gradient: "from-slate-800 via-indigo-900 to-slate-950",
    rating: 4.9,
  },
  {
    id: "px-2381",
    title: "Emerald Bay Villa",
    location: "Camps Bay, Cape Town",
    country: "South Africa",
    price: 2890000,
    beds: 6,
    baths: 7,
    area: 780,
    type: "Luxury",
    badges: ["Featured", "New"],
    gradient: "from-emerald-800 via-teal-900 to-slate-950",
    rating: 5.0,
  },
  {
    id: "px-1877",
    title: "The Meridian Apartments",
    location: "Kilimani, Nairobi",
    country: "Kenya",
    price: 2400,
    period: "mo",
    beds: 3,
    baths: 2,
    area: 185,
    type: "Rent",
    badges: ["Verified"],
    gradient: "from-sky-800 via-blue-900 to-slate-950",
    rating: 4.7,
  },
  {
    id: "px-3105",
    title: "Axis Corporate Tower",
    location: "Westlands, Nairobi",
    country: "Kenya",
    price: 8500000,
    beds: 0,
    baths: 12,
    area: 5200,
    type: "Commercial",
    badges: ["Featured", "Verified"],
    gradient: "from-zinc-800 via-slate-800 to-slate-950",
    rating: 4.8,
  },
  {
    id: "px-4520",
    title: "Riverside Serviced Plots",
    location: "Lusaka East",
    country: "Zambia",
    price: 68000,
    beds: 0,
    baths: 0,
    area: 2000,
    type: "Land",
    badges: ["New", "Verified"],
    gradient: "from-amber-800 via-orange-900 to-slate-950",
    rating: 4.6,
  },
  {
    id: "px-5093",
    title: "Marina Heights Duplex",
    location: "Palm Jumeirah, Dubai",
    country: "UAE",
    price: 3150000,
    beds: 5,
    baths: 6,
    area: 540,
    type: "Buy",
    badges: ["Featured", "New", "Verified"],
    gradient: "from-fuchsia-900 via-purple-900 to-slate-950",
    rating: 4.9,
  },
];

export type Category = {
  name: string;
  count: string;
  icon: LucideIcon;
};

export const categories: Category[] = [
  { name: "Luxury Homes", count: "8,400+", icon: Castle },
  { name: "Apartments", count: "14,200+", icon: Building2 },
  { name: "Land", count: "6,900+", icon: LandPlot },
  { name: "Commercial", count: "4,800+", icon: Landmark },
  { name: "Warehouses", count: "1,650+", icon: Warehouse },
  { name: "Hotels & Lodges", count: "920+", icon: Hotel },
  { name: "Office Spaces", count: "3,300+", icon: Briefcase },
  { name: "Industrial Parks", count: "480+", icon: Factory },
  { name: "Vacation Homes", count: "2,700+", icon: Palmtree },
  { name: "Student Housing", count: "1,900+", icon: GraduationCap },
];

export const testimonials = [
  {
    name: "Amara Okafor",
    role: "Home Buyer · Lagos",
    quote:
      "PrimeAxis made buying our first home effortless. Verified listings meant no surprises, and our agent handled everything from viewing to closing in under six weeks.",
    rating: 5,
    initials: "AO",
  },
  {
    name: "Daniel van der Merwe",
    role: "Property Investor · Cape Town",
    quote:
      "The market analytics and ROI tools are genuinely institutional-grade. I've closed three off-plan deals through PrimeAxis with total confidence in the numbers.",
    rating: 5,
    initials: "DM",
  },
  {
    name: "Chipo Banda",
    role: "Developer · Lusaka",
    quote:
      "As a developer, the lead quality is unmatched. We sold out an entire phase of 40 units in three months — twice as fast as any previous launch.",
    rating: 5,
    initials: "CB",
  },
  {
    name: "Sarah Kimani",
    role: "Tenant · Nairobi",
    quote:
      "Found a verified apartment, took a virtual tour, and signed the lease — all without leaving my desk. The whole experience felt like the future of renting.",
    rating: 4,
    initials: "SK",
  },
];

export const articles = [
  {
    title: "2026 Market Outlook: Where Smart Money Is Buying",
    category: "Market Trends",
    readTime: "8 min read",
    excerpt:
      "Our analysts break down the metros with the strongest rental yield growth and capital appreciation forecasts for the year ahead.",
    gradient: "from-blue-900 to-slate-950",
  },
  {
    title: "The Complete First-Time Buyer's Guide",
    category: "Buying Guide",
    readTime: "12 min read",
    excerpt:
      "From pre-approval to keys in hand — every step, every document, and every fee explained in plain language.",
    gradient: "from-emerald-900 to-slate-950",
  },
  {
    title: "Off-Plan Investing: Risks, Rewards & Red Flags",
    category: "Investment Tips",
    readTime: "10 min read",
    excerpt:
      "How to evaluate developer track records, escrow structures, and payment plans before committing capital to off-plan projects.",
    gradient: "from-amber-900 to-slate-950",
  },
];

export const developers = [
  { name: "Meridian Group", projects: 34, focus: "Mixed-use towers" },
  { name: "Axum Developments", projects: 21, focus: "Waterfront residences" },
  { name: "Northgate Estates", projects: 48, focus: "Gated communities" },
  { name: "Sable Properties", projects: 17, focus: "Commercial parks" },
];

export const navLinks = [
  { label: "Buy", href: "#featured" },
  { label: "Rent", href: "#featured" },
  { label: "Commercial", href: "#categories" },
  { label: "Land", href: "#categories" },
  { label: "Agents", href: "#pricing" },
  { label: "Developers", href: "#developers" },
  { label: "Blog", href: "#news" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#cta" },
];
