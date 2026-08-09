mkdir -p error_dumps && \
pm2 start dist/justice.js \
  --name justice-bot \
  --node-args="-r dotenv/config" \
  --restart-delay 5000 \
  --max-restarts 10 \
  --output ./error_dumps/pm2.log \
  --error ./error_dumps/pm2_error.log