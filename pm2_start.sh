mkdir -p error_dumps && \
pm2 start npm --name justice-bot -- run start \
  --restart-delay=5000 \
  --max-restarts=10 \
  --error ./error_dumps/pm2_error.log \
  --output ./error_dumps/pm2.log
