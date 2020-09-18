#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

export TS_NODE_COMPILER_OPTIONS="{\"module\": \"commonjs\" }"

npm run build
tsc tsc/backend/mock.ts