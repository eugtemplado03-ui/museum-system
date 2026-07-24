Deployment
==========

This document describes ways to deploy the `museum-system` Node/Express app.

1) Run locally

```bash
npm install
npm start
# or run in dev
npm run dev
```

2) Docker (recommended for predictable runtime)

Build the image locally:

```bash
docker build -t museum-system:latest .
```

Run the container:

```bash
docker run -it -p 3000:3000 --name museum-system -v $(pwd)/uploads:/usr/src/app/uploads museum-system:latest
```

Notes:
- The container runs as non-root `node` user. Exposed port is `3000`.
- Bind-mount the `uploads` directory if you want persistent uploaded files.

3) Heroku

You can deploy using the `Procfile` included. Push to a Heroku app (set `NODE_ENV=production` and any required env vars like `OPENROUTER_API_KEY`):

```bash
heroku create my-museum-app
git push heroku main
heroku config:set OPENROUTER_API_KEY=...
heroku open
```

4) GitHub Container Registry (CI)

A GitHub Actions workflow (`.github/workflows/docker-image.yml`) is included to build and push `ghcr.io/${{ github.repository }}:latest` on push to `main`.

Set repository visibility and permissions to allow package publishing.

5) Next steps
- Add automatic migrations or seed steps in CI if needed.
- For production, use a process manager, reverse proxy (nginx), and TLS termination.
