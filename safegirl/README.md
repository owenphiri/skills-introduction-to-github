# 🎓 SafeGirl EduTrack — Progressive Web App

**Protecting Girls, Promoting Education, Building Futures.**
A companion PWA aligned to Zambia's **Keeping Girls in School (KGS / GEWEL)** programme.

Installable, offline-first, mobile-first — no backend required. Pure static
front-end (HTML/CSS/JS), so it deploys anywhere, including Vercel.

## Features
- **🌟 KGS Success Stories** — real-style stories of girls kept in school.
- **🎒 Internships** — searchable openings at parastatals, ministries & partners.
- **💼 Parastatal / Quasi-Government Jobs** — a job portal with sector filters.
- **🛡️ GBV Support** — hotlines (116, Police 991/999, VSU, Childline 933, YWCA),
  one-stop-centre & referral pathways, and a **confidential report form** that is
  stored **only on the device** in this demo. A quick-exit button is always visible.
- **📣 Awareness** — multilingual messages (English, Bemba, Nyanja, Tonga).
- **PWA**: web app manifest, service worker (offline app shell), install prompt,
  online/offline indicator, maskable icons.

## Run locally
It's static — serve the folder with any static server:
```bash
cd safegirl
python3 -m http.server 8088
# open http://localhost:8088
```
A service worker needs http(s) (not file://), so use a server as above.

## Deploy to Vercel (static)
The app has no build step. Create a Vercel project with:
- **Root Directory:** `safegirl`
- **Framework Preset:** Other (no build)
- **Build Command:** *(none)*  ·  **Output Directory:** `.`

`vercel.json` here adds security headers and correct caching for `sw.js` /
manifest. Attach your custom domain in the Vercel dashboard when it's ready.

## Safeguarding note
This demo keeps any GBV report only in the browser (`localStorage`) and sends
nothing over the network. A real deployment **must** comply with the Zambia
**Data Protection Act No. 3 of 2021**, Ministry of Education safeguarding
policies, informed consent, and strict confidentiality for survivors, routing
reports only to trained Guidance & Counseling and Victim Support staff.

Helpline numbers are illustrative — **confirm current official numbers** before
real-world use.

---
© 2026 SafeGirl EduTrack · MIT License.
