import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LEADERBOARD_PATH = path.join(process.cwd(), 'data/quiz/leaderboard.json');

type LeaderboardEntry = {
  playerName: string;
  score: number;
  timestamp: string;
};

type LeaderboardData = {
  lastReset: string;
  easy: LeaderboardEntry[];
  medium: LeaderboardEntry[];
  hard: LeaderboardEntry[];
};

export async function POST(request: Request) {
  try {
    const { playerName, score, level } = await request.json();

    // Validasi input
    if (!playerName || typeof score !== 'number' || !['easy', 'medium', 'hard'].includes(level)) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
    }

    const nameToSave = playerName.trim().replace(/['"=+\-]/g, '').slice(0, 20);
    
    // Baca data saat ini
    if (!fs.existsSync(LEADERBOARD_PATH)) {
      const initialData: LeaderboardData = { lastReset: "", easy: [], medium: [], hard: [] };
      fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify(initialData));
    }
    const data: LeaderboardData = JSON.parse(fs.readFileSync(LEADERBOARD_PATH, 'utf8'));
    
    // Cek duplikasi nama di SEMUA level (case-insensitive)
    const allNames = [...data.easy, ...data.medium, ...data.hard].map(e => e.playerName.toLowerCase());
    if (allNames.includes(nameToSave.toLowerCase())) {
      return NextResponse.json({ error: 'Nama sudah digunakan, pilih nama lain!' }, { status: 409 });
    }

    // Tambahkan skor baru
    const newEntry: LeaderboardEntry = {
      playerName: nameToSave,
      score,
      timestamp: new Date().toISOString()
    };

    if (level === 'easy' || level === 'medium' || level === 'hard') {
      data[level as keyof Omit<LeaderboardData, 'lastReset'>].push(newEntry);

      // Urutkan dan ambil top 10
      data[level as keyof Omit<LeaderboardData, 'lastReset'>].sort((a, b) => b.score - a.score || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      data[level as keyof Omit<LeaderboardData, 'lastReset'>] = data[level as keyof Omit<LeaderboardData, 'lastReset'>].slice(0, 10);
    }

    // Simpan kembali
    fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify(data, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Score submission error:", error);
    return NextResponse.json({ error: 'Gagal menyimpan skor' }, { status: 500 });
  }
}