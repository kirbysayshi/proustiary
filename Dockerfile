FROM iojs:onbuild
COPY . .
RUN npm install -q
EXPOSE 3000
ENV DEBUG *
CMD ["node", "webhook.js"]