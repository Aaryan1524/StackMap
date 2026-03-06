# StackMap — Errors & Lessons Learned

---

## 1. Wrong Python Environment (Anaconda vs venv)

**Error:**
```
ModuleNotFoundError: No module named 'neo4j'
```
**Cause:** Running `uvicorn` picked up the system Anaconda Python instead of the project venv, so none of the installed packages were found.

**Fix:** Always invoke uvicorn through the venv Python explicitly:
```bash
/path/to/project/.venv/bin/python -m uvicorn main:app --reload
```

**Lesson:** When you have multiple Python environments (Anaconda + venv), shell commands like `uvicorn` or `python` resolve to whichever is first on `$PATH`. Always use the full path to the venv binary.

---

## 2. Venv Created at Project Root, Not Inside Backend

**Error:**
```
zsh: no such file or directory: .venv/bin/python
```
**Cause:** The venv was created at `StackMap/.venv/` but we were looking for it at `StackMap/backend/.venv/`.

**Fix:** Find the venv with:
```bash
find /path/to/project -name "python" -path "*/bin/python"
```

**Lesson:** Always note where you create your venv. A common convention is to create it inside the package directory (e.g. `backend/`), but tools like VS Code sometimes create it at the workspace root.

---

## 3. CORS Blocked — Wrong Port

**Error:**
```
Access to fetch blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```
**Cause:** The frontend ran on port `5174` (because 5173 was occupied), but the backend CORS config only allowed `http://localhost:5173`.

**Fix:** Either free port 5173 first, or allow all origins during development:
```python
allow_origins=["*"]
```

**Lesson:** Vite increments the port if 5173 is taken. For dev, `allow_origins=["*"]` is safe. For production, always restrict to specific origins.

---

## 4. Stale Server Running on Port 8000

**Error:**
```
POST http://localhost:8000/ingest → 404 Not Found
```
**Cause:** An old uvicorn process was already running on port 8000 from a previous session. It was serving an older version of `main.py` without the `/ingest` route.

**Fix:** Kill existing processes on the port before starting:
```bash
lsof -ti :8000 | xargs kill -9
```

**Lesson:** `--reload` only hot-reloads on file changes — it doesn't replace an already-running process on the same port. Always check what's running on your port if you get unexpected 404s.

---

## 5. `type="url"` Silently Blocking Form Submission

**Error:** Clicking Analyze did nothing — no network request, no error shown.

**Cause:** The HTML input had `type="url"`, which enables browser-native URL validation. If the browser rejects the URL format, the form silently refuses to submit.

**Fix:** Change to `type="text"` and handle validation in code if needed.

**Lesson:** `type="url"` validation is inconsistent across browsers and fails silently. For developer tools where users paste URLs in various formats, always use `type="text"`.

---

## 6. Backend Not Reloading .env After Key Was Added

**Error:** Pinecone still returned 401 after adding the API key to `.env`.

**Cause:** `uvicorn --reload` only watches `.py` files. The `.env` is loaded once at startup via `load_dotenv()`. Saving the `.env` doesn't trigger a reload.

**Fix:** Fully restart the backend (Ctrl+C and re-run) after changing `.env`.

**Lesson:** Any change to `.env`, `requirements.txt`, or other non-Python config files requires a full server restart, not just a hot reload.

---

## 7. Pinecone API Key Not Set

**Error:**
```
401 Unauthorized — Invalid API Key
```
**Cause:** The `.env` file still had the placeholder value `your_pinecone_api_key_here`.

**Fix:** Replace all placeholder values in `.env` before running the backend.

**Lesson:** Always verify `.env` values are real before debugging API errors. A quick `grep "your_" .env` can catch unfilled placeholders.

---

## 8. Wrong `react-force-graph` Package (VR/AR Dependencies)

**Error:** Dashboard went blank — runtime crash due to `AFRAME is not defined`.

