"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";

export function SidebarNav() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const activeGroup = NAV_GROUPS.find((group) =>
      group.items.some(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
      )
    );
    return activeGroup ? [activeGroup.title] : [];
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <Link
        href="/"
        className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border hover:bg-sidebar-accent transition-colors"
      >
        <div className="size-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground overflow-hidden">
          <Image
            src="/bmkg.png"
            alt="BMKG"
            width={28}
            height={28}
            className="w-7 h-7 object-contain"
            priority
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
            BMKG
          </div>
          <div className="font-semibold leading-tight">
            Pangsuma Kapuas Hulu
          </div>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-4 py-6">
        {NAV_GROUPS.map((group) => {
          const isOpen = openGroups.includes(group.title);
          return (
            <div key={group.title} className="mb-2">
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider px-3 py-2 hover:bg-sidebar-accent rounded-md transition-colors"
              >
                {group.title}
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    isOpen ? "rotate-180" : ""
                  )}
                />
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 py-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active =
                          pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              active
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <Icon className="size-5 text-muted-foreground group-hover:text-inherit" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border flex items-center justify-between">
        <span className="text-sm font-medium">Mode Gelap</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
