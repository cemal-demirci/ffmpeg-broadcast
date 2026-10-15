# FFmpeg Broadcast · Cemal.cloud

[![Lisans: GPL-3.0](https://img.shields.io/badge/lisans-GPL--3.0-blue)](LICENSE)
[![Denetim](https://github.com/cemal-demirci/ffmpeg-broadcast/actions/workflows/ci.yml/badge.svg)](https://github.com/cemal-demirci/ffmpeg-broadcast/actions)
![FFmpeg](https://img.shields.io/badge/FFmpeg-9.0.2-007808)
![Preset](https://img.shields.io/badge/preset-19-e3b341)

**Yayın formatlarını ezberlemeyin, `bcast`'e söyleyin.**

Playout sunucusu XDCAM dosyasını reddetti. Alan sırası ters çıktı, ekranda titriyor. Ses dört mono track yerine tek
stereo track'e gitti, reji sessiz kaldı. Yayında çalışan herkes bu filmi en az bir kez izlemiştir.

FFmpeg bunların hepsini yapabilir; sorun, her format için doğru düzineyi ezberlemek ve kaynağın interlaced mi
progressive mi olduğunu her seferinde hesaba katmaktır. Bu repo iki şey getirir:

- **Sade build:** yalnızca yayın iş akışında kullanılan codec, format ve filtreler. Tek, 15 MB'lık statik dosya.
- **`bcast`:** 19 hazır yayın preseti. Kaynağa bakar, alan sırasını, frame rate'i, renk matrisini ve ses track
  düzenini kendisi ayarlar.

## Elle mi, bcast ile mi?

1080p50 bir kaynaktan playout'a XDCAM HD422, elle:

```bash
ffmpeg -i in.mov -vf "scale=1920:1080,tinterlace=mode=interleave_top,setfield=tff,format=yuv422p" \
  -c:v mpeg2video -b:v 50M -minrate 50M -maxrate 50M -bufsize 17825792 -g 12 -bf 2 -flags +ildct+ilme \
  -intra_vlc 1 -non_linear_quant 1 -dc 10 -qmin 1 -qmax 12 -lmin "1*QP2LAMBDA" -rc_max_vbv_use 1 -rc_min_vbv_use 1 \
  -filter_complex "[0:a:0]aresample=48000,asplit=4[s0][s1][s2][s3];[s0]pan=mono|c0=c0[m0];[s1]pan=mono|c0=c1[m1];[s2]pan=mono|c0=0*c0[m2];[s3]pan=mono|c0=0*c0[m3]" \
  -map 0:v:0 -map "[m0]" -map "[m1]" -map "[m2]" -map "[m3]" -c:a pcm_s24le -f mxf out.mxf
```

bcast ile:

```bash
bcast xdcam-hd422-1080i25 in.mov out.mxf
```

Kaynak 1080i25 olsaydı yeniden interlace etmez, 1080p25 olsaydı PsF olarak işaretlerdi. Komutu çalıştırmadan görmek
için `--show`.

## Kurulum

```bash
git clone https://github.com/cemal-demirci/ffmpeg-broadcast.git && cd ffmpeg-broadcast
sudo ./build-ffmpeg-broadcast.sh              # Ubuntu 24.04, gereken paketleri kendisi kurar
export PATH="/opt/ffmpeg-broadcast/bin:$PATH"
bcast --list
```

## Kullanım

```bash
bcast [seçenekler] <preset> <girdi> <çıktı>

bcast --tc 10:00:00:00 --r128 avci100-1080i25 in.mov out.mxf   # timecode ve EBU R128 ses seviyesiyle
bcast hls-abr-1080 film.mxf ./film_hls                         # klasöre çok bitrate'li HLS
bcast --realtime srt-h264-contribution in.mxf "srt://hedef:9000?mode=caller&pkt_size=1316"
```

### Presetler

| Kullanım | Preset | Çıktı |
|---|---|---|
| Playout / teslim | `xdcam-hd422-1080i25` | XDCAM HD422 50 Mb/s 1080i25, MXF, 4 mono ses track'i |
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
| | `web-h264-1080p`, `proxy-h264-540p` | Web ve inceleme için MP4 |
| Ses | `wav-r128` | Broadcast WAV, 48 kHz / 24-bit, -23 LUFS |

### Kaynağa göre ne yapar?

| Kaynak | Hedef | bcast'in yaptığı |
|---|---|---|
| 1080i25 | 1080i25 | Yalnızca alan sırasını düzeltir, yeniden ölçeklemez |
| 1080p50 | 1080i25 | Yeniden interlace eder |
| 1080p25 | 1080i25 | PsF olarak işaretler, kare kaybı olmaz |
| HD interlaced | SD (IMX, DVB SD) | Deinterlace, BT.709'dan BT.601'e renk dönüşümü, ölçekleme, yeniden interlace |
| Interlaced | Web / HLS | Deinterlace eder |

Ses her zaman 48 kHz'e getirilir (arşiv hariç). MXF presetlerinde kaynağın kanalları ayrı mono track'lere dağıtılır,
eksik kanallar sessiz doldurulur.

DNxHR, FFmpeg'de interlaced kodlanamaz. bcast interlaced bir kaynağı sessizce progressive diye etiketlemek yerine
**reddeder** ve `dnxhd-185x-1080i25`'i önerir.

### Seçenekler

| Seçenek | Ne yapar |
|---|---|
| `-y` | Var olan çıktının üzerine yazar (vermezseniz dosyaya dokunmaz) |
| `--show` | Çalıştırmaz, kullanacağı ffmpeg komutunu yazar |
| `--r128` | Sesi EBU R128'e göre -23 LUFS'e getirir |
| `--tc 10:00:00:00` | Başlangıç timecode'u (MXF / MOV) |
| `--tracks 8` | MXF'teki mono ses track sayısı |
| `--src-scan i` veya `p` | Kaynağın metadata'sı yanlışsa interlaced / progressive bilgisini düzeltir |
| `--realtime` | Girdiyi gerçek zamanlı okur, canlı SRT / UDP gönderimi için |

### Kendi presetiniz

`presets/` klasörüne `isim.preset` adıyla bir dosya koyun. Biçim basit `anahtar = değer` satırlarıdır, mevcut dosyalar
örnektir. Değerler komut olarak çalıştırılmaz, yalnızca ffmpeg argümanı olarak okunur. Dosyaya yazdığınız `expect`
satırları test tarafından otomatik kontrol edilir.

## Build'de ne var?

| Alan | İçerik |
|---|---|
| Video | H.264 (x264), HEVC (x265), ProRes, DNxHD / DNxHR, MPEG-2, AVC-Intra, V210, FFV1, DV. Yalnızca çözme: JPEG2000, AV1, VP9, VC-1 |
| Ses | AAC, AC-3, E-AC-3, MP2, MP3, Opus, FLAC, PCM, SMPTE 302M. Yalnızca çözme: Dolby E |
| Konteyner | MXF (OP1a, D10, OPAtom), MOV / MP4, MPEG-TS, HLS, DASH, GXF, MKV, WAV |
| Ağ | SRT, RIST, UDP / RTP multicast, Pro-MPEG FEC, RTMP(S), HTTP(S) |
| Altyazı | DVB, Teletext, EIA-608 / SCC, WebVTT, TTML, SRT |
| Filtreler | Deinterlace, ölçekleme, EBU R128, siyah / donma / sessizlik tespiti, sinyal analizi, yazı ve logo bindirme, test sinyalleri |

| Derleme seçeneği | Ne yapar |
|---|---|
| `--prefix DIR` | Kurulum yeri (varsayılan `/opt/ffmpeg-broadcast`) |
| `--with-nvenc` | NVIDIA ekran kartıyla donanım kodlama ekler |
| `--version TAG` | FFmpeg sürümü (varsayılan `n9.0.2`) |
| `--no-deps` | Gereken paketleri kurmaz |
| `--presets-only` | Derlemeden yalnızca `bcast` ve presetleri kurar |

## Ne çalıştırır, nereye dokunur?

- **Derleme:** gereken paketleri `apt` ile kurar, FFmpeg kaynağını GitHub'daki resmi depodan indirir, `/opt/ffmpeg-broadcast`'e kurar.
- **bcast:** yalnızca `ffprobe` ile kaynağı okur ve `ffmpeg`'i çalıştırır. Preset dosyaları hiçbir zaman komut olarak
  çalıştırılmaz. `-y` vermezseniz var olan bir dosyanın üzerine yazmaz.

## Test ettik

`./test-ffmpeg-broadcast.sh` girdi dosyası istemez, test görüntü ve seslerini kendisi üretir. Her commit'te GitHub
Actions FFmpeg'i sıfırdan derler (yaklaşık 3 dakika) ve bu testi çalıştırır.

| | |
|---|---|
| Son çalıştırma | 59 / 59 geçti |
| Temel senaryolar | MXF, MPEG-TS, HLS, DASH, GXF, SRT ve UDP canlı aktarım, EBU R128, kalite kontrol filtreleri |
| Presetler | 19 preset gerçek bir kaynakla kodlandı. Codec, profil, çözünürlük, alan sırası, frame rate, ses track'leri ve örnekleme hızı ffprobe ile doğrulandı. 1080p50'den yeniden interlace, 1080p25'ten PsF ve DNxHR'nin interlaced kaynağı reddetmesi ayrıca test edildi. |

Dürüst not: testler üretilmiş renk barları ve tonlarla yapılıyor, gerçek bir playout sunucusunda kabul testi
yapılmadı. `--with-nvenc` CI'da test edilmiyor (runner'larda NVIDIA kart yok).

## Lisans

Scriptler [GPL-3.0](LICENSE): değiştirilmiş halini dağıtan herkes kaynak kodunu da aynı lisansla açık paylaşmak zorundadır. Oluşan FFmpeg dosyası x264 ve x265 içerdiği için **GPL v2+** lisanslıdır.

Copyright (C) 2026 Cemal Demirci (Cemal.cloud)

---

## English

**FFmpeg Broadcast** is a lean, static (15 MB) FFmpeg build for broadcast work, configured from `--disable-everything`,
plus **`bcast`**, a tool with 19 broadcast presets: XDCAM HD422 1080i25 / 720p50, AVC-Intra 100, IMX D10 50, ProRes
422 HQ / 4444 / Proxy, DNxHD 185x, DNxHR HQX / LB, FFV1 archive, DVB H.264 HD / SD, IPTV HEVC, SRT contribution, HLS ABR
ladder, web / proxy MP4 and BWF R128.

- **Source-aware:** bcast probes the input and builds the scan chain: 25i is kept, 50p is re-interlaced, 25p is
  flagged PsF, HD interlaced to SD is deinterlaced, matrix-converted (BT.709 to BT.601) and re-interlaced. Audio is
  spread over mono tracks for MXF. DNxHR refuses interlaced sources instead of mislabelling them.
- **Usage:** `sudo ./build-ffmpeg-broadcast.sh`, then `bcast xdcam-hd422-1080i25 in.mov out.mxf`; `--show` prints the
  ffmpeg command, `--r128`, `--tc`, `--tracks`, `--realtime` adjust it.
- **Tested:** every commit builds FFmpeg from source and runs 59 checks; every preset is encoded and verified with ffprobe.
  Synthetic test signals only; no playout-server acceptance test; NVENC not covered.
- **License:** scripts GPL-3.0-or-later; the resulting FFmpeg binary is GPL v2+ (x264 / x265).
