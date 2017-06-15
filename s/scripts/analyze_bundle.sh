#!/usr/bin/env bash
set -u -e -o pipefail
# uses source-map-explorer (https://www.npmjs.com/package/source-map-explorer)
# to visualize what modules end up in final javascript bundle.

install_sme() {
	if [ ! -f ./node_modules/.bin/source-map-explorer ]; then
		npm install source-map-explorer
	fi
}

analyze_prod()
{
	rm -rf s/dist/*.map s/dist/*.js s/dist/*.css
	. s/update-deps.sh
	install_sme

	./node_modules/.bin/gulp jsprod
	./node_modules/.bin/source-map-explorer s/dist/bundle.min.js s/dist/bundle.min.js.map
}

analyze_prod
