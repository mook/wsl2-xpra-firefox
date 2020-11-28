IMAGE := ghcr.io/mook/wsl2-xpra-firefox
TAG ?= latest

run:
	TAG=${TAG} ./start

build:
	docker build -t ${IMAGE}:${TAG} .

start.ps1:
	docker run --rm ${IMAGE}:${TAG} --start-script "${IMAGE}:${TAG}" > $@
