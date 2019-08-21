FROM uzhbf/shibboleth-sp-dockerized:master

ADD shibboleth/ /etc/shibboleth/
ADD app/ /var/www/html/

RUN echo "ServerName aai.klicker.uzh.ch" >> /etc/httpd/conf/httpd.conf
