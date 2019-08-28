FROM uzhbf/docker-shibboleth

ENV docker="true"

# inject shibboleth config files for shib and httpd
COPY --chown=1001:root shibboleth/* /etc/shibboleth/
COPY --chown=1001:root conf/shib.conf /etc/httpd/conf.d/shib.conf

# inject php api for /secure
COPY --chown=1001:root src/ /tmp/src/
RUN /usr/libexec/s2i/assemble
