import { Metadata } from "next";
import KawanPibalClient from "@/components/KawanPibalClient";

export const metadata: Metadata = {
  title: "Kawan Pibal | BMKG Kapuas Hulu",
  description: "Asisten pencatatan dan penyandian Pilot Balloon",
};

export default function KawanPibalPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <KawanPibalClient />
    </div>
  );
}
