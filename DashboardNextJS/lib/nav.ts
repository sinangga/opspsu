import {
  AlertTriangle,
  Compass,
  CloudSun,
  Flame,
  CloudRain,
  Wind,
  Globe,
  Axis3D,
  FileText,
  Gamepad2,
  ClipboardList,
  Lock,
  Search,
  Smartphone,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Cuaca & Peringatan",
    items: [
      { href: "/ibf", label: "Peringatan Dini Cuaca", icon: AlertTriangle },
      { href: "/aktual", label: "Aktual", icon: Compass },
      { href: "/prakiraan", label: "Prakiraan Cuaca", icon: CloudSun },
      { href: "/rainrate", label: "Rainrate", icon: CloudRain },
    ],
  },
  {
    title: "Monitoring & Analisis",
    items: [
      { href: "/hotspot", label: "Hotspot Monitoring System", icon: Flame },
      { href: "/wrhp", label: "Angin dan RASON", icon: Wind },
      { href: "/regional", label: "Parameter Regional", icon: Globe },
      { href: "/pibal", label: "Pibal 3D-Plot", icon: Axis3D },
      { href: "/kawan-pibal", label: "Kawan Pibal", icon: Smartphone },
    ],
  },
  {
    title: "Layanan & Lainnya",
    items: [
      { href: "/laporan-kerja", label: "Laporan Kerja", icon: FileText },
    ],
  },
];
