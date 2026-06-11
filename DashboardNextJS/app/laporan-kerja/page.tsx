"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import clsx from "clsx";
import { toPng } from "html-to-image";

const OFFICER_NAMES = [
  "Muhammad Suyudi Wahyu Sinangga, S.Tr",
  "Primarisky Wahyu Mumpuni, S.Tr",
  "Evan Feriandy Sinaga, S.Tr.Met",
  "Faisal Fadhlani Yasmin, S.Tr.Met",
  "Gatot Mangku Prayitno, A.Md",
  "Imam Abdi Saputra, S.Tr",
  "Indrianto Sitorus, S.Tr.Met",
  "Muhammad Yusuf, S.Tr.Met",
  "Nurmala Novitasari, S.T",
  "Pebriyanti Rahmi, S.Tr",
  "Unggul Eka Saputra, S.T",
  "Achmad Ilham Zulkarn aen, S.Tr.Inst",
  "Arjuna Reynaldi, S.Tr.Met",
];

type TugasHarianItem = {
  no: number;
  uraian: string;
  keterangan: string;
  isDone: boolean;
  manualKeterangan: string;
  jumlah: string;
};

const LaporanKerjaPage = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [officerName, setOfficerName] = useState("");
  const [reportDate, setReportDate] = useState(""); // YYYY-MM-DD format
  const DUTY_SHIFTS = [
    "Pagi",
    "Siang",
    "Malam",
    "Pibal",
  ];
  const [dutyShift, setDutyShift] = useState("");
  const initialTugasHarian: Omit<TugasHarianItem, 'isDone' | 'manualKeterangan' | 'jumlah'>[] = [
    {
      no: 1,
      uraian: "Melakukan Pengamatan Udara Permukaan",
      keterangan: "Jam 13 s.d. 23 UTC",
    },
    {
      no: 2,
      uraian: "Melakukan Pengiriman Sandi Synop Via BMKGSOFT V2",
      keterangan: "Jam 00, 03, 06, 09, 12, 15, 18, dan 21",
    },
    {
      no: 3,
      uraian: "Membuat dan mengirim Sandi Metar Via AWOS",
      keterangan: "Jam 00 s.d. 23 UTC",
    },
    {
      no: 4,
      uraian: "Membuat dan Mengirim WXREV Via BMKGSOFT V2",
      keterangan: "Menu report bmkgsoft V2",
    },
    {
      no: 5,
      uraian: "Mengisi Laporan Penyinaran Matahari di Via BMKGSOFT V2",
      keterangan: "https://bmkgsatu.bmkg.go.id/klimatologi",
    },
    {
      no: 6,
      uraian: "Mengisi Form Penguapan Via BMKGSOFT V2",
      keterangan: "Pada Buku form penguapan Jam 00 UTC",
    },
    {
      no: 7,
      uraian: "Melakukan Penginputan data FKLIM 71 Via BMKGSOFT V2",
      keterangan: "Jam 00, 06, dan 11 UTC (https://bmkgsatu.bmkg.go.id/klimatologi)",
    },
    {
      no: 8,
      uraian: "Membuat dan Mengirim Sandi Met Report",
      keterangan: "Sesuai Permintaan AIRNav",
    },
    {
      no: 9,
      uraian: "Melakukan Pengamatan Udara Atas dan Mengirim Sandi Via BMKGSOFT V2",
      keterangan: "Dinas Pb1 dan Dinas Siang",
    },
    {
      no: 10,
      uraian: "Mengecek kelengkapan input BMKGsoft (penguapan, intensitas hujan, Penyinaran, FKLIM 71 dan Synop)",
      keterangan: "https://bmkgsatu.bmkg.go.id/monitoring/meteorologi",
    },
    {
      no: 11,
      uraian: "Pengisian Data Pias Hillman pada BMKGSOFT V2",
      keterangan: "https://bmkgsatu.bmkg.go.id/klimatologi",
    },
  ];

  const [tugasHarianState, setTugasHarianState] = useState<TugasHarianItem[]>(
    initialTugasHarian.map(task => ({ ...task, isDone: false, manualKeterangan: "", jumlah: "" }))
  );

  const handleTaskStatusChange = (index: number) => {
    setTugasHarianState((prevTasks) =>
      prevTasks.map((task, i) => {
        if (i === index) {
          const newIsDone = !task.isDone;
          const currentJumlah = Number(task.jumlah);
          let newJumlah = task.jumlah;

          if (newIsDone) {
            if (isNaN(currentJumlah) || currentJumlah <= 0) {
              newJumlah = '1';
            }
          } else {
            newJumlah = '';
          }
          return { ...task, isDone: newIsDone, jumlah: newJumlah };
        }
        return task;
      })
    );
  };

  const handleManualKeteranganChange = (index: number, value: string) => {
    setTugasHarianState((prevTasks) =>
      prevTasks.map((task, i) =>
        i === index ? { ...task, manualKeterangan: value } : task
      )
    );
  };

  const handleJumlahChange = (index: number, value: string) => {
    setTugasHarianState((prevTasks) =>
      prevTasks.map((task, i) => {
        if (i === index) {
          const isNumericAndPositive = !isNaN(Number(value)) && Number(value) > 0;
          return { ...task, jumlah: value, isDone: isNumericAndPositive };
        }
        return task;
      })
    );
  };

  const handleSaveAndDownload = async () => {
    const element = cardRef.current;
    if (!element) {
      toast.error("Tidak dapat menemukan elemen card untuk disimpan.");
      return;
    }

    try {
      toast.info("Sedang memproses gambar...");

      // 1. Create a deep clone of the element to avoid disturbing the live view
      // and to ensure we can force exact A4 dimensions without CSS conflicts.
      const clone = element.cloneNode(true) as HTMLElement;

      // 2. Sync values for Inputs, Textareas, and Selects
      // cloneNode does not copy the current value of controlled inputs
      const originalInputs = element.querySelectorAll('input, textarea, select');
      const clonedInputs = clone.querySelectorAll('input, textarea, select');

      originalInputs.forEach((node, index) => {
        const original = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const cloned = clonedInputs[index] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

        cloned.value = original.value;

        if (original instanceof HTMLInputElement && (original.type === 'checkbox' || original.type === 'radio')) {
            (cloned as HTMLInputElement).checked = original.checked;
        }
      });

      // 3. Explicitly embed images (Logo) as Base64 to ensure they render in the clone
      // This fixes missing logo issues on mobile/slow connections
      const logoImg = clone.querySelector('img[alt="BMKG Logo"]') as HTMLImageElement;
      if (logoImg) {
        try {
            const response = await fetch('/bmkg.png');
            const blob = await response.blob();
            const reader = new FileReader();
            await new Promise((resolve) => {
                reader.onloadend = resolve;
                reader.readAsDataURL(blob);
            });
            if (reader.result) {
                logoImg.src = reader.result as string;
            }
        } catch (e) {
            console.error("Failed to embed logo", e);
        }
      }

      // 4. Create a temporary off-screen container
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        width: '794px', // Strict A4 Width
        zIndex: '-1000',
        overflow: 'hidden' // Hide from scrollbars
      });
      document.body.appendChild(container);

      // 5. Style the clone for the snapshot
      Object.assign(clone.style, {
        width: '794px',
        height: 'auto',
        minHeight: '1247px',
        margin: '0',
        transform: 'none',
        overflow: 'visible', // Ensure all content is visible
        backgroundColor: 'white'
      });

      container.appendChild(clone);

      // 6. Allow DOM to settle and calculate layout
      await new Promise(resolve => setTimeout(resolve, 100));

      // 7. Measure exact content height
      const scrollHeight = clone.scrollHeight;

      // 8. Generate Image from the Clone
      const dataUrl = await toPng(clone, {
        cacheBust: true,
        pixelRatio: 2,
        width: 794,
        height: scrollHeight,
        style: {
           width: '794px',
           height: `${scrollHeight}px`,
        },
      });

      // 9. Cleanup
      document.body.removeChild(container);

      const link = document.createElement('a');
      link.download = `laporan-kerja-${reportDate || 'harian'}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Gambar berhasil diunduh!");
    } catch (err) {
      console.error("Gagal mengunduh gambar:", err);
      toast.error("Gagal mengunduh gambar.");
    }
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card ref={cardRef} className="max-w-4xl mx-auto w-full md:w-[794px] min-h-[1247px] force-black-theme">
        <CardHeader className="flex flex-row justify-between items-center pb-2">
          <div className="text-left">
            <CardTitle className="text-lg font-bold">
              LOG BOOK KEGIATAN HARIAN OBSERVER
            </CardTitle>
            <CardDescription className="font-semibold">
              STASIUN METEOROLOGI PANGSUMA KAPUAS HULU
            </CardDescription>
          </div>
          {/* Gunakan img tag biasa agar logo terbaca oleh html-to-image saat download */}
          <img src="/bmkg.png" alt="BMKG Logo" width={64} height={64} style={{ objectFit: 'contain' }} />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex justify-center items-center gap-x-4 text-sm mb-3">
            <div className="flex items-center gap-x-1">
                <Label className="min-w-[50px] shrink-0">NAMA</Label>
                <Select value={officerName} onValueChange={setOfficerName}>
                  <SelectTrigger className="h-6">
                    <SelectValue placeholder="Pilih Nama Petugas" />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICER_NAMES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
             <div className="flex items-center gap-x-1">
                <Label className="min-w-[50px] shrink-0">TANGGAL</Label>
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-auto h-6"
                />
            </div>
             <div className="flex items-center gap-x-1">
                <Label className="min-w-[50px] shrink-0">DINAS</Label>
                <Select value={dutyShift} onValueChange={setDutyShift}>
                  <SelectTrigger className="w-auto h-6">
                    <SelectValue placeholder="Pilih Dinas" />
                  </SelectTrigger>
                  <SelectContent>
                    {DUTY_SHIFTS.map((shift) => (
                      <SelectItem key={shift} value={shift}>
                        {shift}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">NO</TableHead>
                  <TableHead>URAIAN TUGAS</TableHead>
                  <TableHead className="w-[150px] text-center">STATUS</TableHead>
                  <TableHead className="w-[100px]">JUMLAH</TableHead>
                  <TableHead className="w-[80px]">KETERANGAN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tugasHarianState.map((tugas, index) => (
                  <TableRow key={tugas.no}>
                    <TableCell className="font-medium">{tugas.no}</TableCell>
                    <TableCell className="whitespace-normal break-words text-base">{tugas.uraian}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        onClick={() => handleTaskStatusChange(index)}
                        className={clsx(
                          "text-gray-800 border border-gray-300",
                          {
                            "bg-green-500 hover:bg-green-600 text-white": tugas.isDone,
                            "bg-white hover:bg-gray-100": !tugas.isDone,
                          }
                        )}
                      >
                        {tugas.isDone ? "Terlaksana" : "Tidak"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="-"
                        value={tugas.jumlah}
                        onChange={(e) => handleJumlahChange(index, e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-xs whitespace-normal break-words">
                      <Textarea
                        value={tugas.manualKeterangan}
                        onChange={(e) => handleManualKeteranganChange(index, e.target.value)}
                        className="text-xs w-full min-h-[40px]"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 space-y-4 text-sm">
            <Label className="font-bold">KONDISI SELAMA DINAS :</Label>
            <div className="grid w-full gap-2">
                <Label htmlFor="kendala">Kendala :</Label>
                <Textarea id="kendala" placeholder="" />
            </div>
            <div className="grid w-full gap-2">
                <Label htmlFor="catatan">Catatan :</Label>
                <Textarea id="catatan" placeholder="" />
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveAndDownload}>Simpan</Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default LaporanKerjaPage;
