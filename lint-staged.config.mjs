import path from 'node:path'

function relativeTo(cwd, files) {
  return files.map((file) => path.relative(cwd, file)).join(' ')
}

export default {
  'apps/web/**/*.{js,jsx,ts,tsx}': (files) =>
    `npm exec --workspace=web -- eslint --fix ${relativeTo('apps/web', files)}`,
  'apps/api/**/*.{js,ts}': (files) =>
    `npm exec --workspace=api -- eslint --fix ${relativeTo('apps/api', files)}`,
  '**/*.{js,jsx,ts,tsx,json,md,yml,yaml,css}': 'prettier --write',
}
