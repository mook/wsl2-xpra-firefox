# vim: set et ts=4 :

FROM ghcr.io/mook/wsl2-xpra-generic:latest AS downloader
RUN zypper --non-interactive install --replacefiles \
    python3 \
    wget

# Download extensions
ADD download-xpi.py /usr/local/bin
# {e58d3966-3d76-4cd9-8552-1582fbc800c1} Buster

RUN python3 /usr/local/bin/download-xpi.py \
        --output /usr/lib64/firefox/distribution/extensions/ \
        --addon-id uBlock0@raymondhill.net \
        --addon-id {e58d3966-3d76-4cd9-8552-1582fbc800c1} \
    && true

# Add customizations
ADD firefox-config.js /usr/lib64/firefox/
ADD prefs.js /usr/lib64/firefox/defaults/pref/

# Get the client for the buster addon
RUN wget --output-document=/usr/local/bin/buster-client-setup \
    https://github.com/dessant/buster-client/releases/download/v0.3.0/buster-client-setup-v0.3.0-linux-amd64
RUN chmod a+x /usr/local/bin/buster-client-setup
RUN touch /usr/local/bin/buster-client
RUN /usr/local/bin/buster-client-setup -update

FROM ghcr.io/mook/wsl2-xpra-generic:latest

RUN true \
    && zypper --non-interactive install MozillaFirefox \
    && zypper --non-interactive clean --all \
    && true

COPY --from=downloader /usr/lib64/firefox/ /usr/lib64/firefox/
COPY --from=downloader /usr/local/bin/buster-client /usr/local/bin/
COPY --chown=root:root native-messaging-host.json /usr/lib64/mozilla/native-messaging-hosts/org.buster.client.json

USER docker-user:docker-user

ENTRYPOINT [ "/usr/local/bin/entrypoint.sh", "/usr/bin/firefox" ]
