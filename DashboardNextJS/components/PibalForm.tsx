"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type PibalFormValues = {
  code: string;
  ascentRate: number;
};

type PibalFormProps = {
  defaultCode: string;
  defaultAscentRate: number;
  lastLevelCount: number;
  error?: string | null;
  onGenerate: (values: PibalFormValues) => void;
};

export function PibalForm({
  defaultCode,
  defaultAscentRate,
  lastLevelCount,
  error,
  onGenerate,
}: PibalFormProps) {
  const [code, setCode] = useState(defaultCode);
  const [ascentRate, setAscentRate] = useState(`${defaultAscentRate}`);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedRate = Number(ascentRate);
    const sanitizedRate = Number.isFinite(parsedRate) ? parsedRate : defaultAscentRate;

    onGenerate({
      code,
      ascentRate: sanitizedRate,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">Input PIBAL</p>
        <h2 className="text-2xl font-semibold">Pilot Balloon Parser</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tempelkan kode PIBAL BMKG lalu set laju kenaikan balon. Klik &ldquo;Generate Model&rdquo; untuk menggambar lintasan.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pibal-code">Kode PIBAL</Label>
        <Textarea
          id="pibal-code"
          rows={12}
          value={code}
          spellCheck={false}
          onChange={(event) => setCode(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Terbaca <span className="font-semibold text-foreground">{lastLevelCount}</span> level angin dari input terakhir.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ascent-rate">
          Laju Kenaikan Vertikal
          <span className="text-xs font-normal text-muted-foreground">(meter/detik)</span>
        </Label>
        <Input
          id="ascent-rate"
          type="number"
          step="0.5"
          min="0.5"
          value={ascentRate}
          onChange={(event) => setAscentRate(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Default model fisika menggunakan 5 m/detik.</p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button type="submit" className="w-full">Generate Model</Button>
    </form>
  );
}
