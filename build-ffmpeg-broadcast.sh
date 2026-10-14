#!/usr/bin/env bash
# =============================================================================
#   ____                     _       _                 _
#  / ___|___ _ __ ___   __ _| |  ___| | ___  _   _  __| |
# | |   / _ \ '_ ` _ \ / _` | | / __| |/ _ \| | | |/ _` |
# | |__|  __/ | | | | | (_| | || (__| | (_) | |_| | (_| |
#  \____\___|_| |_| |_|\__,_|_(_)___|_|\___/ \__,_|\__,_|
#
#  Lean FFmpeg build for broadcast / playout / OTT  |  https://cemal.cloud
#  Source: https://github.com/cemal-demirci/ffmpeg-broadcast
#  Script: MIT. Resulting binary: GPL v2+ (see below).
#
#  Starts from --disable-everything and enables only what a broadcast
#  workflow actually uses:
#    Video : H.264 (x264), HEVC (x265), ProRes, DNxHD/DNxHR, MPEG-2 (XDCAM/D10),
#            V210, FFV1 (archive), DV, JPEG2000 (decode), AV1/VP9 (decode)
#    Audio : AAC, AC-3, E-AC-3, MP2, PCM (s16/s24/s32), SMPTE 302M, Dolby E (dec),
#            FLAC, Opus, MP3
#    Wrap  : MXF (OP1a, D10, OPAtom), MOV/MP4, MPEG-TS, HLS, DASH, GXF, MKV, WAV
#    Net   : SRT, RIST, UDP/RTP (multicast), Pro-MPEG FEC, RTMP(S), HTTP(S)
#    Subs  : DVB subs, Teletext (zvbi), EIA-608/SCC, WebVTT, TTML, SRT
#    Filter: deinterlace (bwdif/yadif), scaling (swscale + zimg), EBU R128
#            loudness (loudnorm/ebur128), QC detectors, drawtext, test signals
#
#  Licence of the resulting binary: GPL v2+ (because of x264/x265).
#  No --enable-nonfree, so the binary can be redistributed.
#
#  Tested on: Ubuntu 24.04 LTS, FFmpeg n9.0.2
#
#  Usage:
#    sudo ./build-ffmpeg-broadcast.sh                 # build + install
#    ./build-ffmpeg-broadcast.sh --no-deps --prefix "$HOME/ffmpeg-bc"
#    sudo ./build-ffmpeg-broadcast.sh --with-nvenc    # + NVIDIA NVENC/NVDEC
#
#  Options:
#    --prefix DIR      install prefix            (default: /opt/ffmpeg-broadcast)
#    --version TAG     FFmpeg git tag            (default: n9.0.2)
#    --src DIR         where to clone sources    (default: ./build-src)
#    --jobs N          parallel make jobs        (default: nproc)
#    --with-nvenc      add NVENC/NVDEC/CUVID (needs NVIDIA driver at runtime)
#    --no-deps         do not apt-get install build dependencies
#    --print-config    only print the configure flags and exit
#    --presets-only    only install bcast + presets into PREFIX (no build)
#    -h, --help        show this help
# =============================================================================
set -Eeuo pipefail

FFMPEG_VERSION="n9.0.2"
NVHEADERS_VERSION="n13.0.19.0"
PREFIX="/opt/ffmpeg-broadcast"
SRC_DIR="$(pwd)/build-src"
JOBS="$(nproc 2>/dev/null || echo 2)"
WITH_NVENC=0
INSTALL_DEPS=1
PRINT_ONLY=0
PRESETS_ONLY=0
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"

log()  { printf '\033[1;34m[cemal.cloud ffmpeg]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[cemal.cloud ffmpeg] WARN:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[cemal.cloud ffmpeg] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
usage() { sed -n '/^#  Lean FFmpeg/,/^# =====*$/p' "$0" | sed 's/^# \{0,1\}//' | sed '$d'; exit 0; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix)       PREFIX="${2:?}"; shift 2 ;;
    --version)      FFMPEG_VERSION="${2:?}"; shift 2 ;;
    --src)          SRC_DIR="${2:?}"; shift 2 ;;
    --jobs)         JOBS="${2:?}"; shift 2 ;;
    --with-nvenc)   WITH_NVENC=1; shift ;;
    --no-deps)      INSTALL_DEPS=0; shift ;;
    --print-config) PRINT_ONLY=1; shift ;;
    --presets-only) PRESETS_ONLY=1; shift ;;
    -h|--help)      usage ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done

