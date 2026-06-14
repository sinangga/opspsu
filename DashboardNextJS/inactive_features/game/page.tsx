"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Trophy, 
  Timer, 
  User, 
  Gamepad2, 
  ChevronRight, 
  CheckCircle2, 
  XCircle,
  Medal,
  Zap,
  RotateCcw,
  Loader2,
  Star
} from "lucide-react";
import questionsData from "@/data/quiz/questions.json";
import { cn } from "@/lib/utils";

type Question = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

type Level = "easy" | "medium" | "hard";

type LeaderboardEntry = {
  playerName: string;
  score: number;
  timestamp: string;
};

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const getTitle = (s: number) => {
  const total = s * 10;
  if (total === 100) return "Weather Master";
  if (total >= 80) return "Storm Chaser";
  if (total >= 50) return "Cloud Watcher";
  return "Sky Observer";
};

const getThemeClasses = (s: number) => {
  const total = s * 10;
  if (total === 100) return "bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 text-white shadow-yellow-500/40 border-yellow-300";
  if (total >= 80) return "bg-gradient-to-br from-slate-200 via-slate-400 to-slate-500 text-slate-900 shadow-slate-400/40 border-slate-300";
  if (total >= 50) return "bg-gradient-to-br from-orange-300 via-orange-500 to-orange-600 text-white shadow-orange-500/40 border-orange-400";
  return "bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 text-white shadow-blue-500/40 border-blue-300";
};

