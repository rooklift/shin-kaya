Simple go game database app, using Electron and [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3).

For my own use, this is superceded by [Shin Kaya 2](https://github.com/rooklift/shin-kaya-2) though I'm not sure if I recommend it to others.

## Building

In the `src` folder, do:

```
npm install
./node_modules/.bin/electron-rebuild.cmd
./node_modules/.bin/electron .
```

That seems to be it? After which, one can do `electron .` (assuming Electron is installed globally). If there was any demand for this I would consider making a proper release.
