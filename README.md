![Screenshot](https://user-images.githubusercontent.com/16438795/166155149-e3d58f4d-e02a-436f-928d-fe9b9c2a6665.png)

Simple go game database app, using Electron and [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3).

## Building

In the `src` folder, do:

```
npm install
./node_modules/.bin/electron-rebuild.cmd
./node_modules/.bin/electron .
```

That seems to be it? After which, one can do `electron .` (assuming Electron is installed globally). If there was any demand for this I would consider making a proper release.
