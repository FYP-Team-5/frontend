# Frontend container

From `frontend`, build and start the frontend:

```bash
docker compose up --build -d
```

Open <http://localhost:3000>. The container serves the frontend only; the
browser calls the backend directly at `NEXT_PUBLIC_API_URL`, which defaults to
`http://localhost:8002` in `compose.yaml`. Keep that backend running locally.
`FRONTEND_PORT` changes the host port if `3000` is already taken.

Compose reads an optional local `.env` file for `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_GRADING_API_KEY`, and `FRONTEND_PORT`. For example:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8002
FRONTEND_PORT=3000
```

`NEXT_PUBLIC_*` values are embedded in the browser bundle during the image
build. Rebuild with `docker compose up --build -d` after changing them. These
values are visible to browser users, so do not put private credentials in
them. `.env` is excluded from the Docker build context.

```bash
docker compose logs -f frontend
docker compose down
```


# frontend
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
cd frontend/my-app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
