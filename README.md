# FFmpeg Broadcast · Cemal.cloud

Yayıncılık için sadeleştirilmiş bir FFmpeg build'i ve XDCAM, AVC-Intra, ProRes, DVB, HLS gibi yayın formatlarını tek komutla üreten `bcast` aracı.

[![ci](https://github.com/cemal-demirci/ffmpeg-broadcast/actions/workflows/ci.yml/badge.svg)](https://github.com/cemal-demirci/ffmpeg-broadcast/actions/workflows/ci.yml)
![license](https://img.shields.io/badge/license-MIT-blue)

## Neden?

Hazır FFmpeg paketleri yüzlerce codec ve formatla gelir, ama yayın formatları için doğru ayarları bulmak ayrı bir iş: XDCAM HD422 için bir düzine MPEG-2 parametresi, IMX için 608 satıra tamamlama, interlaced bir kaynağı yanlış alan sırasıyla teslim etmemek, MXF'te sesi doğru track düzenine dağıtmak. Bir ayar unutulursa dosya playout sunucusunda reddedilir ya da yayında titreme yapar.

Bu repo iki şey sunar:

- **Sade build:** Sadece yayın iş akışında kullanılan codec, format ve filtreleri içeren, tek dosyalık statik FFmpeg.
- **`bcast`:** Yayın formatlarını tek komutla üretir. Kaynağın interlaced mi progressive mi olduğuna ve frame rate'ine bakıp doğru dönüşümü kendisi kurar.

## Hızlı başlangıç

```bash
git clone https://github.com/cemal-demirci/ffmpeg-broadcast.git && cd ffmpeg-broadcast
sudo ./build-ffmpeg-broadcast.sh              # Ubuntu 24.04, gereken paketleri kendisi kurar
export PATH="/opt/ffmpeg-broadcast/bin:$PATH"

bcast --list                                  # presetleri listele
bcast xdcam-hd422-1080i25 haber.mov haber.mxf
```

## bcast

```bash
bcast [seçenekler] <preset> <girdi> <çıktı>
```

```bash
bcast --tc 10:00:00:00 --r128 avci100-1080i25 in.mov out.mxf   # timecode ve EBU R128 ses seviyesiyle
bcast hls-abr-1080 film.mxf ./film_hls                         # klasöre çok bitrate'li HLS
bcast --realtime srt-h264-contribution in.mxf "srt://hedef:9000?mode=caller&pkt_size=1316"
bcast --show imx50-576i25 in.mov out.mxf                       # çalıştırmadan ffmpeg komutunu göster
```

### Presetler

| Kullanım | Preset | Çıktı |
|---|---|---|
| Playout / teslim | `xdcam-hd422-1080i25` | XDCAM HD422 50 Mb/s 1080i25, MXF, 4 mono ses kanalı |
| | `xdcam-hd422-720p50` | XDCAM HD422 50 Mb/s 720p50, MXF |
| | `avci100-1080i25` | AVC-Intra 100, 10-bit 4:2:2, MXF |
| | `imx50-576i25` | IMX D10 50 SD 16:9, MXF D10 |
| Kurgu | `prores-422hq`, `prores-4444`, `prores-proxy` | ProRes MOV, kaynak çözünürlükte |
| | `dnxhd-185x-1080i25` | DNxHD 185x 10-bit 1080i25, MXF (Avid) |
| | `dnxhr-hqx`, `dnxhr-lb-proxy` | DNxHR MXF / MOV, progressive kaynaklar için |
| Arşiv | `ffv1-archive` | FFV1 kayıpsız, MKV + FLAC, hiçbir şey yeniden örneklenmez |
| Dağıtım | `dvb-h264-1080i25`, `dvb-h264-576i25` | DVB H.264 HD / SD, sabit bitrate'li MPEG-TS |
| | `iptv-hevc-1080p50` | HEVC 10-bit 1080p50, MPEG-TS |
| | `srt-h264-contribution` | Düşük gecikmeli H.264, SRT / UDP gönderimi için |
| Web / OTT | `hls-abr-1080` | HLS, 1080 / 720 / 540 / 360 kademeli |
| | `web-h264-1080p`, `proxy-h264-540p` | Web için ve inceleme için MP4 |
| Ses | `wav-r128` | Broadcast WAV, 48 kHz / 24-bit, -23 LUFS |

### Kaynağa göre ne yapar?

| Kaynak | Hedef | bcast'in yaptığı |
|---|---|---|
| 1080i25 | 1080i25 | Sadece alan sırasını düzeltir, yeniden ölçeklemez |
| 1080p50 | 1080i25 | Yeniden interlace eder |
| 1080p25 | 1080i25 | PsF olarak işaretler, kare kaybı olmaz |
| HD interlaced | SD (IMX, DVB SD) | Deinterlace, BT.709'dan BT.601'e renk dönüşümü, ölçekleme, yeniden interlace |
| Interlaced | Web / HLS | Deinterlace eder |

Ses her zaman 48 kHz'e getirilir (arşiv preseti hariç). MXF presetlerinde kaynağın kanalları ayrı mono track'lere dağıtılır, eksik kanallar sessiz doldurulur.

### Seçenekler

| Seçenek | Ne yapar |
|---|---|
| `-y` | Var olan çıktının üzerine yazar (vermezseniz dosyaya dokunmaz) |
| `--show` | Çalıştırmaz, kullanacağı ffmpeg komutunu yazar |
| `--r128` | Sesi EBU R128'e göre -23 LUFS seviyesine getirir |
| `--tc 10:00:00:00` | Başlangıç timecode'u (MXF / MOV) |
| `--tracks 8` | MXF'teki mono ses track sayısı |
| `--src-scan i` veya `p` | Kaynağın metadata'sı yanlışsa interlaced / progressive bilgisini düzeltir |
| `--realtime` | Girdiyi gerçek zamanlı okur, canlı SRT / UDP gönderimi için |

DNxHR, FFmpeg'de interlaced kodlanamadığı için interlaced bir kaynağı yanlışlıkla progressive diye etiketlemek yerine reddeder ve `dnxhd-185x-1080i25` önerir.

### Kendi presetiniz

`presets/` klasörüne `isim.preset` adıyla bir dosya eklemeniz yeterli. Biçim basit `anahtar = değer` satırlarıdır, mevcut dosyalar örnek olarak kullanılabilir. Değerler komut olarak çalıştırılmaz, sadece ffmpeg argümanı olarak okunur. Dosyaya yazdığınız `expect` satırları test tarafından otomatik kontrol edilir.

## Build içeriği

| Alan | İçerik |
|---|---|
| Video | H.264 (x264), HEVC (x265), ProRes, DNxHD / DNxHR, MPEG-2, AVC-Intra, V210, FFV1, DV. Sadece çözme: JPEG2000, AV1, VP9, VC-1 |
| Ses | AAC, AC-3, E-AC-3, MP2, MP3, Opus, FLAC, PCM, SMPTE 302M. Sadece çözme: Dolby E |
| Konteyner | MXF (OP1a, D10, OPAtom), MOV / MP4, MPEG-TS, HLS, DASH, GXF, MKV, WAV |
| Ağ | SRT, RIST, UDP / RTP multicast, Pro-MPEG FEC, RTMP(S), HTTP(S) |
| Altyazı | DVB, Teletext, EIA-608 / SCC, WebVTT, TTML, SRT |
| Filtreler | Deinterlace, ölçekleme, EBU R128 ses seviyesi, siyah / donma / sessizlik tespiti, sinyal analizi, yazı ve logo bindirme, test sinyalleri |

| Derleme seçeneği | Ne yapar |
|---|---|
| `--prefix DIR` | Kurulum yeri (varsayılan `/opt/ffmpeg-broadcast`) |
| `--with-nvenc` | NVIDIA ekran kartıyla donanım kodlama ekler |
| `--version TAG` | FFmpeg sürümü (varsayılan `n9.0.2`) |
| `--no-deps` | Gereken paketleri kurmaz |
| `--presets-only` | Derlemeden sadece `bcast` ve presetleri kurar |

## Nasıl test ediliyor?

```bash
./test-ffmpeg-broadcast.sh
```

Girdi dosyası gerektirmez, test görüntü ve seslerini kendisi üretir. Temel yayın senaryolarını (MXF, TS, HLS, SRT ve UDP canlı aktarım, ses seviyesi ölçümü, kalite kontrol filtreleri) dener, ardından her preseti gerçek bir kaynakla çalıştırıp çıktının codec, profil, çözünürlük, alan sırası ve ses track'lerini ffprobe ile doğrular. Her değişiklikte GitHub Actions FFmpeg'i sıfırdan derleyip bu testi çalıştırır.

## Lisans

Scriptler [MIT](LICENSE). Oluşan FFmpeg dosyası x264 ve x265 içerdiği için **GPL v2+** lisanslıdır.

---

<details>
<summary><b>English</b></summary>

A lean, static FFmpeg build for broadcast work, configured from `--disable-everything`, plus **`bcast`**, a preset tool with 19 broadcast presets (XDCAM HD422 1080i25 / 720p50, AVC-Intra 100, IMX D10 50, ProRes 422 HQ / 4444 / Proxy, DNxHD 185x, DNxHR HQX / LB, FFV1 archive, DVB H.264 HD / SD, IPTV HEVC, SRT contribution, HLS ABR ladder, web / proxy MP4, BWF R128). It probes the source and builds the scan chain: 25i is kept, 50p is re-interlaced, 25p is flagged PsF, HD interlaced to SD is deinterlaced, matrix-converted (BT.709 to BT.601) and re-interlaced. Audio is spread over mono tracks for MXF. DNxHR refuses interlaced sources instead of mislabelling them. Presets are plain `key = value` files and are never executed.

```bash
sudo ./build-ffmpeg-broadcast.sh
bcast xdcam-hd422-1080i25 news.mov news.mxf
bcast --tc 10:00:00:00 --r128 avci100-1080i25 in.mov out.mxf
```

CI builds FFmpeg from source and runs the full self-test (base scenarios plus every preset, verified with ffprobe) for every commit. Scripts are MIT; the resulting FFmpeg binary is GPL v2+ because it links x264 / x265.

</details>
