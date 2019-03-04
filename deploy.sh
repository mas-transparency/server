rsync -r --exclude=node_modules . ubuntu@3.93.95.228:~/server --delete
ssh ubuntu@3.93.95.228 'cd ~/server && sudo docker-compose -f docker-compose.yml down && sudo docker-compose -f docker-compose.yml up -d'
