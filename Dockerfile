FROM uzh-bf/docker-shibboleth

COPY --chown=1001:root shibboleth/* /etc/shibboleth/

# COPY --chown=1001:root shibboleth/attribute-map.xml /etc/shibboleth/attribute-map.xml
# COPY --chown=1001:root shibboleth/attribute-policy.xml /etc/shibboleth/attribute-policy.xml
# COPY --chown=1001:root shibboleth/shibboleth2.xml /etc/shibboleth/shibboleth2.xml

# COPY app/ /var/www/html/