join() { local IFS=','; echo "$*"; }

# ----------------------------------------------------------------------------
# Component lists. Edit these to grow or shrink the build.
# ----------------------------------------------------------------------------
DECODERS=(
  # video
  h264 hevc mpeg2video mpeg1video mpeg4 vc1 prores dnxhd v210 v210x rawvideo
  ffv1 dvvideo jpeg2000 mjpeg png libdav1d vp9
  # audio
  aac aac_latm ac3 eac3 mp2 mp3 flac opus s302m dolby_e
  pcm_s16le pcm_s16be pcm_s24le pcm_s24be pcm_s32le pcm_s32be pcm_f32le
  pcm_bluray pcm_dvd
  # lavfi test sources deliver raw PCM in the graph's sample format
  pcm_u8 pcm_f64le
  # subtitles / captions
  dvbsub dvdsub ccaption libzvbi_teletext subrip webvtt ass mov_text
  # internal: lavfi test signals and filter-only inputs arrive as wrapped frames
  wrapped_avframe
)

ENCODERS=(
  # video
  libx264 libx265 prores_ks dnxhd mpeg2video v210 rawvideo ffv1 dvvideo
  mjpeg png
  # audio
  aac ac3 eac3 mp2 libmp3lame libopus flac s302m
  pcm_s16le pcm_s16be pcm_s24le pcm_s24be pcm_s32le pcm_s32be
  # subtitles / captions
  dvbsub mov_text webvtt subrip ass ttml
  # internal: default video codec of "-f null" (QC / analysis passes)
  wrapped_avframe
)

MUXERS=(
  mxf mxf_d10 mxf_opatom mov mp4 mpegts hls dash segment gxf matroska
  wav w64 adts ac3 eac3 mp2 mp3 flac
  flv rtp rtp_mpegts rtsp image2 image2pipe
  h264 hevc mpeg2video rawvideo
  srt webvtt scc ass ttml
  null md5 framemd5 tee ffmetadata
)

DEMUXERS=(
  mxf mov mpegts mpegps hls dash gxf matroska flv live_flv
  wav w64 aiff ac3 eac3 aac mp3 flac s337m
  rtp rtsp sdp image2 concat
  h264 hevc mpegvideo rawvideo v210 dv
  srt webvtt scc ass ffmetadata
)

PARSERS=(
  h264 hevc mpegvideo mpeg4video vc1 dnxhd png mjpeg vp9 av1
  aac aac_latm ac3 mpegaudio flac opus dolby_e
  dvbsub dvdsub
)

BSFS=(
  h264_mp4toannexb hevc_mp4toannexb aac_adtstoasc extract_extradata
  h264_metadata hevc_metadata mpeg2_metadata prores_metadata
  dump_extra remove_extra filter_units setts imx_dump_header
  eac3_core pcm_rechunk trace_headers null
)

PROTOCOLS=(
  file pipe tcp udp rtp srtp http https tls rtmp rtmps hls crypto data
  concat subfile tee prompeg libsrt librist
)

FILTERS=(
  # video: geometry / format
  scale zscale format fps setpts setsar setdar pad crop transpose settb
  colorspace
  # video: interlace handling
  bwdif yadif idet fieldorder setfield interlace tinterlace separatefields weave
  # video: compositing / graphics
  overlay drawtext drawbox fade split select thumbnail tile trim concat tpad
  # video: QC / analysis (metadata/ametadata print the measured values to a log)
  blackdetect freezedetect signalstats cropdetect showinfo readeia608 readvitc
  metadata ametadata
  # video: test signals
  smptebars smptehdbars testsrc2 color nullsrc
  # audio
  aresample aformat loudnorm ebur128 volume amix amerge pan channelmap
  channelsplit join atrim asetpts apad afade adelay alimiter highpass lowpass
  asplit silencedetect volumedetect astats asettb
  # audio test signals
  sine anullsrc
  # always handy
  null anull copy acopy
)

INDEVS=( lavfi )

