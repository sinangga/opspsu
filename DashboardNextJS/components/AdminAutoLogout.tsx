"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

// 15 Minutes in milliseconds
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; 

export function AdminAutoLogout() {
  const router = useRouter();
  const supabase = createClient();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const performLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      toast.warning("Sesi berakhir. Anda telah logout otomatis karena tidak aktif selama 15 menit.");
      router.push("/admin/login");
      router.refresh();
    } catch (error) {
      console.error("Auto logout error:", error);
    }
  }, [router, supabase]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(performLogout, IDLE_TIMEOUT_MS);
  }, [performLogout]);

  useEffect(() => {
    // List of events to track activity
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click"
    ];

    // Initial timer set
    resetTimer();

    // Throttle the event listener to avoid performance issues
    let lastTrigger = 0;
    const handleActivity = () => {
      const now = Date.now();
      // Only reset timer if 1 second has passed since last event (throttling)
      if (now - lastTrigger > 1000) {
        lastTrigger = now;
        resetTimer();
      }
    };

    // Attach listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer]);

  return null; // This component renders nothing UI-wise
}
