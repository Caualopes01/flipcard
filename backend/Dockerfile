FROM node:lts-alpine

USER node

ENV HOME=/home/node \
    PATH=/home/node/.local/bin:$PATH

WORKDIR $HOME/app

COPY --chown=node package.json ./

RUN npm install --production

COPY --chown=node . $HOME/app

EXPOSE 7860

ENTRYPOINT ["nodejs", "./index.js"]
