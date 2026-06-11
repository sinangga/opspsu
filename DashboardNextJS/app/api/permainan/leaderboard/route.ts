import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LEADERBOARD_PATH = path.join(process.cwd(), 'data/quiz/leaderboard.json');

export async function GET() {
  try {
    if (!fs.existsSync(LEADERBOARD_PATH)) {
      return NextResponse.json({ easy: [], medium: [], hard: [] });
    }

    const data = JSON.parse(fs.readFileSync(LEADERBOARD_PATH, 'utf8'));
    const now = new Date();
    const todayUTC = now.toISOString().split('T')[0]; // Format YYYY-MM-DD

    // Logika Reset 00:00 UTC
    if (data.lastReset !== todayUTC) {
      data.lastReset = todayUTC;
      data.easy = [];
      data.medium = [];
      data.hard = [];
      fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify(data, null, 2));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    return NextResponse.json({ error: 'Gagal memuat leaderboard' }, { status: 500 });
  }
}
