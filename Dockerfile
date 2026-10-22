FROM node:20-bookworm-slim AS node
FROM python:3.11.9-slim-bookworm AS validated
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
WORKDIR /work
COPY . .
RUN pip install --no-cache-dir -r requirements.txt && npm ci
RUN npm run typecheck && python run_pipeline.py
RUN python -m unittest discover -s tests -p 'test_*.py' -v && npm test && python analytics_case_study/06_validate_metrics.py

FROM python:3.11.9-slim-bookworm
WORKDIR /app
COPY requirements.txt constraints.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=validated /work/public ./public
COPY app.py artifact_safety.py ./
ENV PORT=8050
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8050} app:app"]
