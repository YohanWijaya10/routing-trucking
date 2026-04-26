# Route Planning Prototype

Prototype Python untuk pembagian pengiriman ke beberapa truck tanpa database dulu.

## Yang Sudah Bisa

- Baca input JSON untuk `depot`, `vehicles`, dan `orders`
- Validasi kapasitas total vs demand total
- Hitung estimasi jarak/waktu dari koordinat
- Gunakan `OR-Tools` bila tersedia
- Fallback ke solver greedy bila `OR-Tools` belum terpasang
- Opsional pakai `OpenRouteService Matrix API`
- Web UI lokal untuk isi data dan lihat hasil di browser

## Struktur Input

File input JSON harus berisi:

- `depot`
- `vehicles`
- `orders`

Field minimal:

```json
{
  "depot": { "name": "Gudang", "lat": -7.2575, "lng": 112.7521 },
  "vehicles": [
    { "id": "TRUCK-1", "capacity_kg": 2000 }
  ],
  "orders": [
    {
      "id": "CUST-001",
      "name": "Customer A",
      "lat": -7.2888,
      "lng": 112.6554,
      "demand_kg": 450
    }
  ]
}
```

## Cara Jalankan

Tanpa install dependency tambahan:

```bash
python3 route_planner.py sample_input.json
```

Dengan `OR-Tools`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 route_planner.py sample_input.json --solver ortools
```

Dengan OpenRouteService Matrix:

```bash
export ORS_API_KEY="isi_api_key_anda"
python3 route_planner.py sample_input.json --use-ors --solver auto
```

Dengan env database untuk dummy customer:

```bash
cp .env.example .env.local
```

Simpan hasil JSON:

```bash
python3 route_planner.py sample_input.json --output result.json

## Jalankan Web UI

```bash
python3 ui_server.py
```

Lalu buka:

```bash
http://127.0.0.1:8000
```

Dengan ORS key bawaan server:

```bash
export ORS_API_KEY="isi_api_key_anda"
python3 ui_server.py
```

UI ini bisa:

- load sample data
- tambah/hapus truck
- tambah/hapus order
- edit mapping customer per order
- pilih solver
- pilih pakai ORS atau estimasi bawaan
- lihat hasil ringkasan dan rute per truck

Env yang dipakai:

- `DATABASE_URL` untuk load customer dari database
- `DEFAULT_CITY` untuk default filter kota
- `DEFAULT_DUMMY_COUNT` untuk default jumlah dummy
- `ORS_API_KEY` untuk fallback key server-side
```

## Flow MVP

1. Isi truck dan kapasitasnya
2. Isi daftar order pengiriman hari itu
3. Jalankan script
4. Script hitung matrix jarak/waktu
5. Solver bagi order ke truck
6. Hasil keluar dalam bentuk ringkasan rute

## Catatan

- `OpenRouteService` dipakai untuk matrix jalan nyata
- `OR-Tools` dipakai untuk optimasi pembagian order ke truck
- Kalau `OR-Tools` belum ada, script tetap jalan dengan solver greedy
- Prototype ini belum menyimpan histori dan belum pakai database
# map-routes
# trucking-area
