FROM iojs:2.3.0
COPY . .
ENV NPM_CONFIG_LOGLEVEL warn
RUN npm install
EXPOSE 3000
ENV DEBUG *
CMD ["node", "webhook.js"]