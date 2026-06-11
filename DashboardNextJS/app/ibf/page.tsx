"use client";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function utcDateParts() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return { y: String(y), m, d };
}

export default function EarlyWarningPage() {
  const { y, m, d } = utcDateParts();
  const mapUrl = `https://nowcasting.bmkg.go.id/infografis/CKB/${y}/${m}/${d}/infografis.jpg`;
  const detailUrl = `https://nowcasting.bmkg.go.id/infografis/CKB/${y}/${m}/${d}/infografis_text.jpg`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Peringatan Dini Cuaca</h1>
        <p className="text-sm text-muted-foreground">Impact Based Forecast (IBF) harian wilayah Kalimantan Barat.</p>
      </div>
      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map">Peta</TabsTrigger>
          <TabsTrigger value="detail">Detail</TabsTrigger>
        </TabsList>
        <TabsContent value="map" className="space-y-3">
          <div className="rounded-lg border bg-card p-3">
            <Image src={mapUrl} alt="Peta IBF" width={1080} height={1080} className="w-full h-auto rounded" />
          </div>
        </TabsContent>
        <TabsContent value="detail" className="space-y-3">
          <div className="rounded-lg border bg-card p-3">
            <Image src={detailUrl} alt="Detail IBF" width={1080} height={1080} className="w-full h-auto rounded" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
