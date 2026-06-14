"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Gamepad2, Brain, CloudRain, Wind, Loader2, ChevronRight, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type Category = "Cirrus" | "Altocumulus" | "Cumulonimbus";
type GameState = "START" | "CATEGORY" | "LOADING" | "PLAYING" | "RESULT" | "LEADERBOARD";

interface Question {
  id: number;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
  category: Category;
}

export default function PermainanPage() {
  const [gameState, setGameState] = useState<GameState>("START");
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState<Category>("Cirrus");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [leaderboards, setLeaderboards] = useState<Record<Category, LeaderboardEntry[]>>({
    Cirrus: [],
    Altocumulus: [],
    Cumulonimbus: []
  });

  useEffect(() => {
    const saved = localStorage.getItem("meteo_leaderboard_v3");
    if (saved) setLeaderboards(JSON.parse(saved));
  }, []);

  const handleStart = () => {
    if (!username.trim()) return toast.error("Ketik nama dulu dong, bre!");
    setGameState("CATEGORY");
  };

  const selectCategory = async (cat: Category) => {
    setCategory(cat);
    setGameState("LOADING");
    try {
      const res = await fetch(`/api/permainan/questions?category=${cat}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("Kosong");
      setQuestions(data);
      setScore(0);
      setCurrentIdx(0);
      setGameState("PLAYING");
    } catch {
      toast.error("Gagal ambil soal. Pastikan GSheet sudah diisi sesuai kategori!");
      setGameState("CATEGORY");
    }
  };

  const handleAnswer = (option: string) => {
    const isCorrect = option === questions[currentIdx].answer;
    let newScore = score;
    
    if (isCorrect) {
      // Skor beda tiap level
      const points = category === "Cirrus" ? 10 : category === "Altocumulus" ? 25 : 50;
      newScore += points;
      setScore(newScore);
      toast.success("BENAR! +" + points, { icon: "🔥" });
    } else {
      toast.error("SALAH! Jawabannya: " + questions[currentIdx].answer);
    }

    setTimeout(() => {
      if (currentIdx + 1 < questions.length) {
        setCurrentIdx(currentIdx + 1);
      } else {
        finishGame(newScore);
      }
    }, 1200);
  };

  const finishGame = async (finalScore: number) => {
    setGameState("RESULT");
    const newEntry: LeaderboardEntry = {
      name: username,
      score: finalScore,
      category: category,
      date: new Date().toLocaleDateString("id-ID")
    };

    const updated = { ...leaderboards };
    updated[category] = [...(updated[category] || []), newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    setLeaderboards(updated);
    localStorage.setItem("meteo_leaderboard_v3", JSON.stringify(updated));

    // Kirim ke GSheet
    fetch('/api/permainan/score', {
      method: 'POST',
      body: JSON.stringify({ type: "SAVE_SCORE", name: username, score: finalScore, category })
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl min-h-[90vh] flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {gameState === "START" && (
          <motion.div key="start" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
            <Card className="border-2 border-primary/20 bg-background/40 backdrop-blur-2xl">
              <CardHeader className="text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-xl">
                  <Gamepad2 className="w-10 h-10 text-primary" />
                </div>
                <CardTitle className="text-4xl font-black tracking-tighter">METEO QUIZ</CardTitle>
                <CardDescription>Pilih nama kerensmu untuk masuk leaderboard!</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Nama Panggung..." value={username} onChange={(e) => setUsername(e.target.value)} className="text-center text-xl h-14 font-bold" />
                <Button onClick={handleStart} className="w-full h-14 text-xl font-bold shadow-lg shadow-primary/20">MASUK GAME</Button>
                <Button variant="outline" onClick={() => setGameState("LEADERBOARD")} className="w-full h-12">LIHAT RANKING</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {gameState === "CATEGORY" && (
          <motion.div key="cat" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-full space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-black tracking-tight mb-2">PILIH LEVEL</h2>
              <p className="text-muted-foreground">Makin tebal awannya, makin sulit soalnya!</p>
            </div>
            <div className="grid gap-4">
              {[
                { id: "Cirrus", label: "Cirrus", color: "text-blue-400", bg: "bg-blue-500/10", icon: CloudRain, desc: "Level Gampang - Dasar cuaca" },
                { id: "Altocumulus", label: "Altocumulus", color: "text-amber-500", bg: "bg-amber-500/10", icon: Wind, desc: "Level Medium - Instrumen & Fisika" },
                { id: "Cumulonimbus", label: "Cumulonimbus", color: "text-red-500", bg: "bg-red-500/10", icon: Zap, desc: "Level Hard - Teori & Analisis Berat" }
              ].map((item) => (
                <button key={item.id} onClick={() => selectCategory(item.id as Category)} className={`flex items-center gap-5 p-6 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${item.bg} border-primary/5 hover:border-primary`}>
                  <div className={`p-4 rounded-xl bg-background ${item.color}`}><item.icon className="w-8 h-8" /></div>
                  <div className="flex-1">
                    <div className="font-black text-xl">{item.label}</div>
                    <div className="text-sm opacity-70">{item.desc}</div>
                  </div>
                  <ChevronRight className="opacity-30" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {gameState === "LOADING" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6">
            <div className="relative">
              <Loader2 className="w-20 h-20 animate-spin text-primary mx-auto" />
              <div className="absolute inset-0 flex items-center justify-center font-black text-xs">AI</div>
            </div>
            <p className="font-bold text-xl animate-pulse">Menghitung tekanan atmosfer...</p>
          </motion.div>
        )}

        {gameState === "PLAYING" && questions.length > 0 && (
          <motion.div key="playing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
            <div className="mb-4 flex justify-between items-end px-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">LEVEL {category}</p>
                <h3 className="text-2xl font-black">SOAL {currentIdx + 1}<span className="text-primary/30 text-sm ml-1">/{questions.length}</span></h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black opacity-50">SKOR SEKARANG</p>
                <div className="text-3xl font-black text-primary">{score}</div>
              </div>
            </div>
            <Card className="border-4 border-primary shadow-2xl overflow-hidden rounded-3xl">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-10 text-center leading-tight">{questions[currentIdx].question}</h2>
                <div className="grid gap-3">
                  {questions[currentIdx].options.map((opt, i) => (
                    <Button key={i} variant="secondary" className="h-auto py-5 text-lg font-bold justify-start px-8 rounded-2xl hover:bg-primary hover:text-white transition-colors border-2 border-transparent hover:border-white/20" onClick={() => handleAnswer(opt)}>
                      <span className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center mr-4 text-sm">{String.fromCharCode(65 + i)}</span>
                      {opt}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {gameState === "RESULT" && (
          <motion.div key="result" initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="w-full text-center">
            <Card className="border-4 border-primary rounded-[3rem] bg-gradient-to-b from-primary/10 to-transparent">
              <CardHeader className="pt-12">
                <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-yellow-500/40">
                  <Trophy className="w-12 h-12 text-black" />
                </div>
                <CardTitle className="text-5xl font-black italic">MANTAP, BRE!</CardTitle>
                <CardDescription className="text-xl font-bold">Skor Akhir {username} di Level {category}:</CardDescription>
              </CardHeader>
              <CardContent className="pb-12 space-y-6">
                <div className="text-8xl font-black text-primary drop-shadow-lg">{score}</div>
                <div className="flex flex-col gap-3">
                  <Button onClick={() => setGameState("CATEGORY")} className="h-14 text-xl font-black rounded-2xl">MAIN LAGI</Button>
                  <Button variant="ghost" onClick={() => setGameState("START")} className="font-bold">KEMBALI KE MENU</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {gameState === "LEADERBOARD" && (
          <motion.div key="leader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
            <Card className="rounded-[2rem] border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-black flex items-center justify-center gap-3">
                  <Trophy className="text-yellow-500" /> TOP SKOR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex bg-muted p-1 rounded-xl mb-6">
                  {(["Cirrus", "Altocumulus", "Cumulonimbus"] as Category[]).map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${category === cat ? "bg-background shadow-sm text-primary" : "opacity-40"}`}>{cat.toUpperCase()}</button>
                  ))}
                </div>
                <div className="space-y-2 min-h-[300px]">
                  {(!leaderboards[category] || leaderboards[category].length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-[300px] opacity-20"><Brain className="w-16 h-16 mb-2" /><p className="font-bold text-sm">Belum ada data</p></div>
                  ) : (
                    leaderboards[category].map((entry, i) => (
                      <div key={i} className={`flex justify-between items-center p-4 rounded-2xl border ${i === 0 ? "bg-primary/5 border-primary/20 scale-[1.02]" : "bg-muted/30 border-transparent"}`}>
                        <div className="flex items-center gap-4">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${i === 0 ? "bg-yellow-500 text-black" : "bg-black/5"}`}>{i+1}</span>
                          <span className="font-black text-lg">{entry.name}</span>
                        </div>
                        <span className="text-2xl font-black text-primary">{entry.score}</span>
                      </div>
                    ))
                  )}
                </div>
                <Button variant="outline" onClick={() => setGameState("START")} className="w-full mt-8 rounded-xl h-12 font-black">KEMBALI</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
