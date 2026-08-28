const { createHash } = require('node:crypto');
const ts = require('typescript');

/**
 * Jest transformer for the plain-ESM JavaScript in `packages/shared`.
 *
 * That package ships `src/validation/email.js` as real ESM on purpose (see the
 * header comment in the file itself: Vite loads it raw, and Node's own loader
 * needs a real .js at API runtime, where Node 22+ `require(esm)` handles it).
 * Its directory carries `{"type": "module"}`, which is exactly what breaks
 * under Jest: Jest's CommonJS runtime has no `require(esm)`, so the file lands
 * as-is and throws `SyntaxError: Unexpected token 'export'`.
 *
 * ts-jest can't do it: `allowJs` makes it *see* the file, but it still derives
 * the module format from that `{"type": "module"}` and re-emits ESM. Its own
 * escape hatch — force `module: CommonJS` through `ts.transpileModule`, which
 * reads no package.json at all — only applies to files under `node_modules`
 * (see the `isNodeModule` branch in ts-jest's transformer). This does the same
 * thing for our workspace package.
 *
 * Both module systems have to be honoured, because the two Jest configs
 * differ: the unit config runs CommonJS, while test/jest-e2e.json runs with
 * `--experimental-vm-modules`, where Jest loads this file as a genuine ES
 * module. Emitting CommonJS there would blow up the other way round
 * ("ReferenceError: exports is not defined"), so follow Jest's lead.
 *
 * That split is also why test/jest-e2e.json maps `libphonenumber-js/max` to the
 * library's CommonJS build, and the unit config does not. Under the ESM branch
 * above, `validation/phone.js` stays ESM, so its import of that library is
 * resolved by Jest's ESM registry — which cannot load the library's own
 * metadata JSON correctly (it arrives double-wrapped, and libphonenumber
 * rejects it with "`metadata` argument was passed but it's not a valid
 * metadata"). Pointing at the CommonJS build keeps the library and its metadata
 * in one registry. The unit config already takes the require() path, because
 * this transformer has rewritten the shared ESM to CommonJS for it.
 */
module.exports = {
  process(sourceText, sourcePath, options) {
    // Jest is loading this as a real ES module — it is already valid ESM, and
    // rewriting it to CommonJS would break it in that context.
    if (options?.supportsStaticESM) {
      return { code: sourceText };
    }

    const { outputText, sourceMapText } = ts.transpileModule(sourceText, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2023,
        esModuleInterop: true,
        sourceMap: true,
      },
      fileName: sourcePath,
    });
    return { code: outputText, map: sourceMapText };
  },

  getCacheKey(sourceText, sourcePath, options) {
    return createHash('sha1')
      .update(sourceText)
      .update('\0', 'utf8')
      .update(sourcePath)
      .update('\0', 'utf8')
      .update(options?.supportsStaticESM ? 'esm' : 'cjs')
      .digest('hex');
  },
};
