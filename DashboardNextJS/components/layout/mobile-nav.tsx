"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [openGroups, setOpenGroups] = React.useState<string[]>(() => {
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

  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.classList.add("nav-open");
      return () => {
        document.body.style.overflow = prev || "";
        document.documentElement.classList.remove("nav-open");
      };
    } else {
      document.body.style.overflow = "";
      document.documentElement.classList.remove("nav-open");
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="xl:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Buka navigasi</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="items-start border-b px-6 py-5 text-left">
          <SheetTitle className="text-base font-semibold">
            BMKG Pangsuma Kapuas Hulu
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4 py-4">
          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups.includes(group.title);
            return (
              <div key={group.title}>
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider px-3 py-2 hover:bg-[--sidebar-accent] rounded-md"
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
                      <div className="flex flex-col gap-1 py-1">
                        {group.items.map((item) => {
                          const active =
                            pathname === item.href ||
                            pathname.startsWith(`${item.href}/`);
                          const Icon = item.icon;
                          return (
                            <SheetClose asChild key={item.href}>
                              <Link
                                href={item.href}
                                className={cn(
                                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                                  active
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                              >
                                <Icon className="h-5 w-5" />
                                <span>{item.label}</span>
                              </Link>
                            </SheetClose>
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
      </SheetContent>
    </Sheet>
  );
}
