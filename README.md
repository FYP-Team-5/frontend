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
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


## Quiz and grading flows

Students open a course and test to see their attempt history. Accepted
submissions have stable result pages under
`/student/courses/{courseId}/tests/{testId}/attempts/{attemptId}`. These pages
show grading progress, submitted answers, saved scores and feedback, and a retry
button for failed grading. Students can leave and return after submission.

Instructor test cards include **View submissions**, end-date editing, and
**End test**. Submission review lists all registered students and separates the
latest submitted attempt from the latest graded attempt. Only the latest graded
attempt can be edited, with stale-edit detection and instructor override labels.

New tests require an end date. Dates display the browser timezone and are sent
to the backend as UTC timestamps. Closure is enforced by the backend; results
and already accepted grading remain available after closure.

The backend additionally verifies instructor/student bearer tokens on protected
routes. Configure `NEXT_PUBLIC_API_URL` before building. Persistent grading jobs
and restart recovery run in the backend using its existing PostgreSQL database.


## Versioned CSV training dataset

The instructor dashboard links to `/instructor/training-dataset`. Uploads use
`training_data_moh_eng_rubrics.csv`'s eight-column CSV format. The page shows
storage readiness, publication progress, version history, and latest/historical
CSV downloads. Failed publication can be retried without losing the current
ready version.

Closed test cards show automatic training export progress and excluded rows.
After accepted grading settles, the backend collects each student's latest
successfully graded submission; a pending or failed latest submission does not
fall back to an older attempt. Instructor corrections produce a new version.

Submission review supports rubric criterion scores as well as totals and
feedback. Entering all criterion scores updates the total. Criterion scores
must agree with the aggregate grade before the row can be included in the
training CSV. The backend keeps previous CSV versions and original automated
grades for review. SeaweedFS credentials are never sent to the frontend.
