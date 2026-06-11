"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="w-9 h-9 opacity-50 cursor-not-allowed">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const toggle = () => {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    if (next) {
      root.classList.add("dark");
      try { localStorage.setItem("theme", "dark"); } catch {}
    } else {
      root.classList.remove("dark");
      try { localStorage.setItem("theme", "light"); } catch {}
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="w-9 h-9 rounded-full transition-all hover:bg-accent hover:text-accent-foreground"
      title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {dark ? (
        <Moon className="h-4 w-4 transition-transform hover:-rotate-12" />
      ) : (
        <Sun className="h-4 w-4 transition-transform hover:rotate-45" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
