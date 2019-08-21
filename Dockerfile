FROM uzhbf/shibboleth-sp-dockerized:master

ADD shibboleth/ /etc/shibboleth/
ADD app/ /var/www/html/
