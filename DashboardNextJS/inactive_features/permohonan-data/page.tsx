import { Metadata } from "next";
import { PermohonanDataForm } from "@/components/PermohonanDataForm";

export const metadata: Metadata = {
  title: "Permohonan Data - BMKG Pangsuma",
  description: "Form permohonan data BMKG Pangsuma Kapuas Hulu",
};

export default function PermohonanDataPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Permohonan Data</h2>
      </div>
      <div className="flex justify-center pt-8">
        <PermohonanDataForm />
      </div>
    </div>
  );
}
