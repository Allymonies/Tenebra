FROM quantumlytangled/krist:latest

COPY static/ static/
COPY views/ views/
COPY src/ src/
COPY index.js index.js
COPY package.json package.json
COPY .git/ .git/
#COPY src/* /usr/src/krist/src/