import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

type ImportMap = {
	imports: Record<string, string>
}

type PackageJson = {
	dependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
	module?: string
	main?: string
	browser?: string | Record<string, string>
	exports?: unknown
}

const cwd = process.cwd()
const nodeModulesRoot = path.join(cwd, 'node_modules')
const rootPackageJsonPath = path.join(cwd, 'package.json')

const toImportPath = (pkgName: string, subPath = '') => {
	return subPath
		? `/node_modules/${pkgName}/${subPath}`
		: `/node_modules/${pkgName}`
}

const normalizeExportPath = (value: string) => value.replace(/^\.\//, '').replace(/^\//, '')

const pickExportTarget = (exportsField: unknown): string | null => {
	if (typeof exportsField === 'string') {
		return exportsField
	}

	if (!exportsField || typeof exportsField !== 'object') {
		return null
	}

	const exportsObject = exportsField as Record<string, unknown>

	if (typeof exportsObject['.'] === 'string') {
		return exportsObject['.']
	}

	if (exportsObject['.'] && typeof exportsObject['.'] === 'object') {
		const dotEntry = exportsObject['.'] as Record<string, unknown>
		const preferredConditions = ['browser', 'import', 'default', 'module', 'node']

		for (const condition of preferredConditions) {
			if (typeof dotEntry[condition] === 'string') {
				return dotEntry[condition]
			}
		}
	}

	const preferredConditions = ['browser', 'import', 'default', 'module', 'node']
	for (const condition of preferredConditions) {
		if (typeof exportsObject[condition] === 'string') {
			return exportsObject[condition]
		}
	}

	return null
}

const findPackageDir = (pkgName: string) => path.join(nodeModulesRoot, ...pkgName.split('/'))

const readJson = <T>(filePath: string): T | null => {
	if (!existsSync(filePath)) {
		return null
	}

	try {
		return JSON.parse(readFileSync(filePath, 'utf8')) as T
	} catch {
		return null
	}
}

const resolvePackageEntry = (pkgName: string, pkg: PackageJson): string | null => {
	const pkgDir = findPackageDir(pkgName)
	const candidates: string[] = []

	const exportTarget = pickExportTarget(pkg.exports)
	if (exportTarget) {
		candidates.push(exportTarget)
	}

	if (typeof pkg.browser === 'string') {
		candidates.push(pkg.browser)
	}

	if (pkg.module) {
		candidates.push(pkg.module)
	}

	if (pkg.main) {
		candidates.push(pkg.main)
	}

	candidates.push('index.js', 'index.mjs', 'dist/index.js')

	for (const candidate of candidates) {
		const normalized = normalizeExportPath(candidate)

		if (!normalized || normalized.endsWith('/')) {
			continue
		}

		if (existsSync(path.join(pkgDir, normalized))) {
			return normalized
		}
	}

	return null
}

const getRuntimeDependencies = (pkg: PackageJson): string[] => {
	return [
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.optionalDependencies ?? {}),
		...Object.keys(pkg.peerDependencies ?? {}),
	]
}

export const generateImportMap = (): ImportMap => {
	const rootPackage = readJson<PackageJson>(rootPackageJsonPath)

	if (!rootPackage) {
		return { imports: {} }
	}

	const imports: Record<string, string> = {}
	const seen = new Set<string>()
	const queue = [...Object.keys(rootPackage.dependencies ?? {})]

	while (queue.length > 0) {
		const pkgName = queue.shift()

		if (!pkgName || seen.has(pkgName)) {
			continue
		}

		seen.add(pkgName)

		const pkgJsonPath = path.join(findPackageDir(pkgName), 'package.json')
		const pkg = readJson<PackageJson>(pkgJsonPath)
		if (!pkg) {
			continue
		}

		const entry = resolvePackageEntry(pkgName, pkg)
		if (entry) {
			imports[pkgName] = toImportPath(pkgName, entry)
			imports[`${pkgName}/`] = `${toImportPath(pkgName)}/`
		}

		for (const dep of getRuntimeDependencies(pkg)) {
			if (!seen.has(dep)) {
				queue.push(dep)
			}
		}
	}

	const sorted = Object.fromEntries(Object.entries(imports).sort(([a], [b]) => a.localeCompare(b)))
	return { imports: sorted }
}