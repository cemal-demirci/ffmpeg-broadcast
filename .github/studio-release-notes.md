**bcast Studio:** ffmpeg-broadcast'ın 19 yayın presetini Windows ve macOS'ta pencereden kullanın, ya da IP adresini yazdığınız bir sunucuya kurup işleri orada çalıştırın.

| Dosya | Ne için |
|---|---|
| `bcast-Studio-…-windows-setup.exe` | Windows 10 / 11 kurulumu (x64) |
| `bcast-Studio-…-windows-portable.exe` | Kurulumsuz, tek dosya |
| `bcast-Studio-…-macos-universal.dmg` | macOS 12+, Apple silicon ve Intel |
| `bcast-Studio-…-macos-universal.zip` | Aynı uygulama, zip |
| `SHA256SUMS.txt` | Dosyaları doğrulamak için |

**İlk açılış.** Uygulama Apple / Microsoft sertifikasıyla imzalı değil:

- **macOS:** açılmadı uyarısından sonra *Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç*. Terminal'den: `xattr -dr com.apple.quarantine "/Applications/bcast Studio.app"`
- **Windows:** SmartScreen'de *Ek bilgi → Yine de çalıştır*.

**FFmpeg.** Uygulama FFmpeg'i içinde taşımaz. Bilgisayarda bulamazsa tek tıkla indirir (Windows: BtbN FFmpeg-Builds, macOS: Martin Riedl build sunucusu; ikisi de GPL, x264 / x265 / SRT dahil) ya da sizin seçtiğiniz FFmpeg'i kullanır.

**Lisans.** Ticari olmayan kullanım ücretsiz (PolyForm Noncommercial 1.0.0). Ticari kullanım için: cemaldemirci0034@gmail.com
