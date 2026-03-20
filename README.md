# localdrop

LocalDrop is a small CLI tool + browser UI for quick local file transfers. It was created with Bun and uses a lightweight Hono-based server and a vanilla TypeScript frontend.

## Requirements

- Bun (v1.0+ recommended). Bun is required to run scripts, build the project, and install dependencies:
  - Verify Bun is installed locally:
    ```bash
    bun --version
    ```
  - If you don't have Bun installed, follow the official instructions: https://bun.sh

- Node-style development tools are not required (Bun replaces node/npm/yarn for this project).

## Quickstart (development)

1. Install dependencies (this creates/updates `bun.lock`):
   ```bash
   bun install
   ```

2. Run the development server (hot-reload):
   ```bash
   bun run dev
   ```
   - The `dev` script launches Bun in watch mode and restarts on source changes.
   - Open the browser at the server URL (by default this project commonly uses port `3000`; check server config or console output).

3. Tailwind CSS development watch (if you are working on styles separately):
   ```bash
   bun run styles:watch
   ```

4. Build client + styles for production:
   ```bash
   bun run build
   ```
   - `build` will run the client bundling and style minification scripts defined in `package.json`.

## Useful scripts

These scripts are defined in `package.json`:
- `dev` — Bun watch mode for the server (development).
- `styles:watch` — Tailwind CSS watcher for development.
- `build:client` — Bundle client code with `bun build`.
- `build:styles` — Process/minify Tailwind CSS for production.
- `build` — Run `build:client` and `build:styles` sequentially.

Invoke any script with:
```bash
bun run <script-name>
```

## Production / Binary (notes)

- Bun can produce a compiled binary using `bun build --compile` or similar flags. This project is structured to allow embedding static assets and compiling a single binary, but the exact compile command depends on how you want to embed assets and configure outdir/entry. Example:
  ```bash
  bun build ./src/server/index.ts --outdir ./dist --compile
  ```
  Adjust as needed for your target platform and desired output layout.

## Troubleshooting

- If `bun` command is not found, follow the installer instructions at https://bun.sh.
- If the server does not start on the expected port, check console output or `src/server` configuration for CLI overrides.
- If styles or client files are not updating, ensure the appropriate `styles:watch` or `dev` scripts are running in a separate terminal.

## Contributing

Contributions are welcome. Suggested workflow:
- Create a branch for your feature/fix.
- Run `bun install`.
- Use `bun run dev` and `bun run styles:watch` during development.
- Add tests or manual verification steps for features that change behavior.
