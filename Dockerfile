FROM uzhbf/docker-shibboleth

ENV docker="true"
ENV COMPOSER_INSTALLER="http://getcomposer.org/installer"

# inject php sources
COPY --chown=1001:root src/ /tmp/src/

# run the assemble script
RUN set -x && /usr/libexec/s2i/assemble

# inject shibboleth config files for shib and httpd
COPY --chown=1001:0 shibboleth/* /etc/shibboleth/
COPY --chown=1001:0 conf/shib.conf /etc/httpd/conf.d/shib.conf
