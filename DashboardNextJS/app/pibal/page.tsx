import type { Metadata } from "next";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// import { DEFAULT_ASCENT_RATE, DEFAULT_PIBAL_CODE } from "@/lib/pibalDefaults";
// import { PibalDashboardClient } from "@/components/PibalDashboardClient";

export const metadata: Metadata = {
  title: "Under Development | BMKG Kapuas Hulu",
};

export default function PibalPage() {
  // Original Code (Hidden for Production)
  // return <PibalDashboardClient defaultCode={DEFAULT_PIBAL_CODE} defaultAscentRate={DEFAULT_ASCENT_RATE} />;

  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <Construction className="h-12 w-12 text-muted-foreground" />
      </div>
      
      <div className="max-w-md space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Fitur Sedang Dikembangkan</h1>
        <p className="text-muted-foreground">
          Modul Visualisasi PIBAL 3D sedang dalam tahap pengembangan dan pengujian internal untuk memastikan akurasi data sesuai standar WMO.
        </p>
      </div>

      <div className="flex gap-4">
        <Button asChild variant="default">
          <Link href="/">Kembali ke Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}