const GamePage = () => {
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [gameState, setGameState] = useState<"name-entry" | "level-select" | "playing" | "result">("name-entry");
  const [level, setLevel] = useState<Level>("easy");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [leaderboard, setLeaderboard] = useState<Record<string, LeaderboardEntry[]>>({
    easy: [],
    medium: [],
    hard: []
  });
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/permainan/leaderboard", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
        return data;
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    }
    return null;
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleNextQuestion = useCallback(() => {
    setShowExplanation(false);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setTimeLeft(10);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setGameState("result");
    }
  }, [currentQuestionIndex, questions.length]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (gameState === "playing" && !showExplanation) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleNextQuestion();
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [gameState, showExplanation, handleNextQuestion]);

  useEffect(() => {
    if (gameState === "result" && !scoreSubmitted && playerName) {
      const submitScore = async () => {
        try {
          await fetch("/api/permainan/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerName, score, level }),
          });
          setScoreSubmitted(true);
          fetchLeaderboard();
        } catch (error) { console.error(error); }
      };
      submitScore();
    }
  }, [gameState, scoreSubmitted, playerName, score, level, fetchLeaderboard]);

  const handleNameSubmit = async () => {
    if (!playerName.trim()) {
      setNameError("Masukkan nama Anda!");
      return;
    }
    
    setIsValidating(true);
    setNameError("");

    const latestData = await fetchLeaderboard();
    await new Promise(resolve => setTimeout(resolve, 800));

    if (latestData) {
      const nameToRegister = playerName.trim().toLowerCase();
      const isTaken = ['easy', 'medium', 'hard'].some(lvl => 
        (latestData[lvl] || []).some((entry: LeaderboardEntry) => entry.playerName.toLowerCase() === nameToRegister)
      );

      if (isTaken) {
        setNameError("Nama sudah terdaftar hari ini! Gunakan nama lain.");
        setIsValidating(false);
        return;
      }
    }

    setIsValidating(false);
    setGameState("level-select");
  };

  const startQuiz = (selectedLevel: Level) => {
    const all = questionsData[selectedLevel];
    const shuffledQuestions = shuffleArray([...all]).slice(0, 10).map(q => ({
      ...q,
      options: shuffleArray([...q.options])
    }));
    setQuestions(shuffledQuestions);
    setLevel(selectedLevel);
    setCurrentQuestionIndex(0);
    setScore(0);
    setTimeLeft(10);
    setScoreSubmitted(false);
    setGameState("playing");
  };

  const handleAnswer = (option: string) => {
    if (showExplanation) return;
    setSelectedAnswer(option);
    const correct = option === questions[currentQuestionIndex].answer;
    setIsCorrect(correct);
    if (correct) setScore((s) => s + 1);
    setShowExplanation(true);
    setTimeout(handleNextQuestion, 5000);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-y-auto">
      <AnimatePresence mode="wait">
        
        {/* PHASE 1: NAME ENTRY */}
        {gameState === "name-entry" && (
          <motion.div
            key="name-entry"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-4xl space-y-12 py-10"
          >
            <Card className="max-w-md mx-auto border-none shadow-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden rounded-[2rem]">
              <div className="h-2 w-full bg-primary/20" />
              <CardHeader className="text-center pb-2 pt-8 text-slate-900 dark:text-white">
                <div className="mx-auto bg-primary/10 w-20 h-20 rounded-2xl flex items-center justify-center mb-6 rotate-3">
                  <Gamepad2 className="w-10 h-10 text-primary -rotate-3" />
                </div>
                <CardTitle className="text-4xl font-black tracking-tighter uppercase italic">
                  Weather <span className="text-primary">Master</span>
                </CardTitle>
                <CardDescription className="text-base mt-2 px-4 text-center">
                  Masukkan namamu untuk mulai tantangan!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6 p-8">
                <div className="space-y-3 text-slate-900 dark:text-white">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">ID Pemain (Harus Unik)</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/50" />
                    <Input
                      id="name"
                      placeholder="Masukkan nama..."
                      disabled={isValidating}
                      className={cn(
                        "pl-12 h-14 text-xl font-bold bg-white dark:bg-slate-800 border-2 focus-visible:ring-primary rounded-2xl transition-all",
                        nameError && "border-red-500 focus-visible:ring-red-500 text-red-500",
                        isValidating && "opacity-50"
                      )}
                      value={playerName}
                      onChange={(e) => {
                        setPlayerName(e.target.value);
                        if (nameError) setNameError("");
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && !isValidating && handleNameSubmit()}
                      maxLength={20}
                    />
                  </div>
                  {nameError && (
                    <p className="text-red-500 text-xs font-bold mt-1 ml-1 animate-pulse text-center">{nameError}</p>
                  )}
                </div>
                <Button 
                  className="w-full h-14 text-xl font-black uppercase italic rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 group" 
                  onClick={handleNameSubmit}
                  disabled={isValidating || !playerName.trim()}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Mengecek...
                    </>
                  ) : (
                    <>
                      Lanjut
                      <ChevronRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <LeaderboardDisplay leaderboard={leaderboard} activeLevel={level} onLevelChange={(l) => setLevel(l)} />
          </motion.div>
        )}

        {/* PHASE 2: LEVEL SELECTION */}
        {gameState === "level-select" && (
          <motion.div
            key="level-select"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-4xl space-y-12 py-10 text-center"
          >
            <div className="space-y-4">
              <h2 className="text-5xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white">
                Halo, <span className="text-primary">{playerName}</span>!
              </h2>
              <p className="text-xl font-bold text-muted-foreground uppercase tracking-widest">Pilih Tingkat Kesulitanmu</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { id: "easy", title: "Santai", desc: "🌱 Dasar Meteorologi", color: "bg-green-600 hover:bg-green-700 shadow-green-600/20" },
                { id: "medium", title: "Menantang", desc: "🌤️ Standar Cuaca", color: "bg-yellow-600 hover:bg-yellow-700 shadow-yellow-600/20" },
                { id: "hard", title: "Ekstrem", desc: "⛈️ Ahli Meteorologi", color: "bg-red-600 hover:bg-red-700 shadow-red-600/20" }
              ].map((l) => (
                <motion.div key={l.id} whileHover={{ y: -8 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Button 
                    className={cn("w-full h-40 flex flex-col items-center justify-center gap-2 rounded-[2rem] shadow-xl transition-all text-white", l.color)}
                    onClick={() => startQuiz(l.id as Level)}
                  >
                    <span className="text-3xl font-black uppercase italic tracking-tighter">{l.title}</span>
                    <span className="text-xs font-bold opacity-80">{l.desc}</span>
                  </Button>
                </motion.div>
              ))}
            </div>

            <Button variant="ghost" className="rounded-full font-bold text-muted-foreground hover:text-primary" onClick={() => setGameState("name-entry")}>
              <RotateCcw className="w-4 h-4 mr-2" /> Ganti Nama
            </Button>
          </motion.div>
        )}

        {/* PHASE 3: PLAYING */}
        {gameState === "playing" && questions.length > 0 && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-3xl space-y-6"
          >
            <div className="flex justify-between items-end mb-2 px-4 text-slate-900 dark:text-white">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Progress</span>
                <div className="text-3xl font-black italic tracking-tighter">SOAL {currentQuestionIndex + 1}<span className="text-muted-foreground/30 text-xl not-italic ml-1">/10</span></div>
              </div>
              <div className="text-right space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Skor</span>
                <div className="text-3xl font-black text-primary flex items-center justify-end gap-2 italic tracking-tighter">
                  <Zap className="w-6 h-6 fill-primary" /> {score * 10}
                </div>
              </div>
            </div>

            <Card className="border-none shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800">
                <motion.div 
                  className={cn(
                    "h-full transition-colors duration-500",
                    timeLeft > 5 ? "bg-primary" : timeLeft > 2 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  initial={{ width: "100%" }}
                  animate={{ width: `${(timeLeft / 10) * 100}%` }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </div>
              
              <CardHeader className="pt-12 pb-8 text-center px-10">
                <div className={cn(
                  "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-8 border-2 transition-all duration-300",
                  timeLeft <= 3 ? "text-red-500 border-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground border-slate-200 dark:border-slate-700"
                )}>
                  <Timer className="w-3.5 h-3.5" />
                  {timeLeft} Detik
                </div>
                <CardTitle className="text-2xl md:text-4xl font-black leading-[1.1] tracking-tight text-slate-900 dark:text-white px-2">
                  {questions[currentQuestionIndex].question}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-10 pt-4 space-y-6">
                <div className="grid grid-cols-1 gap-4 text-slate-900 dark:text-white">
                  {questions[currentQuestionIndex].options.map((option, idx) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrectAnswer = option === questions[currentQuestionIndex].answer;
                    
                    let btnStyle = "border-2 border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 hover:border-primary/50 hover:bg-primary/5";
                    if (showExplanation) {
                      if (isCorrect) {
                        if (isCorrectAnswer) btnStyle = "bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/30 ring-4 ring-green-500/20";
                        else btnStyle = "opacity-30 grayscale-[0.8] scale-95";
                      } else {
                        if (isSelected) btnStyle = "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30 opacity-100 ring-4 ring-red-500/20";
                        else btnStyle = "opacity-30 grayscale-[0.8] scale-95";
                      }
                    } else if (isSelected) {
                      btnStyle = "border-primary bg-primary/10 ring-4 ring-primary/10";
                    }

                    return (
                      <motion.button
                        key={idx}
                        whileHover={!showExplanation ? { x: 8 } : {}}
                        whileTap={!showExplanation ? { scale: 0.98 } : {}}
                        onClick={() => handleAnswer(option)}
                        disabled={showExplanation}
                        className={cn(
                          "w-full p-6 rounded-2xl text-left text-lg font-bold transition-all duration-300 flex items-center justify-between group",
                          btnStyle
                        )}
                      >
                        <span className="flex-1">{option}</span>
                        {showExplanation && isCorrect && isCorrectAnswer && <CheckCircle2 className="w-6 h-6 ml-2 shrink-0" />}
                        {showExplanation && !isCorrect && isSelected && <XCircle className="w-6 h-6 ml-2 shrink-0" />}
                      </motion.button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {showExplanation && isCorrect && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 overflow-hidden"
                    >
                      <div className={cn(
                        "p-6 rounded-[2rem] border-2 shadow-xl backdrop-blur-sm relative overflow-hidden bg-green-500/10 border-green-500/30"
                      )}>
                        <div className="absolute top-0 left-0 w-2 h-full bg-green-500" />
                        <h4 className="font-black uppercase tracking-widest text-sm mb-3 flex items-center gap-2 italic text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4" /> Brilian!
                        </h4>
                        <p className="text-base font-medium leading-relaxed opacity-90 text-slate-700 dark:text-slate-300">
                          {questions[currentQuestionIndex].explanation}
                        </p>
                      </div>
                    </motion.div>
                  )}
                  {showExplanation && !isCorrect && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 overflow-hidden"
                    >
                      <div className="p-6 rounded-[2rem] border-2 shadow-xl backdrop-blur-sm relative overflow-hidden bg-red-500/10 border-red-500/30">
                        <div className="absolute top-0 left-0 w-2 h-full bg-red-500" />
                        <h4 className="font-black uppercase tracking-widest text-sm mb-1 flex items-center gap-2 italic text-red-600 dark:text-red-400">
                          <XCircle className="w-4 h-4" /> Jawaban Salah!
                        </h4>
                        <p className="text-sm font-bold opacity-80 italic text-slate-700 dark:text-slate-300">Coba lagi di pertanyaan berikutnya atau saat mengulang nanti.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* PHASE 4: RESULT */}
        {gameState === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-5xl space-y-8 py-12"
          >
            <div className="grid md:grid-cols-12 gap-8 items-stretch">
              <Card className={cn(
                "md:col-span-5 border-none shadow-2xl rounded-[3rem] overflow-hidden relative",
                getThemeClasses(score)
              )}>
                <Trophy className="w-64 h-64 absolute -bottom-10 -right-10 opacity-10 rotate-12" />
                <CardContent className="p-12 text-center space-y-8 h-full flex flex-col justify-center relative z-10">
                  <div className="space-y-4">
                    <h2 className="text-2xl font-black uppercase italic tracking-widest opacity-80">Misi Selesai</h2>
                    <div className="relative inline-block text-white">
                      <motion.p 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="text-9xl font-black italic tracking-tighter"
                      >
                        {score * 10}
                      </motion.p>
                      <Star className="w-12 h-12 fill-current absolute -top-4 -right-8 animate-pulse" />
                    </div>
                    <div className="inline-block px-6 py-2 bg-white/20 backdrop-blur-md rounded-full font-black uppercase italic tracking-widest border border-white/30 text-white">
                      {getTitle(score)}
                    </div>
                    <p className="text-lg font-bold opacity-90 tracking-tight pt-4">{playerName}, pencapaian luar biasa!</p>
                  </div>
                  <Button 
                    variant="secondary" 
                    className="w-full font-black uppercase italic tracking-widest h-16 rounded-2xl text-xl shadow-xl hover:scale-[1.02] transition-transform bg-white text-slate-900"
                    onClick={() => { setGameState("name-entry"); setPlayerName(""); setScoreSubmitted(false); }}
                  >
                    Main Lagi
                  </Button>
                </CardContent>
              </Card>

              <div className="md:col-span-7 space-y-6">
                <LeaderboardDisplay leaderboard={leaderboard} activeLevel={level} onLevelChange={(l) => setLevel(l)} />
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

// Leaderboard Display Component
const LeaderboardDisplay: React.FC<{ 
  leaderboard: Record<string, LeaderboardEntry[]>, 
  activeLevel: Level,
  onLevelChange: (l: Level) => void 
}> = ({ leaderboard, activeLevel, onLevelChange }) => {
  const currentData = leaderboard[activeLevel] || [];

  return (
    <Card className="w-full border-none shadow-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[3rem] overflow-hidden">
      <CardHeader className="pb-4 pt-8 px-8">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-3">
            <Medal className="w-8 h-8 text-yellow-500" />
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-center text-slate-900 dark:text-white">Hall of <span className="text-primary">Fame</span></CardTitle>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">Top 10 Today</span>
        </div>
        <div className="flex gap-2 text-center">
          {(['easy', 'medium', 'hard'] as Level[]).map((l) => (
            <Button 
              key={l} 
              variant={activeLevel === l ? "default" : "outline"} 
              size="sm" 
              className="rounded-full text-[10px] font-black uppercase tracking-widest h-8 flex-1"
              onClick={() => onLevelChange(l)}
            >
              {l === 'easy' ? '🌱' : l === 'medium' ? '🌤️' : '⛈️'} {l}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3 text-slate-900 dark:text-white">
          {currentData.length > 0 ? (
            currentData.map((entry, i) => {
              const title = getTitle(entry.score);
              const isTop = i === 0;
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: i * 0.05 }} 
                  key={i} 
                  className={cn(
                    "flex items-center justify-between p-5 rounded-[1.5rem] transition-all",
                    isTop ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg scale-[1.02]" : "bg-white dark:bg-slate-800/40"
                  )}
                >
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-black italic text-lg shadow-inner",
                      isTop ? "bg-white/20" : i === 1 ? "bg-slate-300 text-slate-700" : i === 2 ? "bg-amber-600/20 text-amber-700" : "bg-slate-100 dark:bg-slate-700 text-muted-foreground"
                    )}>{i + 1}</div>
                    <div className="flex flex-col">
                      <span className="font-black uppercase tracking-tighter text-lg leading-none">{entry.playerName}</span>
                      <span className={cn("text-[8px] font-bold uppercase tracking-widest mt-1", isTop ? "text-white/70" : "text-primary/70")}>
                        {title}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn("font-black text-2xl italic tracking-tighter", isTop ? "text-white" : "text-primary")}>{entry.score * 10}</span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
              <Trophy className="w-12 h-12 mb-4" />
              <p className="font-black uppercase tracking-widest text-[10px]">Belum ada catatan di level ini</p>
            </div>
          )}
        </div>
        <p className="text-center mt-8 text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 italic">Reset Otomatis 00:00 UTC</p>
      </CardContent>
    </Card>
  );
};

export default GamePage;