FROM uzhbf/docker-shibboleth

COPY --chown=1001:root shibboleth/* /etc/shibboleth/
COPY --chown=1001:root conf/shib.conf /etc/httpd/conf.d/shib.conf

# COPY app/ /var/www/html/
