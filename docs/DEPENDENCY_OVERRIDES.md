# Dependency overrides

## `deepmerge-ts`

QualCanvas overrides `deepmerge-ts` to `^8.0.2` because Prisma's
`@prisma/config` package currently pins version `7.1.5`, which is affected by
[GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).

Prisma uses the package's public `deepmerge` function as its configuration
merger. The patched major retains that API and is covered by the CI Prisma
configuration check, schema-drift job, production-image build, and application
test suites.

Remove this override when Prisma publishes an `@prisma/config` release that
depends on `deepmerge-ts` 8 or later. Keep the CI production-dependency audit in
place.
