FROM iojs:onbuild
COPY . .
RUN ["npm", "install", "--loglevel", "warn"]
EXPOSE 3000
ENV DEBUG *
CMD ["node", "webhook.js"]