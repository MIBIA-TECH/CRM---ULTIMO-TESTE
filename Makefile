rebuild-front-prod:
	@echo "Reconstruindo o frontend para produção..."
	cd frontend && rm -rf build && npm run build
	@echo "Reiniciando o serviço do frontend no PM2..."
	pm2 restart frontend
