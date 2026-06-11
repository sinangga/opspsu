"use client";

import dynamic from "next/dynamic";

const LazyPibalDashboard = dynamic(
  () => import("./PibalDashboard").then((mod) => mod.PibalDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
        Memuat model 3D PIBAL...
      </div>
    ),
  }
);

type PibalDashboardClientProps = {
  defaultCode: string;
  defaultAscentRate: number;
};

export function PibalDashboardClient(props: PibalDashboardClientProps) {
  return <LazyPibalDashboard {...props} />;
}
