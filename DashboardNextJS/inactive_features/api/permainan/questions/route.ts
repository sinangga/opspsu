import { NextResponse } from 'next/server';

// AI Question Bank (Fallback & Primary Source)
const AI_QUESTIONS = {
  Cirrus: [
    { id: 1, category: "Cirrus", question: "Apa alat pengukur kecepatan angin?", options: ["Termometer", "Anemometer", "Barometer", "Hygrometer"], answer: "Anemometer", explanation: "Anemometer mengukur kecepatan angin menggunakan cup yang berputar." },
    { id: 2, category: "Cirrus", question: "Warna langit saat cerah disebabkan oleh hamburan...?", options: ["Mie", "Rayleigh", "Hygroscopic", "Refraksi"], answer: "Rayleigh", explanation: "Hamburan Rayleigh menyebarkan cahaya biru lebih banyak daripada warna lain." },
    { id: 3, category: "Cirrus", question: "Awan yang berbentuk seperti kapas putih terpisah-pisah adalah?", options: ["Stratus", "Cumulus", "Cirrus", "Nimbus"], answer: "Cumulus", explanation: "Cumulus adalah awan puncaknya menyerupai bunga kol." },
    { id: 4, category: "Cirrus", question: "Satuan curah hujan yang digunakan BMKG adalah?", options: ["Celsius", "Knot", "Milimeter (mm)", "Pascal"], answer: "Milimeter (mm)", explanation: "Curah hujan diukur berdasarkan ketinggian air yang tertampung dalam mm." },
    { id: 5, category: "Cirrus", question: "Angin yang bertiup dari laut ke darat pada siang hari disebut?", options: ["Angin Darat", "Angin Laut", "Angin Gunung", "Angin Lembah"], answer: "Angin Laut", explanation: "Terjadi karena daratan lebih cepat panas daripada lautan pada siang hari." }
  ],
  Altocumulus: [
    { id: 11, category: "Altocumulus", question: "Lapisan atmosfer tempat terjadinya fenomena cuaca adalah?", options: ["Stratosfer", "Mesosfer", "Troposfer", "Termosfer"], answer: "Troposfer", explanation: "Troposfer mengandung 99% uap air atmosfer bumi." },
    { id: 12, category: "Altocumulus", question: "Tekanan udara standar di permukaan laut adalah?", options: ["1000 hPa", "1013.25 hPa", "980 hPa", "1025 hPa"], answer: "1013.25 hPa", explanation: "Ini adalah nilai rata-rata tekanan atmosfer global." },
    { id: 13, category: "Altocumulus", question: "Gaya yang membelokkan arah angin karena rotasi bumi adalah?", options: ["Gaya Gravitasi", "Gaya Coriolis", "Gaya Friksi", "Gaya Sentrifugal"], answer: "Gaya Coriolis", explanation: "Coriolis membelokkan angin ke kanan di BBU dan ke kiri di BBS." },
    { id: 14, category: "Altocumulus", question: "Awan menengah yang menyerupai gumpalan kecil atau sisik?", options: ["Altocumulus", "Cirrocumulus", "Stratocumulus", "Nimbostratus"], answer: "Altocumulus", explanation: "Terbentuk di ketinggian 2-7km dengan tekstur bergelombang." },
    { id: 15, category: "Altocumulus", question: "Garis pada peta yang menghubungkan titik tekanan yang sama?", options: ["Isoterm", "Isobar", "Isohyet", "Isogon"], answer: "Isobar", explanation: "Isobar digunakan untuk menganalisis sistem tekanan tinggi dan rendah." }
  ],
  Cumulonimbus: [
    { id: 21, category: "Cumulonimbus", question: "Apa singkatan ITCZ dalam meteorologi?", options: ["International Tropical Cloud Zone", "Inter-Tropical Convergence Zone", "Inner Tropical Cyclone Zone", "Inter-Tropical Current Zone"], answer: "Inter-Tropical Convergence Zone", explanation: "ITCZ adalah area pertemuan angin pasat di khatulistiwa." },
    { id: 22, category: "Cumulonimbus", question: "Parameter CAPE digunakan untuk mengukur?", options: ["Curah Hujan", "Stabilitas Atmosfer", "Kecepatan Angin", "Tekanan Gas"], answer: "Stabilitas Atmosfer", explanation: "CAPE mengukur potensi energi kinetik vertikal dalam parsel udara." },
    { id: 23, category: "Cumulonimbus", question: "Gelombang atmosfer yang bergerak ke timur di khatulistiwa?", options: ["El Nino", "MJO", "IOD", "Kelvin Wave"], answer: "MJO", explanation: "MJO (Madden-Julian Oscillation) adalah pendorong utama variabilitas cuaca tropis." },
    { id: 24, category: "Cumulonimbus", question: "Awan lenticularis sering terbentuk akibat gelombang di?", options: ["Lautan Luas", "Pegunungan", "Hutan Tropis", "Lembah Dalam"], answer: "Pegunungan", explanation: "Lenticularis terbentuk dari udara yang dipaksa naik oleh topografi (orografi)." },
    { id: 25, category: "Cumulonimbus", question: "Suhu udara akan turun secara teoritis sebesar 0.6C tiap naik 100m, disebut?", options: ["Adiabatic Rate", "Lapse Rate", "Thermal Gradient", "Inversi"], answer: "Lapse Rate", explanation: "Ini adalah normal lapse rate di lapisan troposfer." }
  ]
};

const GSHEET_WEBAPP_URL = process.env.GSHEET_WEBAPP_URL || '';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as keyof typeof AI_QUESTIONS;

    // 1. Coba ambil dari GSheet dulu
    if (GSHEET_WEBAPP_URL) {
      try {
        const res = await fetch(`${GSHEET_WEBAPP_URL}?category=${category}`, { cache: 'no-store' });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return NextResponse.json(data);
        }
      } catch (error) {
        console.log("GSheet fetch failed, using AI fallback", error);
      }
    }

    // 2. Fallback ke AI Question Bank saya
    const pool = AI_QUESTIONS[category] || AI_QUESTIONS.Cirrus;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    
    return NextResponse.json(shuffled);
  } catch (error) {
    console.error("Questions fetch error:", error);
    return NextResponse.json({ error: 'Gagal memuat pertanyaan' }, { status: 500 });
  }
}