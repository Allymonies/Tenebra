FROM quantumlytangled/krist:latest

COPY static/ static/
COPY views/ views/
COPY src/ src/
COPY index.js index.js
#COPY src/* /usr/src/krist/src/