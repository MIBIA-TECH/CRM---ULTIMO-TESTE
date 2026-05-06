backup:
	@echo "Executando script de backup..."
	@bash ./scripts/backup.sh

logs:
	@pm2 logs --lines 1000

start:
	@pm2 start backend

restart:
	@pm2 restart backend
