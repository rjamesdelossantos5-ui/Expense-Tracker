import {
  Utensils, Bus, Receipt, ShoppingBag, HeartPulse, Clapperboard, GraduationCap,
  ShoppingCart, MoreHorizontal, Briefcase, Coins, Tag, Home, Car, Plane, Coffee,
  Gift, Gamepad2, Music, Smartphone, Wifi, Zap, Droplets, Dumbbell, Baby, PawPrint,
  Shirt, Wrench, Fuel, Pizza, Wine, BookOpen, Banknote, PiggyBank, TrendingUp,
  Landmark, Stethoscope, Film, Bike, Scissors, Target, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, bus: Bus, receipt: Receipt, "shopping-bag": ShoppingBag,
  "heart-pulse": HeartPulse, clapperboard: Clapperboard, "graduation-cap": GraduationCap,
  "shopping-cart": ShoppingCart, "more-horizontal": MoreHorizontal, briefcase: Briefcase,
  coins: Coins, tag: Tag, home: Home, car: Car, plane: Plane, coffee: Coffee, gift: Gift,
  gamepad: Gamepad2, music: Music, smartphone: Smartphone, wifi: Wifi, zap: Zap,
  droplets: Droplets, dumbbell: Dumbbell, baby: Baby, paw: PawPrint, shirt: Shirt,
  wrench: Wrench, fuel: Fuel, pizza: Pizza, wine: Wine, book: BookOpen, banknote: Banknote,
  piggy: PiggyBank, trending: TrendingUp, landmark: Landmark, stethoscope: Stethoscope,
  film: Film, bike: Bike, scissors: Scissors, target: Target,
};

export const ICON_NAMES = Object.keys(ICONS);

export const COLOR_CHOICES = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#64748b",
];

export function CategoryIcon({
  name, color, size = 32, className = "",
}: { name?: string | null; color?: string | null; size?: number; className?: string }) {
  const Icon = (name && ICONS[name]) || Tag;
  const c = color || "#64748b";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl ${className}`}
      style={{ width: size, height: size, backgroundColor: `${c}22`, color: c }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
