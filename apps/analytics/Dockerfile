FROM python:3.12

WORKDIR /app

COPY apps/analytics/requirements.txt .

RUN pip install -r requirements.txt

COPY apps/analytics/ .
COPY packages/prisma/src/prisma/schema/*.prisma apps/analytics/prisma/schema/
RUN rm apps/analytics/prisma/schema/js.prisma

RUN prisma generate
