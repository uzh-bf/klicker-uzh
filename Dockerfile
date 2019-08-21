FROM uzhbf/shibboleth-sp-dockerized:master

COPY shibboleth/ /etc/shibboleth/
COPY app/ /var/www/html/
COPY --chown=root:root httpd.conf /etc/httpd/conf/httpd.conf
