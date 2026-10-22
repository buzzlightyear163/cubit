# cubit — art direction (X-profil)

Referens: @usehexx (mörk texturerad kub som pfp, dot-matrix-wordmark som banner, kort video av kuben som launch-post). Vår version i eget material och egen färg.

```
Idé:        cube + bit. Kuben från sajten med en tänd cell: din CPU tänder en bit åt gången.
Material:   hex-glyfrutor (0–f i rundade rutor), samma som sajtens kub i src/cube/engine.ts.
Värld:      bas #07090B, ytor #181B20 / #101317 / #0A0C0F, accent #7FD6F7 (en sak per bild), text #E7EDF2.
            Ljuskälla: den tända cellen / kärnan.
Typografi:  ingen text i bilderna utom wordmarket. Geist Mono i etiketterna i videon.
Banner:     typ som bild. "cubit" i gemener byggt av tända glyfdioder (2 celler breda streck)
            i ett fält av släckta glyfrutor med svag dimma. I:ets prick i isblått. Centrerat, fritt från profilbilden.
Post:       8 s video av sajtens kub i mining-läge: bevis samlas, stiger och smälter in i kärnan
            (en splittras), långsam kameradrift. Ingen text. Stillbild från samma scen.
Avatar:     2×2×2-kub i glyfmaterialet, den främre övre cellen tänd i isblått, ljus läcker i skarvarna.
            Nästan svart bakgrund med svag blå glöd. Känns igen i 24 px.
```

Filer: `cubit_avatar.png` (2000²), `cubit_banner.png` (3000×1000), `cubit_launch.mp4` (1920×1080, 30 fps, H.264),
`cubit_post.png` (3200×1800, stillbild), `cubit_meet.png` (3200×1800, pre-launch "meet cubit": minern som
webbläsarflik, rig-panel med de fyra stegen + sajtens kub), `cubit_review.jpg` (X-mockup).

Källor i `source/`: `avatar.html` + `banner.html` + `glyph.js` (renderas med tech-coin-gfx `gfx.py render`),
`cubestill.mjs` + `meet.mjs` (stillbilder av kubens canvas från dev-servern, sedan komposition: `node cubestill.mjs cube`,
`node meet.mjs cube/cube_42.png cubit_meet.png`), `capture.mjs` (spelar in kuben deterministiskt från dev-servern: `npx vite --port 5174`, sedan
`node capture.mjs frames 1920 1080 1 8` och `ffmpeg -framerate 30 -i frames/f%04d.jpg -c:v libx264 -crf 16 -pix_fmt yuv420p cubit_launch.mp4`).
Ingen Higgsfield: allt är kod-renderat från samma motor som sajten.