EXTERNAL_LIBS=(
  --enable-libx264 --enable-libx265 --enable-libsrt --enable-librist
  --enable-libzvbi --enable-libfreetype --enable-libharfbuzz --enable-libfontconfig
  --enable-libmp3lame --enable-libopus --enable-libsoxr --enable-libzimg
  --enable-libdav1d --enable-libxml2 --enable-gnutls --enable-zlib --enable-iconv
)

APT_DEPS=(
  build-essential git pkg-config nasm yasm
  libx264-dev libx265-dev libsrt-gnutls-dev librist-dev libzvbi-dev
  libfreetype-dev libharfbuzz-dev libfontconfig-dev libmp3lame-dev libopus-dev
  libsoxr-dev libzimg-dev libdav1d-dev libxml2-dev libgnutls28-dev zlib1g-dev
)

if [[ $WITH_NVENC -eq 1 ]]; then
  ENCODERS+=( h264_nvenc hevc_nvenc av1_nvenc )
  DECODERS+=( h264_cuvid hevc_cuvid mpeg2_cuvid )
  FILTERS+=( hwupload_cuda hwdownload )
  HWACCELS=( h264_nvdec hevc_nvdec mpeg2_nvdec )
  EXTERNAL_LIBS+=( --enable-ffnvcodec --enable-nvenc --enable-nvdec --enable-cuvid )
fi

CONFIGURE_FLAGS=(
  --prefix="$PREFIX"
  --enable-gpl
  --disable-everything
  --disable-autodetect
  --disable-doc
  --disable-ffplay
  --disable-debug
  --enable-static --disable-shared
  --enable-pthreads
  --enable-avdevice --enable-swresample --enable-swscale
  --extra-version=cemalcloud
  "${EXTERNAL_LIBS[@]}"
  --enable-decoder="$(join "${DECODERS[@]}")"
  --enable-encoder="$(join "${ENCODERS[@]}")"
  --enable-muxer="$(join "${MUXERS[@]}")"
  --enable-demuxer="$(join "${DEMUXERS[@]}")"
  --enable-parser="$(join "${PARSERS[@]}")"
  --enable-bsf="$(join "${BSFS[@]}")"
  --enable-protocol="$(join "${PROTOCOLS[@]}")"
  --enable-filter="$(join "${FILTERS[@]}")"
  --enable-indev="$(join "${INDEVS[@]}")"
)
if [[ $WITH_NVENC -eq 1 ]]; then
  CONFIGURE_FLAGS+=( --enable-hwaccel="$(join "${HWACCELS[@]}")" )
fi

