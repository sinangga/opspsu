"use client";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  {
    value: "mjo",
    label: "MJO",
    title: "Madden Julian Oscillation",
    url: "https://www.cpc.ncep.noaa.gov/products/precip/CWlink/MJO/combphase_noCFSfull.gif",
  },
  {
    value: "surge",
    label: "Surge",
    title: "Monsoon Surge Index",
    url: "https://web-meteo.bmkg.go.id//media/data/bmkg/mfy/sur_idx.png",
  },
  {
    value: "sst",
    label: "SST Nino",
    title: "Suhu Permukaan Laut Nino 3.4",
    url: "https://www.bom.gov.au/climate/enso/wrap-up/archive/20241029.sstOutlooks_nino34.png",
  },
  {
    value: "iod",
    label: "IOD",
    title: "Indian Ocean Dipole",
    url: "https://www.bom.gov.au/clim_data/IDCK000072/iod1.png",
  },
] as const;

export default function RegionalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Parameter Regional</h1>
        <p className="text-sm text-muted-foreground">Indeks skala regional untuk konteks prakiraan lokal.</p>
      </div>
      <Tabs defaultValue="mjo" className="space-y-4">
        <TabsList className="inline-flex w-full overflow-x-auto no-scrollbar gap-2 md:gap-2">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 px-4 md:px-5">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-3">
            <div className="text-sm text-muted-foreground">{tab.title}</div>
            <div className="rounded-md border bg-card p-3">
              <Image src={tab.url} alt={tab.title} width={1280} height={720} className="w-full h-auto rounded" />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
