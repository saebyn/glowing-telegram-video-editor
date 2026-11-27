# Local sequence preview fixtures

The four-second fixtures are generated media, not extracts from a modeled
source. The video is H.264 with five progressively brighter pictures per
second and a keyframe every second; the paired AAC switches between 440 Hz
and 880 Hz at each one-second segment boundary. MPEG-TS presentation
timestamps do not start at zero.

The variant-selection tests supply `variants.m3u8` as the master playlist
and reuse `markers.m3u8` as the smaller variant. The large variant has a
solid white picture so the tests can distinguish them in Preview.

Regenerate in this directory with FFmpeg:

```sh
ffmpeg -f lavfi -i 'nullsrc=size=64x36:rate=5,geq=lum=24+7*N:cb=128:cr=128' \
  -f lavfi -i 'aevalsrc=0.25*sin(2*PI*t*if(lt(mod(t\,2)\,1)\,440\,880)):s=48000' \
  -t 4 -c:v libx264 -threads 1 -pix_fmt yuv420p -g 5 -bf 0 -sc_threshold 0 \
  -c:a aac -b:a 48k -hls_time 1 -hls_playlist_type vod \
  -hls_segment_filename 'marker-%d.ts' markers.m3u8

ffmpeg -f lavfi -i 'nullsrc=size=64x36:rate=5,geq=lum=24+7*N:cb=128:cr=128' \
  -t 4 -c:v libx264 -threads 1 -pix_fmt yuv420p -g 5 -bf 0 -sc_threshold 0 \
  -hls_time 1 -hls_playlist_type vod -hls_segment_filename 'picture-%d.ts' picture-only.m3u8

ffmpeg -f lavfi -i 'color=c=white:s=960x540:r=5' \
  -f lavfi -i 'anullsrc=r=48000:cl=mono' \
  -t 4 -c:v libx264 -threads 1 -pix_fmt yuv420p -g 5 -bf 0 -sc_threshold 0 \
  -c:a aac -b:a 48k -hls_time 1 -hls_playlist_type vod \
  -hls_segment_filename 'large-%d.ts' large.m3u8
```
