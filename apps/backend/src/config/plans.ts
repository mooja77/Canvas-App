/**
 * Plan definitions moved to `shared/types/plans.ts`.
 *
 * The frontend needs the same tier data the server enforces — duplicating it is
 * what let /pricing drift from what the API actually allowed. But importing
 * `apps/backend/src/config/plans` from frontend source broke the production
 * image: the Dockerfile's frontend stage copies only `shared/` and
 * `apps/frontend/`, so `tsc -b` could not resolve the backend path and every
 * backend deploy failed from 2026-08-22 onward while the frontend kept shipping.
 *
 * `shared/` is the boundary both sides are allowed to cross. This file re-exports
 * so the backend's nine import sites keep working unchanged.
 */
export * from '@qualcanvas/shared';
