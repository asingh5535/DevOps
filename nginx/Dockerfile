FROM nginx:alpine

# Copy nginx config (paths relative to build context = DevOps/)
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend files into the image
COPY gorakhpur-enjoy /usr/share/nginx/html

EXPOSE 80
