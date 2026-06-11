import { AlertTriangle, Compass, CloudSun, Flame, CloudRain, Wind, Globe } from "lucide-react";

export default function Home() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">BMKG Pangsuma Kapuas Hulu</h1>
      <p className="text-muted-foreground">Selamat datang. Pilih fitur:</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <a className="border rounded-md p-4 hover:bg-accent" href="/prakiraan">
          <div className="flex items-center gap-2 font-medium">
            <CloudSun className="h-5 w-5 text-muted-foreground" />
            Prakiraan
          </div>
          <div className="text-sm text-muted-foreground">Tabel prakiraan cuaca per kecamatan.</div>
        </a>
        <a className="border rounded-md p-4 hover:bg-accent" href="/aktual">
          <div className="flex items-center gap-2 font-medium">
            <Compass className="h-5 w-5 text-muted-foreground" />
            Aktual
          </div>
          <div className="text-sm text-muted-foreground">METAR/TAFOR, Satelit, Radar.</div>
        </a>
        <a className="border rounded-md p-4 hover:bg-accent" href="/hotspot">
          <div className="flex items-center gap-2 font-medium">
            <Flame className="h-5 w-5 text-muted-foreground" />
            Hotspot
          </div>
          <div className="text-sm text-muted-foreground">Peta hotspot FIRMS dengan penanda persistensi.</div>
        </a>
        <a className="border rounded-md p-4 hover:bg-accent" href="/ibf">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Peringatan Dini
          </div>
          <div className="text-sm text-muted-foreground">Informasi peringatan dini cuaca berbasis dampak.</div>
        </a>
        <a className="border rounded-md p-4 hover:bg-accent" href="/rainrate">
          <div className="flex items-center gap-2 font-medium">
            <CloudRain className="h-5 w-5 text-muted-foreground" />
            Rainrate
          </div>
          <div className="text-sm text-muted-foreground">Estimasi intensitas hujan dari radar/satelit.</div>
        </a>
        <a className="border rounded-md p-4 hover:bg-accent" href="/wrhp">
          <div className="flex items-center gap-2 font-medium">
            <Wind className="h-5 w-5 text-muted-foreground" />
            Angin & RASON
          </div>
          <div className="text-sm text-muted-foreground">SIGWX medium dan monitoring radiosonde.</div>
        </a>
        <a className="border rounded-md p-4 hover:bg-accent" href="/regional">
          <div className="flex items-center gap-2 font-medium">
            <Globe className="h-5 w-5 text-muted-foreground" />
            Parameter Regional
          </div>
          <div className="text-sm text-muted-foreground">Parameter cuaca skala regional.</div>
        </a>
      </div>
    </div>
  );
}
