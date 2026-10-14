#!/usr/bin/env bash
# =============================================================================
#  FFmpeg broadcast build self-test  |  https://cemal.cloud  |  MIT
#  Source: https://github.com/cemal-demirci/ffmpeg-broadcast
#
#  Runs real encode/mux/demux round trips for every broadcast workflow the
#  build is meant to cover, using generated test signals (no input files).
#
#  Usage:
#    ./test-ffmpeg-broadcast.sh [path/to/ffmpeg]
#    (default: /opt/ffmpeg-broadcast/bin/ffmpeg, ffprobe taken from same dir)
#
#  Also runs every bcast preset and checks the "expect" lines of each preset
#  file against ffprobe. Skip that part with  NO_PRESETS=1.
# =============================================================================
set -uo pipefail

FF="${1:-/opt/ffmpeg-broadcast/bin/ffmpeg}"
FP="$(dirname "$FF")/ffprobe"
[[ -x "$FF" ]] || { echo "ffmpeg not found: $FF"; exit 1; }
[[ -x "$FP" ]] || { echo "ffprobe not found: $FP"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0; FAILED=()

c_g='\033[1;32m'; c_r='\033[1;31m'; c_b='\033[1;34m'; c_0='\033[0m'

# Common inputs: 1080i50 HD bars + 1 kHz tone, 2 seconds.
HD="smptehdbars=size=1920x1080:rate=25:duration=2"
SD="smptebars=size=720x576:rate=25:duration=2"
TONE="sine=frequency=1000:sample_rate=48000:duration=2"

ff() { "$FF" -hide_banner -nostdin -loglevel error -y "$@"; }

# probe FILE ENTRY -> value of the first stream's entry
probe() { "$FP" -v error -select_streams "${3:-v:0}" -show_entries "stream=$2" -of csv=p=0 "$1" 2>/dev/null | head -n1 | sed 's/,*$//'; }

# t NAME EXPECTED_CHECK -- command...
#   EXPECTED_CHECK is a shell expression evaluated after the command ran.
t() {
  local name="$1" check="$2"; shift 2
  local log="$TMP/${name//[^a-zA-Z0-9]/_}.log"
  if "$@" >"$log" 2>&1 && eval "$check" >>"$log" 2>&1; then
    printf "  ${c_g}PASS${c_0}  %s\n" "$name"; PASS=$((PASS+1))
  else
    printf "  ${c_r}FAIL${c_0}  %s\n" "$name"; FAIL=$((FAIL+1)); FAILED+=( "$name" )
    [[ -n "${GITHUB_ACTIONS:-}" ]] && echo "::error title=ffmpeg self-test::$name"
    sed 's/^/        /' "$log" | tail -n 5
  fi
}

printf "${c_b}Cemal.cloud${c_0} | ffmpeg broadcast self-test\n"
"$FF" -hide_banner -version | head -n1
echo

echo "Contribution / distribution"
t "H.264 High 4:2:0 in MPEG-TS (DVB)" '[[ $(probe $TMP/a.ts codec_name) == h264 ]]' \
  ff -f lavfi -i "$HD" -f lavfi -i "$TONE" -c:v libx264 -preset veryfast -b:v 8M -pix_fmt yuv420p \
     -c:a mp2 -b:a 192k -f mpegts -mpegts_service_id 1 -metadata service_name=CemalCloud "$TMP/a.ts"
t "HEVC Main10 in MP4" '[[ $(probe $TMP/b.mp4 profile) == "Main 10" ]]' \
  ff -f lavfi -i "$HD" -c:v libx265 -preset ultrafast -pix_fmt yuv420p10le -x265-params log-level=error \
     -tag:v hvc1 "$TMP/b.mp4"
t "H.264 + AAC as HLS (fMP4, 2s segments)" '[[ -s $TMP/hls/index.m3u8 ]] && grep -q EXT-X-MAP $TMP/hls/index.m3u8' \
  bash -c "mkdir -p '$TMP/hls' && \"\$0\" -hide_banner -loglevel error -y -f lavfi -i '$HD' -f lavfi -i '$TONE' \
     -c:v libx264 -preset veryfast -g 50 -c:a aac -f hls -hls_time 2 -hls_segment_type fmp4 \
     -hls_playlist_type vod '$TMP/hls/index.m3u8'" "$FF"
t "H.264 + AAC as MPEG-DASH" '[[ -s $TMP/dash/manifest.mpd ]]' \
  bash -c "mkdir -p '$TMP/dash' && \"\$0\" -hide_banner -loglevel error -y -f lavfi -i '$HD' -f lavfi -i '$TONE' \
     -c:v libx264 -preset veryfast -g 50 -c:a aac -f dash '$TMP/dash/manifest.mpd'" "$FF"
t "AC-3 5.1 and E-AC-3 encode" '[[ $(probe $TMP/c.ac3 channels a:0) == 6 && $(probe $TMP/c.eac3 codec_name a:0) == eac3 ]]' \
  bash -c "\"\$0\" -hide_banner -loglevel error -y -f lavfi -i '$TONE' -af 'pan=5.1|c0=c0|c1=c0|c2=c0|c3=c0|c4=c0|c5=c0' -c:a ac3 -b:a 448k '$TMP/c.ac3' && \
           \"\$0\" -hide_banner -loglevel error -y -f lavfi -i '$TONE' -c:a eac3 '$TMP/c.eac3'" "$FF"
t "SMPTE 302M (AES3 in TS) round trip" '[[ $(probe $TMP/d.ts codec_name a:0) == s302m ]]' \
  ff -f lavfi -i "$TONE" -c:a s302m -strict -2 -ac 2 -f mpegts "$TMP/d.ts"

echo; echo "Post-production / playout"
t "ProRes 422 HQ in MOV" '[[ $(probe $TMP/e.mov profile) == HQ ]]' \
  ff -f lavfi -i "$HD" -f lavfi -i "$TONE" -c:v prores_ks -profile:v 3 -c:a pcm_s24le "$TMP/e.mov"
t "ProRes 4444 with alpha" '[[ $(probe $TMP/e4.mov pix_fmt) == yuva444p* ]]' \
  ff -f lavfi -i "$HD" -vf format=yuva444p10le -c:v prores_ks -profile:v 4 "$TMP/e4.mov"
t "DNxHR HQX 10-bit in MXF OP1a" '[[ $(probe $TMP/f.mxf codec_name) == dnxhd ]]' \
  ff -f lavfi -i "$HD" -f lavfi -i "$TONE" -c:v dnxhd -profile:v dnxhr_hqx -pix_fmt yuv422p10le \
     -c:a pcm_s24le -f mxf "$TMP/f.mxf"
t "DNxHD 120 in MXF OPAtom (Avid)" '[[ $(probe $TMP/g.mxf codec_name) == dnxhd ]]' \
  ff -f lavfi -i "smptehdbars=size=1920x1080:rate=25:duration=2" -c:v dnxhd -b:v 120M -pix_fmt yuv422p \
     -f mxf_opatom "$TMP/g.mxf"
t "XDCAM HD422 50 Mb/s (MPEG-2 4:2:2) in MXF" '[[ $(probe $TMP/h.mxf profile) == "4:2:2" && $(probe $TMP/h.mxf field_order) == tt ]]' \
  ff -f lavfi -i "$HD" -f lavfi -i "$TONE" -vf "setfield=tff" -c:v mpeg2video -pix_fmt yuv422p \
     -b:v 50M -minrate 50M -maxrate 50M -bufsize 17825792 -g 12 -bf 2 -flags +ildct+ilme \
     -intra_vlc 1 -non_linear_quant 1 -dc 10 -qmin 1 -qmax 12 -lmin "1*QP2LAMBDA" -rc_max_vbv_use 1 \
     -rc_min_vbv_use 1 -c:a pcm_s24le -f mxf "$TMP/h.mxf"
t "IMX D10 50 (SD) in MXF D10" '[[ $(probe $TMP/i.mxf codec_name) == mpeg2video ]]' \
  ff -f lavfi -i "$SD" -f lavfi -i "$TONE" -vf "pad=720:608:0:32,setfield=tff" -c:v mpeg2video -pix_fmt yuv422p \
     -b:v 50M -minrate 50M -maxrate 50M -bufsize 2000000 -rc_init_occupancy 2000000 -g 1 -intra_vlc 1 \
     -non_linear_quant 1 -dc 10 -flags +ildct+ilme -ps 1 -qmin 1 -qmax 3 -rc_max_vbv_use 1 \
     -rc_min_vbv_use 1 -c:a pcm_s16le -ar 48000 -f mxf_d10 "$TMP/i.mxf"
t "V210 10-bit uncompressed in MOV" '[[ $(probe $TMP/j.mov codec_name) == v210 ]]' \
  ff -f lavfi -i "$HD" -frames:v 5 -c:v v210 "$TMP/j.mov"
t "FFV1 lossless archive in MKV" '[[ $(probe $TMP/k.mkv codec_name) == ffv1 ]]' \
  ff -f lavfi -i "$HD" -frames:v 10 -c:v ffv1 -level 3 -slices 4 -slicecrc 1 "$TMP/k.mkv"
t "GXF wrap (MPEG-2)" '[[ -s $TMP/l.gxf ]] && [[ $(probe $TMP/l.gxf codec_name) == mpeg2video ]]' \
  ff -f lavfi -i "$SD" -c:v mpeg2video -pix_fmt yuv420p -b:v 15M -an -f gxf "$TMP/l.gxf"

echo; echo "Processing"
t "Deinterlace 1080i -> 1080p50 (bwdif)" '[[ $(probe $TMP/m.mkv avg_frame_rate) == 50/1 ]]' \
  ff -i "$TMP/h.mxf" -vf "bwdif=mode=send_field" -c:v ffv1 -an "$TMP/m.mkv"
t "Interlace detection (idet)" 'grep -q "Multi frame detection" $TMP/idet.log' \
  bash -c "\"\$0\" -hide_banner -nostdin -i '$TMP/h.mxf' -vf idet -an -f null - 2>'$TMP/idet.log'" "$FF"
t "HD -> SD scale + colorspace BT.709 -> BT.601" '[[ $(probe $TMP/n.mkv width) == 720 ]]' \
  ff -f lavfi -i "$HD" -vf "zscale=w=720:h=576:matrixin=709:matrix=470bg,format=yuv422p" -c:v ffv1 "$TMP/n.mkv"
t "EBU R128 loudnorm to -23 LUFS, 48 kHz MXF" 'grep -q "Input Integrated" $TMP/loud.log && [[ $(probe $TMP/loud.mxf sample_rate a:0) == 48000 ]]' \
  bash -c "\"\$0\" -hide_banner -nostdin -y -i '$TMP/f.mxf' -af 'loudnorm=I=-23:TP=-1:LRA=7:print_format=summary,aresample=48000' \
     -c:v copy -c:a pcm_s24le -f mxf '$TMP/loud.mxf' 2>'$TMP/loud.log'" "$FF"
t "ebur128 meter" 'grep -q "Integrated loudness" $TMP/ebur.log' \
  bash -c "\"\$0\" -hide_banner -nostdin -f lavfi -i '$TONE' -af ebur128 -f null - 2>'$TMP/ebur.log'" "$FF"
t "QC: blackdetect + freezedetect + silencedetect" 'grep -q black_start $TMP/qc.log && grep -q freeze_start $TMP/qc.log && grep -q silence_start $TMP/qc.log' \
  bash -c "\"\$0\" -hide_banner -nostdin -f lavfi -i 'color=black:size=640x360:rate=25:duration=4' \
     -f lavfi -i 'anullsrc=r=48000:cl=stereo' -t 4 -vf 'blackdetect=d=1,freezedetect=d=1' \
     -af 'silencedetect=d=1' -f null - 2>'$TMP/qc.log'" "$FF"
t "signalstats (broadcast-legal levels)" '[[ -s $TMP/stats.txt ]]' \
  bash -c "\"\$0\" -hide_banner -nostdin -loglevel error -f lavfi -i '$HD' -frames:v 5 \
     -vf 'signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=$TMP/stats.txt' -f null -" "$FF"
if fc-match -f '%{file}' sans >/dev/null 2>&1 && [[ -f "$(fc-match -f '%{file}' sans)" ]]; then
  t "drawtext overlay (logo/clock)" '[[ $(probe $TMP/o.ts codec_name) == h264 ]]' \
    ff -f lavfi -i "$HD" -vf "drawtext=text='Cemal.cloud %{localtime}':fontcolor=white:fontsize=36:x=40:y=40" \
       -c:v libx264 -preset ultrafast -f mpegts "$TMP/o.ts"
else
  echo "  skip  drawtext (no system font found)"
fi
t "Audio channel mapping 8ch -> 4x stereo (pan/channelsplit)" '[[ $(probe $TMP/p.mxf codec_name a:0) == pcm_s24le ]]' \
  ff -f lavfi -i "$HD" -f lavfi -i "$TONE" -filter_complex "[1:a]pan=stereo|c0=c0|c1=c0[a]" \
     -map 0:v -map "[a]" -c:v dnxhd -profile:v dnxhr_lb -pix_fmt yuv422p -c:a pcm_s24le -f mxf "$TMP/p.mxf"

echo; echo "Captions / subtitles"
printf '1\n00:00:00,000 --> 00:00:01,500\nCemal.cloud test\n' > "$TMP/s.srt"
t "SRT -> WebVTT" 'grep -q WEBVTT $TMP/s.vtt' ff -i "$TMP/s.srt" "$TMP/s.vtt"
t "SRT -> TTML" 'grep -q "<tt" $TMP/s.ttml' ff -i "$TMP/s.srt" -c:s ttml "$TMP/s.ttml"
t "SRT -> SCC (CEA-608 sidecar) muxer present" '"$FF" -hide_banner -muxers 2>/dev/null | grep -qw scc' true
t "Teletext decoder (zvbi) present" '"$FF" -hide_banner -decoders 2>/dev/null | grep -qw libzvbi_teletextdec' true
t "DVB subtitle encoder present" '"$FF" -hide_banner -encoders 2>/dev/null | grep -qw dvbsub' true

echo; echo "Transport / protocols"
t "SRT protocol (libsrt) available" '"$FF" -hide_banner -protocols 2>/dev/null | grep -qx "  srt"' true
t "RIST protocol (librist) available" '"$FF" -hide_banner -protocols 2>/dev/null | grep -qx "  rist"' true
t "Pro-MPEG FEC + UDP + RTMPS available" '"$FF" -hide_banner -protocols 2>/dev/null | grep -qx "  prompeg" && "$FF" -hide_banner -protocols 2>/dev/null | grep -qx "  rtmps"' true
SRT_PORT=$((20000 + RANDOM % 20000))
t "SRT live loopback (listener <- caller)" '[[ $(probe $TMP/srt.ts codec_name) == h264 ]]' \
  bash -c "timeout 20 \"\$0\" -hide_banner -nostdin -loglevel error -y -i 'srt://127.0.0.1:$SRT_PORT?mode=listener&listen_timeout=10000000&timeout=10000000' -c copy -t 2 -f mpegts '$TMP/srt.ts' & L=\$!; sleep 1; timeout 20 \
           \"\$0\" -hide_banner -nostdin -loglevel error -re -f lavfi -i 'testsrc2=size=640x360:rate=25:duration=3' \
             -c:v libx264 -preset ultrafast -tune zerolatency -f mpegts 'srt://127.0.0.1:$SRT_PORT?mode=caller&pkt_size=1316'; wait \$L" "$FF"
UDP_PORT=$((40000 + RANDOM % 10000))
t "UDP MPEG-TS loopback" '[[ $(probe $TMP/udp.ts codec_name) == h264 ]]' \
  bash -c "timeout 20 \"\$0\" -hide_banner -nostdin -loglevel error -y -i 'udp://127.0.0.1:$UDP_PORT?timeout=5000000' -c copy -t 2 -f mpegts '$TMP/udp.ts' & L=\$!; sleep 1; timeout 20 \
           \"\$0\" -hide_banner -nostdin -loglevel error -re -f lavfi -i 'testsrc2=size=640x360:rate=25:duration=3' \
             -c:v libx264 -preset ultrafast -f mpegts 'udp://127.0.0.1:$UDP_PORT?pkt_size=1316'; wait \$L" "$FF"

# ---------------------------------------------------------------------------
# bcast presets: every preset file is run and checked against its expect lines
# ---------------------------------------------------------------------------
SELF_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
BCAST="${BCAST:-}"
for b in "$SELF_DIR/bcast" "$(dirname "$FF")/bcast"; do
  [[ -z "$BCAST" && -x "$b" ]] && BCAST="$b"
done

# check_expect PRESET OUTPUT: compare the preset's expect / expect_audio /
# expect_hls lines with what ffprobe reports. Prints the first mismatch.
check_expect() {
  local preset="$1" out="$2" kv k v act line
  line="$("$BCAST" --get "$preset" expect)"
  IFS=',' read -r -a kvs <<<"$line"
  for kv in "${kvs[@]}"; do
    [[ -z "$kv" ]] && continue
    k="${kv%%=*}"; v="${kv#*=}"; act="$(probe "$out" "$k" v:0)"
    [[ "$act" == "$v" ]] || { echo "video $k: expected '$v', got '$act'"; return 1; }
  done
  line="$("$BCAST" --get "$preset" expect_audio)"
  IFS=',' read -r -a kvs <<<"$line"
  for kv in "${kvs[@]}"; do
    [[ -z "$kv" ]] && continue
    k="${kv%%=*}"; v="${kv#*=}"
    if [[ "$k" == streams ]]; then
      # MPEG-TS lists each stream under programs too, so count unique indexes
      act="$("$FP" -v error -select_streams a -show_entries stream=index -of csv=p=0 "$out" 2>/dev/null | sort -u | grep -c .)"
    else
      act="$(probe "$out" "$k" a:0)"
    fi
    [[ "$act" == "$v" ]] || { echo "audio $k: expected '$v', got '$act'"; return 1; }
  done
  line="$("$BCAST" --get "$preset" expect_hls)"
  if [[ -n "$line" ]]; then
    act="$(grep -c 'EXT-X-STREAM-INF' "$out/master.m3u8" 2>/dev/null)"
    [[ "$act" == "$line" ]] || { echo "hls variants: expected $line, got '$act'"; return 1; }
  fi
  return 0
}

if [[ "${NO_PRESETS:-0}" != 1 && -n "$BCAST" ]]; then
  export BCAST_FFMPEG="$FF"
  echo; echo "bcast presets ($BCAST)"
  # Sources: 1080i25 (ProRes, stereo PCM), 1080p50 and 1080p25 (for the
  # re-interlace and PsF paths), 4 s each.
  ff -f lavfi -i "smptehdbars=size=1920x1080:rate=25:duration=4" -f lavfi -i "sine=frequency=1000:sample_rate=48000:duration=4" \
     -filter_complex "[1:a]pan=stereo|c0=c0|c1=c0[a]" -map 0:v -map "[a]" -vf setfield=tff \
     -c:v prores_ks -profile:v 3 -flags +ildct -c:a pcm_s24le "$TMP/src_i25.mov"
  ff -f lavfi -i "testsrc2=size=1920x1080:rate=50:duration=4" -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=4" \
     -c:v prores_ks -profile:v 0 -c:a pcm_s24le "$TMP/src_p50.mov"
  ff -f lavfi -i "testsrc2=size=1920x1080:rate=25:duration=4" -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=4" \
     -c:v prores_ks -profile:v 0 -c:a pcm_s24le "$TMP/src_p25.mov"

  while read -r p; do
    [[ -z "$p" ]] && continue
    ext="$("$BCAST" --get "$p" ext)"
    if [[ "$ext" == / ]]; then out="$TMP/preset_$p"; else out="$TMP/preset_$p.$ext"; fi
    src="$("$BCAST" --get "$p" test_source)"
    t "preset $p" "check_expect '$p' '$out'" "$BCAST" -y "$p" "$TMP/src_${src:-i25}.mov" "$out"
  done <<<"$("$BCAST" --names)"

  t "preset xdcam-hd422-1080i25 from 1080p50 (re-interlace) + --tc" \
    '[[ $(probe $TMP/x50.mxf field_order) == tt && $(probe $TMP/x50.mxf r_frame_rate) == 25/1 && $("$FP" -v error -show_entries format_tags=timecode -of csv=p=0 $TMP/x50.mxf) == 10:00:00:00 ]]' \
    "$BCAST" -y --tc 10:00:00:00 xdcam-hd422-1080i25 "$TMP/src_p50.mov" "$TMP/x50.mxf"
  t "preset xdcam-hd422-1080i25 from 1080p25 (PsF)" \
    '[[ $(probe $TMP/x25.mxf field_order) == tt && $(probe $TMP/x25.mxf r_frame_rate) == 25/1 ]] && ! "$BCAST" --show xdcam-hd422-1080i25 "$TMP/src_p25.mov" x.mxf 2>/dev/null | grep -q tinterlace' \
    "$BCAST" -y xdcam-hd422-1080i25 "$TMP/src_p25.mov" "$TMP/x25.mxf"
  t "preset imx50-576i25 from 1080p50 (HD 50p to SD 25i)" \
    '[[ $(probe $TMP/imx50.mxf height) == 608 && $(probe $TMP/imx50.mxf channels a:0) == 4 ]]' \
    "$BCAST" -y imx50-576i25 "$TMP/src_p50.mov" "$TMP/imx50.mxf"
  t "bcast --tracks 8 override" \
    '[[ $("$FP" -v error -select_streams a -show_entries stream=index -of csv=p=0 $TMP/t8.mxf | sort -u | grep -c .) == 8 ]]' \
    "$BCAST" -y --tracks 8 xdcam-hd422-1080i25 "$TMP/src_i25.mov" "$TMP/t8.mxf"
  t "dnxhr-hqx refuses an interlaced source" 'grep -q "frame-based" $TMP/refuse.log' \
    bash -c "if \"\$0\" -y dnxhr-hqx '$TMP/src_i25.mov' '$TMP/refuse.mxf' 2>'$TMP/refuse.log'; then exit 1; fi" "$BCAST"
  t "bcast --r128 loudness" 'grep -q loudnorm $TMP/r128.cmd' \
    bash -c "\"\$0\" --show --r128 web-h264-1080p '$TMP/src_i25.mov' x.mp4 > '$TMP/r128.cmd' 2>/dev/null" "$BCAST"
elif [[ -z "$BCAST" ]]; then
  echo; echo "  skip  bcast presets (bcast not found)"
fi

echo
printf "Result: ${c_g}%d passed${c_0}, %b%d failed${c_0}\n" "$PASS" "$([[ $FAIL -gt 0 ]] && echo "$c_r" || echo "$c_g")" "$FAIL"
if [[ -n "${GITHUB_ACTIONS:-}" && $FAIL -eq 0 ]]; then
  echo "::notice title=FFmpeg self-test::$PASS passed, 0 failed. $("$FF" -hide_banner -version | head -n1 | cut -d' ' -f1-3). Every bcast preset was encoded and checked with ffprobe."
fi
[[ $FAIL -gt 0 ]] && { printf '  - %s\n' "${FAILED[@]}"; exit 1; }
exit 0
