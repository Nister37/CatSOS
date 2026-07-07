FROM python:3.14-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

RUN adduser --disabled-password --gecos '' appuser

COPY . .

RUN chown -R appuser:appuser /app

FROM base AS development
EXPOSE 8000
USER appuser
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

FROM base AS test
USER appuser
CMD ["sh", "-c", "python manage.py check && python manage.py test"]
