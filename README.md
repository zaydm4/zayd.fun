# zayd.fun

Plain HTML, CSS and a little JavaScript. No framework.

## Run it on your computer

You need Node 18 or newer (https://nodejs.org). In this folder:

    node scripts/serve.mjs

Then open http://localhost:8000. Add or swap images and refresh the page; the list rebuilds on every load.
(`npm run dev` does the same. Set a different port with `PORT=3000 node scripts/serve.mjs`.)

## Add your work

Drop image files into a folder and push.

- `assets/profile/` is your photo in the header (`profile.jpg` or the first image there)
- `assets/3d/` feeds the 3D section
- `assets/frames/` feeds the Frames section

Name a file `2024-neon-alley.jpg` and it appears as "Neon alley", 2024. Newest year first.
To link a frame to its Instagram or X post, or to override a title, add `captions.json` to the folder (see the README in each folder).
Until a folder has images, its section shows dithered placeholders.

3D and Frames are equal-width columns and always end at the same height. The shorter column spreads its rows to match,
so it looks best when the counts roughly fit: about 3 renders for every 2 frames (for example 6 and 4, or 9 and 6). Renders are 4:3 landscape and frames are 3:4 portrait.

On deploy, the GitHub Action builds `data/media.js` from these folders and shrinks big originals
to 1600px in the published copy only. Your repo keeps the full-size files.

## Edit the rest

- `index.html`: copy and links
- `css/style.css`: colors are the variables at the top (`--dither` is the orange)
- `js/dither.js`: the dithering

## Put it online

GitHub Pages from Actions: Settings > Pages > Source: GitHub Actions.
The workflow also refreshes the Writing list from the Substack feed every day.
Put `resume.pdf` in the repo root.

The site is static files, so it also works on any static host. To self-host, run `node scripts/build-media.mjs`
and serve this folder (minus `scripts/` and `.github/`) with nginx, Caddy or any static container.
