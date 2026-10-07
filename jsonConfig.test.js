const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

describe('admin jsonConfig migration', () => {
    const repoDir = __dirname;
    const adminDir = path.join(repoDir, 'admin');
    const jsonConfigPath = path.join(adminDir, 'jsonConfig.json');
    const ioPackagePath = path.join(repoDir, 'io-package.json');
    const i18nDir = path.join(adminDir, 'i18n');
    const languages = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'zh-cn'];

    /**
     * @param {unknown} value
     * @param {Set<string>} keys
     * @returns {Set<string>}
     */
    function collectI18nKeys(value, keys = new Set()) {
        if (!value || typeof value !== 'object') {
            return keys;
        }

        for (const [property, entry] of Object.entries(value)) {
            if ((property === 'label' || property === 'help' || property === 'text') && typeof entry === 'string') {
                keys.add(entry);
            } else {
                collectI18nKeys(entry, keys);
            }
        }

        return keys;
    }

    it('uses json admin UI in io-package', () => {
        const ioPackage = JSON.parse(fs.readFileSync(ioPackagePath, 'utf8'));
        assert.equal(ioPackage.common.adminUI?.config, 'json');
    });

    it('replaces legacy admin html with jsonConfig and short-form translations', () => {
        assert.equal(fs.existsSync(path.join(adminDir, 'index.html')), false);
        assert.equal(fs.existsSync(jsonConfigPath), true);

        for (const language of languages) {
            assert.equal(fs.existsSync(path.join(i18nDir, `${language}.json`)), true, `Missing ${language}.json`);
        }
    });

    it('keeps translation files in sync with jsonConfig strings', () => {
        const jsonConfig = JSON.parse(fs.readFileSync(jsonConfigPath, 'utf8'));
        const requiredKeys = collectI18nKeys(jsonConfig);

        for (const language of languages) {
            const translations = JSON.parse(fs.readFileSync(path.join(i18nDir, `${language}.json`), 'utf8'));
            for (const key of requiredKeys) {
                assert.equal(
                    typeof translations[key],
                    'string',
                    `Missing translation key "${key}" in ${language}.json`,
                );
            }
        }
    });
});
