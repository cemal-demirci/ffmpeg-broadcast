<div align="center">

```
  ____                     _       _                 _
 / ___|___ _ __ ___   __ _| |  ___| | ___  _   _  __| |
| |   / _ \ '_ ` _ \ / _` | | / __| |/ _ \| | | |/ _` |
| |__|  __/ | | | | | (_| | || (__| | (_) | |_| | (_| |
 \____\___|_| |_| |_|\__,_|_(_)___|_|\___/ \__,_|\__,_|
```

# FFmpeg Broadcast

**Yayıncılık için sade FFmpeg build'i ve 19 hazır yayın preseti: XDCAM, AVC-Intra, IMX, ProRes, DNxHD, DVB, HLS, SRT.**

[![ci](https://github.com/cemal-demirci/ffmpeg-broadcast/actions/workflows/ci.yml/badge.svg)](https://github.com/cemal-demirci/ffmpeg-broadcast/actions/workflows/ci.yml)
![license](https://img.shields.io/badge/license-MIT-blue)

[cemal.cloud](https://cemal.cloud)

</div>

---

`--disable-everything` ile başlayıp sadece yayıncılık iş akışında gerçekten kullanılan bileşenleri açan, statik ve tek dosyalık FFmpeg build'i.

## Kurulum

```bash
git clone https://github.com/cemal-demirci/ffmpeg-broadcast.git && cd ffmpeg-broadcast
sudo ./build-ffmpeg-broadcast.sh        # Ubuntu 24.04, bağımlılıkları kendi kurar
export PATH="/opt/ffmpeg-broadcast/bin:$PATH"
bcast --list
```

## Derleme

```bash
sudo ./build-ffmpeg-broadcast.sh                       # bağımlılıkları kurar, /opt/ffmpeg-broadcast'e derler
./build-ffmpeg-broadcast.sh --no-deps --prefix "$HOME/ffmpeg-bc"
sudo ./build-ffmpeg-broadcast.sh --with-nvenc          # + NVIDIA NVENC / NVDEC
./build-ffmpeg-broadcast.sh --print-config             # sadece configure satırını göster
export PATH="/opt/ffmpeg-broadcast/bin:$PATH"
```

| Parametre | Varsayılan |
|---|---|
| `--prefix DIR` | `/opt/ffmpeg-broadcast` |
| `--version TAG` | `n9.0.2` |
| `--src DIR` | `./build-src` |
| `--jobs N` | çekirdek sayısı |
| `--with-nvenc` | kapalı (h264/hevc/av1_nvenc, cuvid, nvdec) |
| `--no-deps` | apt ile bağımlılık kurmaz |
| `--presets-only` | derlemeden sadece `bcast` ve presetleri kurar |

Ubuntu 24.04'te test edildi. Bileşen adlarından biri seçilen FFmpeg sürümünde yoksa script sessizce eksik bir build üretmek yerine durur.

## Neler var

| Alan | İçerik |
|---|---|
| Video | H.264 (x264), HEVC (x265), ProRes (422 / 4444), DNxHD / DNxHR, MPEG-2 (XDCAM HD422, IMX D10), V210, FFV1, DV. Decode: JPEG2000, AV1 (dav1d), VP9, VC-1 |
| Ses | AAC, AC-3, E-AC-3, MP2, MP3, Opus, FLAC, PCM 16/24/32, SMPTE 302M. Decode: Dolby E |
| Konteyner | MXF (OP1a, D10, OPAtom), MOV / MP4, MPEG-TS, HLS, DASH, GXF, MKV, WAV |
| Ağ | SRT, RIST, UDP / RTP (multicast), Pro-MPEG FEC, RTMP(S), HTTP(S) |
| Altyazı | DVB sub, Teletext (zvbi), EIA-608 / SCC, WebVTT, TTML, SRT |
| Filtre | Deinterlace (bwdif, yadif, idet), ölçekleme (swscale + zimg), EBU R128 (loudnorm, ebur128), QC (blackdetect, freezedetect, silencedetect, signalstats, metadata), drawtext, overlay, test sinyalleri (SMPTE barlar, ton) |

Kapalı olanlar: ffplay, dokümantasyon, debug sembolleri, otomatik algılanan donanım / sistem kütüphaneleri ve listede olmayan her codec, format, protokol ve filtre.

**Lisans:** x264 / x265 içerdiği için oluşan binary **GPL v2+**. `--enable-nonfree` kullanılmaz, yani dağıtılabilir.

## Presetler: `bcast`

Build ile birlikte `bcast` adında bir preset aracı kurulur. Yayın formatlarını tek komutla üretir:

```bash
bcast --list                                             # tüm presetler
bcast xdcam-hd422-1080i25 haber.mov haber.mxf            # playout'a hazır XDCAM
bcast --tc 10:00:00:00 --r128 avci100-1080i25 in.mov out.mxf
bcast hls-abr-1080 film.mxf ./film_hls                   # klasöre ABR HLS
bcast --realtime srt-h264-contribution in.mxf "srt://hedef:9000?mode=caller&pkt_size=1316"
bcast --show imx50-576i25 in.mov out.mxf                 # çalıştırmadan ffmpeg komutunu göster
```

| Kategori | Preset | Çıktı |
|---|---|---|
| Contribution / playout | `xdcam-hd422-1080i25` | XDCAM HD422 50 Mb/s 1080i25, MXF OP1a, 4 mono PCM |
| | `xdcam-hd422-720p50` | XDCAM HD422 50 Mb/s 720p50, MXF OP1a, 4 mono PCM |
| | `avci100-1080i25` | AVC-Intra 100 10-bit 4:2:2 1080i25, MXF OP1a |
| | `imx50-576i25` | IMX D10 50 576i25 16:9, MXF D10, 4 kanal AES3 |
| Post-prodüksiyon | `prores-422hq` / `prores-4444` / `prores-proxy` | ProRes MOV, kaynak boyut ve hızda |
| | `dnxhd-185x-1080i25` | DNxHD 185x 10-bit 1080i25, MXF (Avid interlaced HD) |
| | `dnxhr-hqx` | DNxHR HQX 10-bit MXF, sadece progressive kaynak |
| | `dnxhr-lb-proxy` | DNxHR LB 720p proxy, MOV |
| | `ffv1-archive` | FFV1 v3 kayıpsız arşiv, MKV + FLAC, hiçbir şey yeniden örneklenmez |
| Dağıtım | `dvb-h264-1080i25` | DVB H.264 1080i25 CBR 12 Mb/s, TS 15 Mb/s, MP2 |
| | `dvb-h264-576i25` | DVB H.264 576i25 16:9 CBR 4 Mb/s, TS 6 Mb/s (SD simulcast) |
| | `iptv-hevc-1080p50` | HEVC Main10 1080p50 CBR 8 Mb/s, TS 10 Mb/s, AAC |
| | `srt-h264-contribution` | Düşük gecikmeli H.264 CBR 10 Mb/s TS, 1 sn GOP |
| OTT / web | `hls-abr-1080` | HLS ABR 1080/720/540/360, fMP4 4 sn segment |
| | `web-h264-1080p` | MP4 faststart, CRF 20 |
| | `proxy-h264-540p` | İnceleme proxy'si, MP4 |
| Ses | `wav-r128` | BWF 48 kHz / 24-bit, EBU R128 -23 LUFS |

**Kaynağı kendisi tanır.** `bcast` önce kaynağı ffprobe ile okur ve dönüşüm zincirini buna göre kurar:

| Kaynak | Hedef 1080i25 | Ne yapılır |
|---|---|---|
| 1080i25 | 1080i25 | Sadece alan sırası TFF'e çekilir, yeniden ölçekleme yok |
| 1080p50 | 1080i25 | Yeniden interlace edilir (`tinterlace`) |
| 1080p25 | 1080i25 | PsF olarak işaretlenir, kare atılmaz |
| HD interlaced | 576i25 (IMX, DVB SD) | Deinterlace, BT.709'dan BT.601'e matris, ölçekleme, yeniden interlace |
| Interlaced | progressive (web, HLS) | `bwdif` ile deinterlace |

**Ses:** Çıkış her zaman 48 kHz (arşiv preseti hariç). MXF presetleri kaynağın kanallarını ayrı mono track'lere dağıtır, eksik track'ler sessiz doldurulur. `--tracks 8` ile track sayısı değiştirilir.

**Güvenlik:** `-y` verilmezse mevcut dosyanın üzerine yazmaz. DNxHR, FFmpeg'de interlaced kodlanamadığı için interlaced kaynağı progressive diye etiketlemek yerine reddeder ve `dnxhd-185x-1080i25` önerir. Kaynağın metadata'sı yanlışsa `--src-scan i|p` ile düzeltilebilir.

**Kendi presetini eklemek:** `presets/` altına `isim.preset` dosyası koymak yeterli. Biçim `anahtar = değer`, mevcut dosyalar örnek. Değerler komut olarak çalıştırılmaz, sadece ffmpeg argümanı olarak okunur. Dosyadaki `expect` satırları self-test tarafından otomatik kontrol edilir.

## Self-test

```bash
./test-ffmpeg-broadcast.sh                       # /opt/ffmpeg-broadcast/bin/ffmpeg
./test-ffmpeg-broadcast.sh /yol/ffmpeg
```

Her commit'te GitHub Actions'ta FFmpeg sıfırdan derlenir ve bu test çalıştırılır. Girdi dosyası gerektirmez, test sinyallerini kendisi üretir. Her preset gerçek bir kaynakla çalıştırılır ve preset dosyasındaki `expect` değerleri (codec, profil, çözünürlük, alan sırası, track sayısı, örnekleme hızı) ffprobe ile doğrulanır. Ayrıca 1080p50'den re-interlace, 1080p25'ten PsF, timecode, `--tracks`, `--r128` ve DNxHR'nin interlaced kaynağı reddetmesi test edilir. Bunlara ek olarak 34 temel senaryo: DVB TS, HEVC Main10, HLS fMP4, DASH, AC-3 5.1, SMPTE 302M, ProRes HQ ve 4444 alpha, DNxHR HQX MXF, DNxHD OPAtom, XDCAM HD422 (alan sırası kontrolüyle), IMX D10, V210, FFV1, GXF, bwdif, idet, BT.709'dan BT.601'e dönüşüm, loudnorm, ebur128, QC dedektörleri, signalstats, drawtext, ses kanal eşleme, WebVTT, TTML, SRT ve UDP canlı loopback.

## bcast olmadan, elle

Aşağıdaki komutların hepsi bu build ile yazıldığı gibi çalıştırılıp doğrulandı. Kaynağın 1080i25 olduğu varsayılır, farklı kaynaklar için `bcast` kullanın.

**XDCAM HD422 50 Mb/s, 1080i25, MXF OP1a**
```bash
ffmpeg -i in.mov -vf "scale=1920:1080:interl=1,setfield=tff" \
  -c:v mpeg2video -pix_fmt yuv422p -b:v 50M -minrate 50M -maxrate 50M -bufsize 17825792 \
  -g 12 -bf 2 -flags +ildct+ilme -intra_vlc 1 -non_linear_quant 1 -dc 10 -qmin 1 -qmax 12 \
  -lmin "1*QP2LAMBDA" -rc_max_vbv_use 1 -rc_min_vbv_use 1 \
  -c:a pcm_s24le -ar 48000 -f mxf out.mxf
```

**IMX D10 50, 576i25**
```bash
ffmpeg -i in.mov -vf "scale=720:576:interl=1,pad=720:608:0:32,setfield=tff" \
  -c:v mpeg2video -pix_fmt yuv422p -b:v 50M -minrate 50M -maxrate 50M -bufsize 2000000 \
  -rc_init_occupancy 2000000 -g 1 -intra_vlc 1 -non_linear_quant 1 -dc 10 -flags +ildct+ilme \
  -ps 1 -qmin 1 -qmax 3 -rc_max_vbv_use 1 -rc_min_vbv_use 1 \
  -c:a pcm_s16le -ar 48000 -f mxf_d10 out.mxf
```

**ProRes 422 HQ / DNxHR HQX**
```bash
ffmpeg -i in.mxf -c:v prores_ks -profile:v 3 -c:a pcm_s24le out.mov
ffmpeg -i in.mov -c:v dnxhd -profile:v dnxhr_hqx -pix_fmt yuv422p10le -c:a pcm_s24le -f mxf out.mxf
```

**EBU R128 (-23 LUFS) ve QC raporu**
```bash
# loudnorm içeride 192 kHz ile çalışır, MXF / yayın için 48 kHz'e geri örnekleyin
ffmpeg -i in.mxf -af "loudnorm=I=-23:TP=-1:LRA=7,aresample=48000" -c:v copy -c:a pcm_s24le out.mxf
ffmpeg -i in.mxf -vf "blackdetect=d=1,freezedetect=d=2" -af "silencedetect=d=2" -f null - 2> qc.log
```

**SRT ile canlı alım ve yayın**
```bash
ffmpeg -i "srt://0.0.0.0:9000?mode=listener" -c copy -f mpegts out.ts
ffmpeg -re -i in.ts -c copy -f mpegts "srt://hedef:9000?mode=caller&pkt_size=1316"
```

## Diğer Cemal.cloud araçları

| Repo | |
|---|---|
| [`win11-debloat`](https://github.com/cemal-demirci/win11-debloat) | Copilot, Recall, reklam ve telemetriyi kaldıran, her değişikliği geri alınabilir şekilde kaydeden Windows 11 temizliği. |
| [`ubuntu-server-debloat`](https://github.com/cemal-demirci/ubuntu-server-debloat) | snap, telemetri ve gereksiz servisleri kaldırır. Kritik bir paketi etkileyecekse hiçbir şey yapmadan durur. |
| [`k8s-debloat`](https://github.com/cemal-demirci/k8s-debloat) | Traefik ve ServiceLB olmadan sade k3s kurulumu ve her cluster için varsayılanı dry-run olan temizlik scripti. |

## Lisans

Scriptler [MIT](LICENSE). Oluşan FFmpeg binary'si x264 / x265 içerdiği için **GPL v2+** lisanslıdır.

---

<details>
<summary><b>English</b></summary>

A lean, static FFmpeg build for broadcast work, configured from `--disable-everything`: H.264/HEVC (x264/x265), ProRes, DNxHD/DNxHR, MPEG-2 (XDCAM HD422, IMX D10), AVC-Intra, V210, FFV1; AAC, AC-3/E-AC-3, MP2, PCM, SMPTE 302M, Dolby E decode; MXF (OP1a, D10, OPAtom), MOV/MP4, MPEG-TS, HLS, DASH, GXF; SRT, RIST, UDP/RTP, Pro-MPEG FEC; DVB/Teletext/608/TTML captions; bwdif, zimg, loudnorm/ebur128 and QC filters.

**`bcast`** ships 19 broadcast presets (XDCAM HD422 1080i25/720p50, AVC-Intra 100, IMX D10 50, ProRes 422 HQ/4444/Proxy, DNxHD 185x, DNxHR HQX/LB, FFV1 archive, DVB H.264 HD/SD, IPTV HEVC, SRT contribution, HLS ABR ladder, web/proxy MP4, BWF R128). It probes the source and builds the scan chain: 25i is kept, 50p is re-interlaced, 25p is flagged PsF, HD interlaced to SD is deinterlaced, matrix-converted (BT.709 to BT.601) and re-interlaced. Audio is spread over mono tracks for MXF. DNxHR refuses interlaced sources instead of mislabelling them. Presets are plain `key = value` files and are never executed.

```bash
sudo ./build-ffmpeg-broadcast.sh
bcast xdcam-hd422-1080i25 news.mov news.mxf
bcast --tc 10:00:00:00 --r128 avci100-1080i25 in.mov out.mxf
```

CI builds FFmpeg from source and runs the full self-test (34 base scenarios plus every preset, verified with ffprobe) for every commit. Scripts are MIT; the resulting FFmpeg binary is GPL v2+ because it links x264/x265.

</details>
