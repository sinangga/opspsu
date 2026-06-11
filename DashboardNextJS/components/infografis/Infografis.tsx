"use client";
import { STATUS_TO_ICON } from "@/lib/icons";

type Row = {
  kecamatan: string;
  cuaca: string[]; // labels
  icons?: (string | null)[]; // icon urls per slot
  suhu: string;
  rh: string;
  arah: string;
  angin: string;
};

type Props = {
  title: string;
  dateLabel: string;
  hours: string[]; // 8 items
  rows: Row[];
};

const WIDTH = 1200;
// Reduce overall canvas height to make layout more compact
const HEIGHT = 1500;
const BMKG_DARK = '#0f172a';
const BMKG_PRIMARY = '#1e40af';
const BMKG_ACCENT = '#38bdf8';
const BMKG_BG = '#ecf5fb';

export default function Infografis({ title, dateLabel, hours, rows }: Props) {
  const ICON_ORDER = [
    'Cerah',
    'Cerah Berawan',
    'Berawan',
    'Kabut/Asap',
    'Udara Kabur',
    'Hujan Ringan',
    'Hujan Sedang',
    'Hujan Lebat',
    'Hujan Petir',
    'Petir',
  ].filter((k) => STATUS_TO_ICON[k]);

  return (
    <div
      className={undefined as unknown as string}
      style={{
        width: WIDTH,
        height: HEIGHT,
        background: BMKG_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 12px 18px 12px',
        fontFamily: 'Tahoma, Verdana, Segoe, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
          borderRadius: 28,
          boxShadow: '0 22px 60px rgba(15,23,42,0.14)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 24px', background: `linear-gradient(135deg, ${BMKG_DARK} 0%, ${BMKG_PRIMARY} 50%, ${BMKG_ACCENT} 100%)`, color: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <div style={{ width: 90, height: 90, borderRadius: 24, background: '#e6f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(191,219,254,0.9)', boxShadow: '0 2px 6px rgba(30,64,175,0.25)' }}>
              <img src="data:image/png;base64,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" alt="BMKG" width={64} height={64} style={{ objectFit: 'contain' }} />
              </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.5 }}>BMKG - Stasiun Meteorologi Pangsuma Kapuas Hulu</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e0f2fe', marginTop: 4 }}>{title}</div>
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 800, background: 'rgba(148, 163, 184, 0.22)', color: '#f8fafc', padding: '7px 14px', borderRadius: 999 }}>
                <span>Berlaku</span>
                <span style={{ color: '#bae6fd' }}>{dateLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ padding: '10px 24px 0 24px', flex: 1 }}>
          <div style={{ border: '1px solid #d1d5db', borderRadius: 18, background: '#f9fafb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5, color: 'rgba(0,0,0,0.95)' }}>
              <colgroup>
                <col style={{ width: 220 }} />
                {hours.map((_, i) => (
                  <col key={i} style={{ width: 70 }} />
                ))}
                <col style={{ width: 90 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr style={{
                  background: `linear-gradient(135deg, ${BMKG_DARK} 0%, ${BMKG_PRIMARY} 50%, ${BMKG_ACCENT} 100%)`,
                  color: '#f8fafc',
                  boxShadow: '0 6px 14px rgba(15,23,42,0.18)',
                  position: 'relative',
                  zIndex: 1,
                }}>
                  <th style={{ ...thStyle, borderTopLeftRadius: 18 }}>KECAMATAN</th>
                  {hours.map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                  <th style={thStyle}>SUHU</th>
                  <th style={thStyle}>KELEMBAPAN</th>
                  <th style={thStyle}>ANGIN</th>
                  <th style={{ ...thStyle, borderTopRightRadius: 18 }}>KECEPATAN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.kecamatan} style={{ background: idx % 2 === 1 ? '#ffffff' : '#eef5ff' }}>
                    <td style={tdLeft}>{r.kecamatan}</td>
                    {r.cuaca.map((c, i) => (
                      <td key={i} style={tdCenter}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, position: 'relative' }}>
                          {(() => {
                            const raw = String(c ?? '');
                            const norm = raw
                              .toLowerCase()
                              .trim()
                              .replace(/[\s/_-]+/g, ' ') // unify separators
                              .replace(/[^a-z ]/g, ''); // drop punctuation
                            const isUdaraKabur = /^(udara kabur|kabur|kabut asap)$/.test(norm);
                            const forcedUdaraKabur = isUdaraKabur ? '/icon/udara-kabur.svg' : null;
                            const iconSrc = forcedUdaraKabur || r.icons?.[i] || STATUS_TO_ICON[raw.trim()] || STATUS_TO_ICON[norm] || STATUS_TO_ICON[raw];
                            return iconSrc ? (
                              <img src={iconSrc} width={32} height={32} alt={raw} />
                            ) : (
                              <span style={{ fontSize: 11 }}>{raw}</span>
                            );
                          })()}
                        </div>
                      </td>
                    ))}
                    <td style={tdValue}>{r.suhu}</td>
                    <td style={tdValue}>{r.rh}</td>
                    <td style={tdValue}>{r.arah}</td>
                    <td style={tdValue}>{r.angin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subheader + Legend */}
        <div style={{ padding: '0px 18px 0px 18px', background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2, textAlign: 'center', fontWeight: 600 }}>developed by Sinangga</div>
          {/* Legend block: single row spanning full width */}
          <div style={{
            borderRadius: 10,
            background: BMKG_PRIMARY,
            padding: '6px 8px',
            marginTop: 2,
            width: '96%',
            alignSelf: 'center',
            color: '#eaf2ff',
            border: '1px solid rgba(191,219,254,0.35)'
          }}>
            <div style={{
              display: 'grid',
              gridAutoFlow: 'column',
              gridAutoColumns: '1fr',
              gap: 10,
              alignItems: 'center',
            }}>
              {ICON_ORDER.map((key) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, justifyContent: 'center', padding: '2px 0' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.45)' }}>
                    <img src={STATUS_TO_ICON[key]} width={20} height={20} alt={key} style={{ display: 'block' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#eaf2ff', textAlign: 'center', lineHeight: 1.1 }}>{key}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: '100%', marginTop: 8, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{
              width: '100%',
              padding: '16px 24px',
              background: `linear-gradient(135deg, ${BMKG_DARK} 0%, ${BMKG_PRIMARY} 50%, ${BMKG_ACCENT} 100%)`,
              color: '#f8fafc',
              border: '1px solid rgba(191,219,254,0.4)',
              boxShadow: '0 10px 25px rgba(15,23,42,0.15)',
              textAlign: 'center',
              fontSize: 15.5,
              fontWeight: 900,
              letterSpacing: 0.3,
            }}>
              Stasiun Meteorologi Pangsuma – Kapuas Hulu
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  padding: '10px 8px',
  fontSize: 15.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textAlign: 'center',
  borderRight: '1px solid rgba(191,219,254,0.45)',
  background: 'transparent',
  color: '#f8fafc',
  textShadow: '0 1px 0 rgba(0,0,0,0.15)',
};

const tdLeft: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  padding: '6px 8px',
  fontSize: 14,
  fontWeight: 800,
  textAlign: 'center',
  borderRight: '1px solid rgba(148,163,184,0.2)',
};

const tdCenter: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  padding: '5px 6px',
  fontSize: 13.25,
  fontWeight: 400,
  textAlign: 'center',
  borderRight: '1px solid rgba(148,163,184,0.2)',
};

const tdValue: React.CSSProperties = {
  ...tdCenter,
  fontWeight: 700,
};