**Cause:** Installed `react-force-graph` (the all-in-one bundle) instead of `react-force-graph-3d` (3D only). The all-in-one package pulls in AR/VR dependencies (`aframe`, `three-ar`, etc.) that require browser globals like `AFRAME` which don't exist in a standard React app.

**Fix:**
```bash
npm uninstall react-force-graph
npm install react-force-graph-3d
```

**Lesson:** Meta-packages that bundle multiple variants (2D/3D/VR/AR) often carry heavy or incompatible dependencies. Always install the specific variant you need.

---

## 9. Neo4j Container Port Already Allocated

**Error:**
```
Bind for 0.0.0.0:7474 failed: port is already allocated
```
**Cause:** Trying to start a new Neo4j container when one (`stackmap-neo4j-1`) was already running and holding port 7474.

**Fix:** Start the existing container instead of creating a new one:
```bash
docker start stackmap-neo4j-1
```

**Lesson:** `docker run` always creates a new container. If a container already exists for your service, use `docker start <name>`. Use `docker ps -a` to see all containers (including stopped ones).

---

## 10. Neo4j Unauthorized — Default Credentials Not Set

**Error:**
```
Neo.ClientError.Security.Unauthorized — Invalid credential
```
**Cause:** The Neo4j container started without the `NEO4J_AUTH` environment variable, so it defaulted to `neo4j/neo4j`. The backend `.env` had `NEO4J_PASSWORD=password`, causing a mismatch. On top of that, Neo4j requires you to change the default password before first use (`CredentialsExpired`).

**Fix:** Change the Neo4j password to match `.env`:
```bash
curl -u neo4j:neo4j -X POST http://localhost:7474/db/system/query/v2 \
  -H "Content-Type: application/json" \
  -d '{"statement":"ALTER CURRENT USER SET PASSWORD FROM '\''neo4j'\'' TO '\''password'\''"}'
```

Or start the container with the correct auth from the start:
```bash
docker run -e NEO4J_AUTH=neo4j/password -p 7474:7474 -p 7687:7687 neo4j:latest
```

**Lesson:** Neo4j forces a password change on first login for security. Always pass `NEO4J_AUTH=user/password` when starting the container so it's pre-configured and matches your app config.

---

## 11. Docker Desktop Socket Error

**Error:**
```
connect ECONNREFUSED /Users/aaryan/.docker/run/docker.sock
```
**Cause:** Docker Desktop crashed or didn't fully start, leaving the Unix socket missing or unresponsive.

**Fix:**
```bash
killall "Docker Desktop"
sleep 2
open -a "Docker Desktop"
```
Wait ~30s for the menu bar whale icon to stop animating.

**Lesson:** Docker Desktop on macOS occasionally gets into a bad state. The daemon (which runs containers) can keep running even when the UI crashes — always check `docker ps` in terminal before concluding Docker is fully down.

---

## Summary Table

| # | Problem | Root Cause | Fix |
|---|---------|-----------|-----|
| 1 | `ModuleNotFoundError` | Wrong Python env (Anaconda) | Use full venv path |
| 2 | Venv not found | Venv at project root, not backend | `find` to locate venv |
| 3 | CORS blocked | Port mismatch (5173 vs 5174) | `allow_origins=["*"]` in dev |
| 4 | 404 on `/ingest` | Stale server on port 8000 | Kill port before starting |
| 5 | Analyze button did nothing | `type="url"` silent validation | Use `type="text"` |
| 6 | Pinecone 401 after adding key | `.env` not reloaded by `--reload` | Full server restart |
| 7 | Pinecone 401 | Placeholder key in `.env` | Fill in real API keys |
| 8 | Dashboard blank | Wrong npm package (VR/AR deps) | Use `react-force-graph-3d` |
| 9 | Port already allocated | Duplicate Neo4j container | `docker start` not `docker run` |
| 10 | Neo4j unauthorized | Default creds + expired password | Set password via HTTP API |
| 11 | Docker socket error | Docker Desktop crashed | Force quit and reopen |
