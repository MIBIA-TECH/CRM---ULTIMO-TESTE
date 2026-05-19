rebuild-backend-prod:
	@echo "Reconstruindo o backend para produção..."
	cd backend && npm run build
	@echo "Reiniciando o serviço do backend no PM2..."
	pm2 restart backend

rebuild-front-prod:
	@echo "Reconstruindo o frontend para produção..."
	cd frontend && rm -rf build && npm run build
	@echo "Reiniciando o serviço do frontend no PM2..."
	pm2 restart frontend

rebuild-all:
	@echo "Reconstruindo backend e frontend para produção..."
	cd backend && npm run build
	pm2 restart backend
	cd frontend && rm -rf build && npm run build
	pm2 restart frontend
	@echo "Backend e frontend reconstruídos e reiniciados!"

logs:
	pm2 logs