# Install the bcast preset wrapper and preset files next to the binaries.
install_presets() {
  local SUDO=""
  if ! { mkdir -p "$PREFIX/bin" "$PREFIX/share/cemalcloud/presets" 2>/dev/null && [[ -w "$PREFIX/bin" ]]; }; then
    SUDO="sudo"
  fi
  [[ -f "$SCRIPT_DIR/bcast" && -d "$SCRIPT_DIR/presets" ]] || { warn "bcast or presets/ not found next to this script, skipping"; return 0; }
  $SUDO mkdir -p "$PREFIX/bin" "$PREFIX/share/cemalcloud/presets"
  $SUDO install -m 0755 "$SCRIPT_DIR/bcast" "$PREFIX/bin/bcast"
  $SUDO install -m 0644 "$SCRIPT_DIR"/presets/*.preset "$PREFIX/share/cemalcloud/presets/"
  log "bcast + $(find "$SCRIPT_DIR/presets" -name '*.preset' | wc -l) presets installed (try: bcast --list)"
}

if [[ $PRESETS_ONLY -eq 1 ]]; then
  install_presets
  exit 0
fi

if [[ $PRINT_ONLY -eq 1 ]]; then
  printf '%s \\\n' ./configure; printf '  %q \\\n' "${CONFIGURE_FLAGS[@]}"; echo
  exit 0
fi

# ----------------------------------------------------------------------------
# 1. Dependencies
# ----------------------------------------------------------------------------
if [[ $INSTALL_DEPS -eq 1 ]]; then
  command -v apt-get >/dev/null || die "apt-get not found. Install deps manually and use --no-deps."
  SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"
  log "Installing build dependencies via apt..."
  $SUDO apt-get update -qq || warn "apt-get update reported errors, continuing"
  $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "${APT_DEPS[@]}"
fi

mkdir -p "$SRC_DIR"

# ----------------------------------------------------------------------------
# 2. NVIDIA headers (optional). Header-only; driver is loaded at runtime.
# ----------------------------------------------------------------------------
if [[ $WITH_NVENC -eq 1 ]]; then
  NVH_PREFIX="$SRC_DIR/nv-headers-install"
  if [[ ! -d "$SRC_DIR/nv-codec-headers" ]]; then
    log "Cloning nv-codec-headers $NVHEADERS_VERSION..."
    git clone -q --depth 1 --branch "$NVHEADERS_VERSION" \
      https://github.com/FFmpeg/nv-codec-headers.git "$SRC_DIR/nv-codec-headers"
  fi
  make -s -C "$SRC_DIR/nv-codec-headers" PREFIX="$NVH_PREFIX" install
  export PKG_CONFIG_PATH="$NVH_PREFIX/lib/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
fi

# ----------------------------------------------------------------------------
# 3. FFmpeg source
# ----------------------------------------------------------------------------
FF_DIR="$SRC_DIR/ffmpeg-$FFMPEG_VERSION"
if [[ ! -d "$FF_DIR" ]]; then
  log "Cloning FFmpeg $FFMPEG_VERSION..."
  git clone -q --depth 1 --branch "$FFMPEG_VERSION" https://github.com/FFmpeg/FFmpeg.git "$FF_DIR"
fi
cd "$FF_DIR"

# ----------------------------------------------------------------------------
# 4. Configure. Fail loudly if any component name is unknown in this version,
#    instead of silently producing a build that lacks it.
# ----------------------------------------------------------------------------
log "Configuring..."
CONF_LOG="$SRC_DIR/configure-$FFMPEG_VERSION.log"
if ! ./configure "${CONFIGURE_FLAGS[@]}" >"$CONF_LOG" 2>&1; then
  tail -n 30 "$CONF_LOG" >&2
  [[ -f ffbuild/config.log ]] && tail -n 30 ffbuild/config.log >&2
  die "configure failed (full log: $CONF_LOG)"
fi
if grep -q 'did not match anything' "$CONF_LOG"; then
  grep 'did not match anything' "$CONF_LOG" >&2
  die "Some component names are not valid for $FFMPEG_VERSION. Fix the lists above."
fi

# ----------------------------------------------------------------------------
# 5. Build + install
# ----------------------------------------------------------------------------
log "Building with $JOBS jobs (this takes a few minutes)..."
make -j"$JOBS" >"$SRC_DIR/make-$FFMPEG_VERSION.log" 2>&1 || {
  tail -n 40 "$SRC_DIR/make-$FFMPEG_VERSION.log" >&2; die "make failed"; }

log "Installing to $PREFIX..."
if [[ -w "$(dirname "$PREFIX")" || -w "$PREFIX" ]]; then
  make install >/dev/null
else
  sudo make install >/dev/null
fi

BIN="$PREFIX/bin/ffmpeg"
[[ -x "$BIN" ]] || die "ffmpeg binary not found at $BIN"
install_presets

log "Done."
"$BIN" -hide_banner -version | head -n 1
printf '  size: ffmpeg %s, ffprobe %s\n' \
  "$(du -h "$BIN" | cut -f1)" "$(du -h "$PREFIX/bin/ffprobe" | cut -f1)"
printf '  encoders: %s  decoders: %s  muxers: %s  demuxers: %s  filters: %s\n' \
  "$("$BIN" -hide_banner -encoders 2>/dev/null | grep -cE '^ [VAS]')" \
  "$("$BIN" -hide_banner -decoders 2>/dev/null | grep -cE '^ [VAS]')" \
  "$("$BIN" -hide_banner -muxers   2>/dev/null | grep -cE '^ +E ')" \
  "$("$BIN" -hide_banner -demuxers 2>/dev/null | grep -cE '^ +D ')" \
  "$("$BIN" -hide_banner -filters  2>/dev/null | grep -cE '^ [.T][.S]? ')"
log "Add to PATH:  export PATH=\"$PREFIX/bin:\$PATH\""
log "Run the self-test: ./test-ffmpeg-broadcast.sh $BIN"
