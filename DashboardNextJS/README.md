# PSU-App-1

Dashboard aplikasi Next.js.

## Ikhtisar

Aplikasi ini adalah dashboard yang dibangun dengan Next.js. Ini mencakup berbagai modul seperti laporan kerja, tampilan hotspot, prakiraan cuaca, dan lainnya. Fokus pengembangan saat ini mencakup penyempurnaan formulir laporan kerja dengan fitur-fitur seperti pemilihan petugas, input tanggal, pemilihan shift dinas, status tugas interaktif, input manual untuk keterangan, dan ekspor formulir ke PNG.

## Fitur

-   **Formulir Laporan Kerja:**
    -   Pilihan nama petugas menggunakan dropdown.
    -   Input tanggal menggunakan pemilih kalender.
    -   Pilihan shift dinas (Pagi, Siang, Malam, Pibal).
    -   Tombol status tugas yang beralih antara "Terlaksana" (hijau) dan "Tidak" (putih) dengan keterkaitan ke input jumlah.
    -   Input manual untuk keterangan tugas.
    -   Ekspor formulir lengkap ke gambar PNG (ukuran F4) tanpa cropping.
    -   Tampilan form yang dikompakkan dengan jarak antar elemen yang disesuaikan.
    -   Latar belakang form putih solid dan warna font hitam untuk konsistensi.
    -   Ukuran logo BMKG yang disesuaikan dan penempatan header yang rata tengah.
-   **Modul Lain:** Hotspot, Prakiraan, dll. (berdasarkan struktur folder yang terlihat).

## Teknologi yang Digunakan

-   [Next.js](https://nextjs.org/) (v15.5.4)
-   [React](https://react.dev/) (v19.1.0)
-   [TypeScript](https://www.typescriptlang.org/) (v5)
-   [Tailwind CSS](https://tailwindcss.com/) (v4)
-   [html-to-image](https://github.com/bubkoo/html-to-image) (v1.11.13): Untuk menangkap DOM sebagai gambar.
-   [Sonner](https://sonner.emilkowalski.com/): Untuk notifikasi toast.
-   [clsx](https://github.com/lukeed/clsx): Utilitas kecil untuk membuat string `className` secara kondisional.
-   @radix-ui/* (berbagai komponen UI)

## Memulai

### Prasyarat

Pastikan Anda memiliki Node.js (disarankan versi LTS) dan npm terinstal.

-   Node.js (>=18.x)
-   npm (>=9.x)

### Instalasi

1.  Kloning repositori:
    ```bash
    git clone [URL_REPOSITORI_ANDA]
    cd DashboardNextJS
    ```
2.  Instal dependensi:
    ```bash
    npm install
    ```

## Script yang Tersedia

Dalam direktori proyek, Anda dapat menjalankan:

-   ### `npm run dev`

    Menjalankan aplikasi dalam mode pengembangan dengan Turbopack pada `localhost:3001`.
    ```bash
    next dev --turbopack -p 3001
    ```

-   ### `npm run build`

    Membangun aplikasi untuk produksi.
    ```bash
    next build --turbopack
    ```

-   ### `npm start`

    Menjalankan aplikasi yang telah dibangun dalam mode produksi pada `localhost:3001`.
    ```bash
    next start -H 0.0.0.0 -p 3001
    ```

-   ### `npm run lint`

    Menjalankan linter (ESLint) untuk memeriksa masalah kode dan gaya.
    ```bash
    eslint
    ```

-   ### `npm run devHost`

    Menjalankan aplikasi dalam mode pengembangan yang dapat diakses dari host lain (misalnya, di jaringan lokal Anda) pada `localhost:3001`.
    ```bash
    next dev -H 0.0.0.0 -p 3001
    ```

## Debugging

Untuk debugging dalam lingkungan pengembangan, Anda dapat menggunakan alat pengembang browser. Jika Anda menggunakan VS Code, Anda dapat mengkonfigurasi `launch.json` untuk melampirkan debugger ke proses Node.js yang menjalankan Next.js.

Contoh konfigurasi `launch.json` untuk debugging di VS Code:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node",
      "request": "launch",
      "preLaunchTask": "npm: dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 9229,
      "console": "integratedTerminal"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3001",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

Pastikan untuk menyesuaikan port (misalnya, `3001` jika Anda menggunakan `-p 3001` dalam skrip `dev` Anda) dalam konfigurasi debugging dan URL.

## Deployment

Aplikasi Next.js dapat di-deploy ke berbagai platform hosting. Beberapa opsi populer meliputi:

-   [Vercel](https://vercel.com/new?utm_source=next-app-template&utm_campaign=create-next-app&utm_medium=readme) (direkomendasikan untuk proyek Next.js)
-   [Netlify](https://docs.netlify.com/integrations/frameworks/next-js/overview/)
-   [Render](https://render.com/docs/deploy-nextjs)
-   Penyedia hosting Node.js lainnya

Untuk deployment, jalankan `npm run build` terlebih dahulu, lalu `npm start` untuk melayani aplikasi yang telah dibangun.