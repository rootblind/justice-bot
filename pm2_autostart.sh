pm2 save && \
sudo env PATH=$PATH:$(dirname $(command -v node)) \
$(command -v pm2) startup systemd \
-u $(whoami) --hp $HOME
